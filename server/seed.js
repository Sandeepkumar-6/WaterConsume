import { readFile } from "node:fs/promises";
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import { validateEnv } from "./config/env.js";
import { connectDB } from "./config/db.js";
import { User, Area, Consumption, Alert, AuditLog } from "./models/index.js";
import { recalculateAlerts } from "./services/limits.js";
import { today } from "./utils/validation.js";

// Seeding decides when indexes are safe to build. This lets --reset remove
// malformed imported demo records before unique indexes are created.
mongoose.set("autoIndex", false);

const dataDirectory = new URL("./data/", import.meta.url);
const reset = process.argv.includes("--reset");

async function loadJson(name) {
  const contents = await readFile(new URL(name, dataDirectory), "utf8");
  return JSON.parse(contents.replace(/^\uFEFF/, ""));
}

function seedPassword(variable) {
  const password = process.env[variable];
  if (
    !password ||
    password.startsWith("replace_with_") ||
    password.length < 8 ||
    Buffer.byteLength(password) > 72
  )
    throw new Error(
      `${variable} must be configured in server/.env (8 to 72 bytes). Run npm run setup to generate it.`,
    );
  if (
    process.env.NODE_ENV === "production" &&
    (password.length < 12 || ["Admin@123", "Staff@123"].includes(password))
  )
    throw new Error(
      `${variable} must be a unique production password of at least 12 characters.`,
    );
  return password;
}

function dateFromOffset(dayOffset) {
  if (!Number.isInteger(dayOffset) || dayOffset < 0 || dayOffset > 365)
    throw new Error(
      "Consumption seed dayOffset must be an integer from 0 to 365.",
    );
  const result = new Date(`${today()}T12:00:00.000Z`);
  result.setUTCDate(result.getUTCDate() - dayOffset);
  return result.toISOString().slice(0, 10);
}

async function clearPortalCollections() {
  const database = mongoose.connection.name;
  if (
    database !== "smart_water_portal" &&
    !/^smart_water_portal_(?:test|e2e)_\d+$/.test(database)
  )
    throw new Error(
      `Reset refused: connected database is ${database}, not a permitted portal database.`,
    );
  await Alert.deleteMany({});
  await Consumption.deleteMany({});
  await AuditLog.deleteMany({});
  await Area.deleteMany({});
  await User.deleteMany({});
}

async function prepareCollections() {
  for (const model of [User, Area, Consumption, Alert, AuditLog]) {
    await model.createCollection();
    // Remove obsolete model-managed indexes from older demo schemas before
    // building the indexes declared by the current schemas.
    await model.syncIndexes();
  }
}

async function validateSeedInputs() {
  const [users, areas, records] = await Promise.all([
    loadJson("users.json"),
    loadJson("areas.json"),
    loadJson("consumption.json"),
  ]);
  if (![users, areas, records].every(Array.isArray))
    throw new Error("Every seed data file must contain a JSON array.");
  const emails = new Set(users.map((user) => user.email));
  const codes = new Set(areas.map((area) => area.code));
  for (const user of users) {
    seedPassword(user.passwordEnv);
    if (user.assignedAreaCode && !codes.has(user.assignedAreaCode))
      throw new Error(`Unknown assigned area code: ${user.assignedAreaCode}.`);
  }
  for (const area of areas)
    if (area.responsibleStaffEmail && !emails.has(area.responsibleStaffEmail))
      throw new Error(
        `Unknown responsible staff email: ${area.responsibleStaffEmail}.`,
      );
  for (const record of records) {
    if (!codes.has(record.areaCode) || !emails.has(record.recordedByEmail))
      throw new Error(
        `Unresolved consumption relationship: ${record.areaCode}/${record.recordedByEmail}.`,
      );
    dateFromOffset(record.dayOffset);
  }
}

