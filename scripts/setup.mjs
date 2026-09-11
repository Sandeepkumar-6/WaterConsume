import { existsSync, writeFileSync, readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
// Cloud deployments must supply stable secrets; never generate local defaults there.
if (process.env.NODE_ENV === "production") {
  console.log("Production uses the hosting provider's environment variables.");
  process.exit(0);
}
process.chdir(fileURLToPath(new URL("..", import.meta.url)));
const randomPassword = () => `Demo-${randomBytes(12).toString("base64url")}!9a`;
if (!existsSync("server/.env")) {
  const serverEnv = readFileSync("server/.env.example", "utf8")
    .replace(
      "replace_with_a_random_secret_at_least_32_characters",
      randomBytes(48).toString("hex"),
    )
    .replace("replace_with_a_demo_admin_password", randomPassword())
    .replace("replace_with_a_demo_staff_password", randomPassword());
  writeFileSync("server/.env", serverEnv);
  console.log("Created server/.env with a random local JWT secret.");
} else {
  let serverEnv = readFileSync("server/.env", "utf8");
  const additions = [];
  if (!/^SEED_ADMIN_PASSWORD=/m.test(serverEnv))
    additions.push(`SEED_ADMIN_PASSWORD=${randomPassword()}`);
  if (!/^SEED_STAFF_PASSWORD=/m.test(serverEnv))
    additions.push(`SEED_STAFF_PASSWORD=${randomPassword()}`);
  if (additions.length) {
    serverEnv = `${serverEnv.trimEnd()}\n${additions.join("\n")}\n`;
    writeFileSync("server/.env", serverEnv);
    console.log(
      "Added random demo seed passwords to server/.env; their values were not printed.",
    );
  }
}
if (!existsSync("client/.env"))
  writeFileSync("client/.env", readFileSync("client/.env.example"));
console.log("Environment ready. Existing configuration was preserved.");
