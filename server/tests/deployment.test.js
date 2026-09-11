import { test } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { validateEnv, allowedOrigins } from "../config/env.js";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

function withEnv(values, work) {
  const previous = { ...process.env };
  Object.assign(process.env, values);
  return Promise.resolve()
    .then(work)
    .finally(() => {
      for (const key of Object.keys(process.env))
        if (!(key in previous)) delete process.env[key];
      Object.assign(process.env, previous);
    });
}

const production = {
  NODE_ENV: "production",
  FRONTEND_URL: "https://water.example.com/",
  MONGO_URI: "mongodb+srv://cluster.example.com/smart_water_portal",
  JWT_SECRET: "deployment-test-only-secret-with-more-than-32-characters",
  TRUST_PROXY_HOPS: "1",
};

test("production requires explicit remote database, HTTPS origin and a stable secret", async () => {
  await withEnv(production, async () => {
    assert.doesNotThrow(validateEnv);
    assert.deepEqual(allowedOrigins(), ["https://water.example.com"]);
    for (const values of [
      { FRONTEND_URL: "" },
      { FRONTEND_URL: "http://water.example.com" },
      { FRONTEND_URL: "https://localhost" },
      { FRONTEND_URL: "https://water.example.com/path" },
      { MONGO_URI: "mongodb://127.0.0.1:27017/smart_water_portal" },
      { MONGO_URI: "" },
      { JWT_SECRET: "" },
      { TRUST_PROXY_HOPS: "true" },
    ])
      await withEnv(values, () => assert.throws(validateEnv));
  });
});

test("production CORS permits only the configured origin and forwards bearer authorization", async () => {
  await withEnv(production, async () => {
    const { default: app } = await import("../app.js?production-cors");
    assert.equal(app.get("trust proxy"), 1);
    for (const origin of [
      "https://water.example.com",
      "https://other.vercel.app",
      "http://localhost:5173",
    ]) {
      const response = await request(app)
        .options("/api/auth/me")
        .set("Origin", origin)
        .set("Access-Control-Request-Method", "GET")
        .set("Access-Control-Request-Headers", "authorization,content-type")
        .expect(204);
      assert.equal(
        response.headers["access-control-allow-origin"],
        origin === "https://water.example.com" ? origin : undefined,
      );
      if (origin === "https://water.example.com")
        assert.match(
          response.headers["access-control-allow-headers"],
          /authorization/,
        );
    }
    const health = await request(app).get("/api/health").expect(503);
    assert.equal(health.body.database, "unavailable");
    assert.equal(health.headers["cache-control"], "no-store");
  });
});

test("production setup does not generate local environment files or secrets", () => {
  const result = spawnSync(
    process.execPath,
    [fileURLToPath(new URL("../../scripts/setup.mjs", import.meta.url))],
    {
      env: { ...process.env, NODE_ENV: "production" },
      encoding: "utf8",
      windowsHide: true,
    },
  );
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Production uses the hosting provider/);
  assert.doesNotMatch(result.stdout, /Created|Added random/);
});

test("Vite production configuration rejects localhost and normalizes the API prefix", async () => {
  const { default: config } = await import("../../client/vite.config.js");
  for (const url of [
    "http://localhost:5000/api",
    "https://127.0.0.1",
    "http://api.example.com",
    "https://user:password@api.example.com",
    "https://api.example.com/api/wrong",
  ]) {
    await withEnv({ VITE_API_URL: url }, () =>
      assert.throws(
        () => config({ command: "build", mode: "production" }),
        /Set VITE_API_URL/,
      ),
    );
  }
  for (const url of [
    "https://api.example.com",
    "https://api.example.com/api/",
  ]) {
    await withEnv({ VITE_API_URL: url }, () =>
      assert.equal(
        config({ command: "build", mode: "production" }).define[
          "import.meta.env.VITE_API_URL"
        ],
        '"https://api.example.com/api"',
      ),
    );
  }
});