async function populate() {
  const [userSeeds, areaSeeds, consumptionSeeds] = await Promise.all([
    loadJson("users.json"),
    loadJson("areas.json"),
    loadJson("consumption.json"),
  ]);
  const passwordVariables = new Set(userSeeds.map((user) => user.passwordEnv));
  const passwordHashes = new Map();
  for (const variable of passwordVariables)
    passwordHashes.set(variable, await bcrypt.hash(seedPassword(variable), 12));

  const users = await User.insertMany(
    userSeeds.map(({ assignedAreaCode, passwordEnv, ...user }) => ({
      ...user,
      password: passwordHashes.get(passwordEnv),
    })),
  );
  const userByEmail = new Map(users.map((user) => [user.email, user]));

  const areas = await Area.insertMany(
    areaSeeds.map(({ responsibleStaffEmail, ...area }) => ({
      ...area,
      responsibleStaff: responsibleStaffEmail
        ? userByEmail.get(responsibleStaffEmail)?._id
        : null,
    })),
  );
  const areaByCode = new Map(areas.map((area) => [area.code, area]));

  for (const userSeed of userSeeds) {
    if (!userSeed.assignedAreaCode) continue;
    const user = userByEmail.get(userSeed.email);
    const area = areaByCode.get(userSeed.assignedAreaCode);
    if (!user || !area)
      throw new Error(
        `Unresolved user area seed relationship for ${userSeed.email}.`,
      );
    user.assignedArea = area._id;
    await user.save();
  }

  const records = consumptionSeeds.map(
    ({ areaCode, recordedByEmail, dayOffset, ...record }) => {
      const area = areaByCode.get(areaCode);
      const recordedBy = userByEmail.get(recordedByEmail);
      if (!area || !recordedBy)
        throw new Error(
          `Unresolved consumption relationship: ${areaCode}/${recordedByEmail}.`,
        );
      return {
        ...record,
        area: area._id,
        recordedBy: recordedBy._id,
        date: dateFromOffset(dayOffset),
      };
    },
  );
  await Consumption.insertMany(records);
  for (const area of areas) await recalculateAlerts(area._id);

  // Keep examples of each supported alert lifecycle state without bypassing
  // the normal alert-generation logic above.
  const generatedAlerts = await Alert.find().sort({ period: -1, area: 1 });
  if (generatedAlerts[1]) {
    generatedAlerts[1].status = "READ";
    await generatedAlerts[1].save();
  }
  if (generatedAlerts[2]) {
    generatedAlerts[2].status = "RESOLVED";
    generatedAlerts[2].resolvedAt = new Date();
    generatedAlerts[2].resolvedBy = userByEmail.get(
      "admin@smartwater.demo",
    )._id;
    generatedAlerts[2].autoResolved = false;
    await generatedAlerts[2].save();
  }

  return {
    users: await User.countDocuments(),
    areas: await Area.countDocuments(),
    consumptions: await Consumption.countDocuments(),
    alerts: await Alert.countDocuments(),
  };
}

try {
  if (reset && process.env.NODE_ENV === "production")
    throw new Error(
      "Seed reset is disabled in production. Existing data was not changed.",
    );
  validateEnv();
  await connectDB();
  const existing = await Promise.all([
    User.countDocuments(),
    Area.countDocuments(),
    Consumption.countDocuments(),
    Alert.countDocuments(),
    AuditLog.countDocuments(),
  ]);
  if (reset) {
    await validateSeedInputs();
    await clearPortalCollections();
    await prepareCollections();
    const counts = await populate();
    console.log(
      `Demo reset complete: ${counts.users} users, ${counts.areas} areas, ${counts.consumptions} consumption records, and ${counts.alerts} calculated alerts.`,
    );
  } else if (existing.some(Boolean)) {
    console.log(
      `Seed skipped: ${mongoose.connection.name} already contains ${existing[0]} users, ${existing[1]} areas, ${existing[2]} consumption records, ${existing[3]} alerts, and ${existing[4]} audit logs. No records were changed. Use npm run seed:reset only when you intentionally want to replace all portal demo data.`,
    );
  } else {
    await validateSeedInputs();
    await prepareCollections();
    const counts = await populate();
    console.log(
      `Seed complete: ${counts.users} users, ${counts.areas} areas, ${counts.consumptions} consumption records, and ${counts.alerts} calculated alerts.`,
    );
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
