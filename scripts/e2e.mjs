import "../server/config/env.js";
import { spawn } from "node:child_process";
import { once } from "node:events";
import mongoose from "mongoose";

// Browser tests use their own database and ports, leaving the working portal alone.
const database = `smart_water_portal_e2e_${Date.now()}`;
const uri = new URL(process.env.MONGO_URI);
uri.pathname = `/${database}`;
const env = {
  ...process.env,
  MONGO_URI: uri.href,
  PORT: "5001",
  NODE_ENV: "test",
  FRONTEND_URL: "http://localhost:5174",
  CLIENT_ORIGIN: "http://localhost:5174",
  VITE_API_URL: "http://localhost:5001/api",
  E2E_BASE_URL: "http://localhost:5174",
};
const children = [];
const start = (file, args = []) => {
  const child = spawn(process.execPath, [file, ...args], {
    env,
    stdio: "inherit",
    windowsHide: true,
  });
  children.push(child);
  return child;
};
const waitFor = async (url, child) => {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (child.exitCode !== null)
      throw new Error(`Server exited before ${url} became available.`);
    try {
      if ((await fetch(url)).ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`Server did not become available: ${url}`);
};
try {
  const [seedCode] = await once(start("server/seed.js"), "exit");
  if (seedCode !== 0) throw new Error("Test database seed failed.");
  const backend = start("server/server.js");
  const frontend = start("node_modules/vite/bin/vite.js", [
    "client",
    "--host",
    "127.0.0.1",
    "--port",
    "5174",
    "--strictPort",
    "--configLoader",
    "runner",
  ]);
  await Promise.all([
    waitFor("http://localhost:5001/api/health", backend),
    waitFor(env.E2E_BASE_URL, frontend),
  ]);
  const [code] = await once(
    start("node_modules/@playwright/test/cli.js", [
      "test",
      ...process.argv.slice(2),
    ]),
    "exit",
  );
  process.exitCode = code ?? 1;
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  for (const child of children) {
    if (child.exitCode === null) {
      const stopped = once(child, "exit");
      child.kill();
      await stopped;
    }
  }
  await mongoose.connect(env.MONGO_URI, { serverSelectionTimeoutMS: 5000 });
  if (
    mongoose.connection.name === database &&
    database.startsWith("smart_water_portal_e2e_")
  )
    await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
}
