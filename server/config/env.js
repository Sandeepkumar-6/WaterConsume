import dotenv from "dotenv";
import { fileURLToPath } from "node:url";
dotenv.config({
  path: fileURLToPath(new URL("../.env", import.meta.url)),
  quiet: true,
});
export function validateEnv() {
  const production = process.env.NODE_ENV === "production";
  const port = process.env.PORT || "5000";
  if (!/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65535)
    throw new Error("PORT must be a number from 1 to 65535 in server/.env.");
  try {
    const origin = new URL(frontendOrigin());
    if (
      !["http:", "https:"].includes(origin.protocol) ||
      origin.pathname !== "/" ||
      origin.search ||
      origin.hash ||
      origin.username ||
      origin.password
    )
      throw new Error();
    if (
      production &&
      (origin.protocol !== "https:" || isLocalHost(origin.hostname))
    )
      throw new Error();
  } catch {
    throw new Error(
      "FRONTEND_URL / CLIENT_ORIGIN must be an HTTP(S) origin without a path; production requires FRONTEND_URL with a public HTTPS origin.",
    );
  }
  if (!process.env.MONGO_URI)
    throw new Error(
      "MONGO_URI is missing. Run npm run setup or configure server/.env.",
    );
  try {
    const mongo = new URL(process.env.MONGO_URI);
    const database = decodeURIComponent(mongo.pathname.slice(1));
    const isApplicationDatabase = database === "smart_water_portal";
    const isIsolatedTestDatabase = /^smart_water_portal_(?:test|e2e)_\d+$/.test(
      database,
    );
    if (
      !["mongodb:", "mongodb+srv:"].includes(mongo.protocol) ||
      (!isApplicationDatabase && !isIsolatedTestDatabase)
    )
      throw new Error();
    if (production && isLocalHost(mongo.hostname)) throw new Error();
  } catch {
    throw new Error(
      "MONGO_URI must use the smart_water_portal database (isolated timestamped test databases are allowed for automated tests). Production must use a remote database.",
    );
  }
  if (
    !process.env.JWT_SECRET ||
    process.env.JWT_SECRET.length < 32 ||
    process.env.JWT_SECRET.startsWith("replace_with")
  )
    throw new Error(
      "Set JWT_SECRET to a random secret of at least 32 characters in server/.env.",
    );
  if (
    !/^\d+$/.test(process.env.TRUST_PROXY_HOPS || "0") ||
    Number(process.env.TRUST_PROXY_HOPS || 0) > 10
  )
    throw new Error("TRUST_PROXY_HOPS must be an integer from 0 to 10.");
}

function isLocalHost(host) {
  return (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host === "[::1]" ||
    host === "0.0.0.0" ||
    host.startsWith("127.")
  );
}

export function frontendOrigin() {
  if (process.env.NODE_ENV === "production" && !process.env.FRONTEND_URL)
    throw new Error("FRONTEND_URL is required in production.");
  return (
    process.env.FRONTEND_URL ||
    process.env.CLIENT_ORIGIN ||
    "http://localhost:5173"
  );
}

export function allowedOrigins() {
  const origin = new URL(frontendOrigin());
  const origins = [origin.origin];
  if (
    process.env.NODE_ENV !== "production" &&
    ["localhost", "127.0.0.1"].includes(origin.hostname)
  ) {
    origin.hostname =
      origin.hostname === "localhost" ? "127.0.0.1" : "localhost";
    origins.push(origin.origin);
  }
  return origins;
}
