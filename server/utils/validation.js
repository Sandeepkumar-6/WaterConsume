import mongoose from "mongoose";
export const fail = (message, status = 400) => {
  const e = new Error(message);
  e.status = status;
  throw e;
};
export function id(value) {
  if (typeof value !== "string" || !mongoose.isValidObjectId(value))
    fail("Invalid resource ID.");
  return value;
}
export function text(value, label, max = 100) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > max)
    fail(`${label} is required and must be at most ${max} characters.`);
  return value.trim();
}
export function positive(value, label) {
  if (
    !["number", "string"].includes(typeof value) ||
    !Number.isFinite(Number(value)) ||
    Number(value) < 0.01 ||
    Number(value) > 1e12
  )
    fail(`${label} must be greater than zero (minimum 0.01).`);
  return Number(value);
}
export function choice(value, allowed, label) {
  if (!allowed.includes(value)) fail(`Invalid ${label}.`);
  return value;
}
export function date(value) {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    !Number.isFinite(Date.parse(value)) ||
    new Date(value).toISOString().slice(0, 10) !== value
  )
    fail("Provide a valid date in YYYY-MM-DD format.");
  return value;
}
export function dateRange(query) {
  const result = {};
  if (query.startDate) result.$gte = date(query.startDate);
  if (query.endDate) result.$lte = date(query.endDate);
  if (result.$gte && result.$lte && result.$gte > result.$lte)
    fail("Start date must be before end date.");
  return result;
}
export const today = (now = new Date()) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
export const escapeRegex = (value) =>
  String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
