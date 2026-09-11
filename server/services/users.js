import bcrypt from "bcrypt";
import { Area } from "../models/index.js";
import { text, choice, id, fail } from "../utils/validation.js";

export async function userData(
  body,
  { creating = true, registration = false } = {},
) {
  const data = {
    name: text(body.name, "Name"),
    email: text(body.email, "Email", 200).toLowerCase(),
    role: choice(
      registration ? body.role : body.role || "STAFF",
      ["ADMIN", "STAFF"],
      "role",
    ),
    status: registration
      ? "ACTIVE"
      : choice(body.status || "ACTIVE", ["ACTIVE", "INACTIVE"], "status"),
    assignedArea: registration ? null : body.assignedArea || null,
  };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email))
    fail("Provide a valid email address.");
  if (data.role === "ADMIN") data.assignedArea = null;
  if (data.status === "INACTIVE") data.assignedArea = null;
  if (data.assignedArea) {
    const area = await Area.findById(id(data.assignedArea));
    if (!area || area.status !== "ACTIVE") fail("Select an active area.");
  }
  if (creating || body.password) {
    if (
      typeof body.password !== "string" ||
      body.password.length < 8 ||
      Buffer.byteLength(body.password) > 72
    )
      fail("Password must be at least 8 characters and at most 72 bytes.");
    if (registration && body.password !== body.confirmPassword)
      fail("Passwords must match.");
    data.password = await bcrypt.hash(body.password, 12);
  }
  return data;
}
