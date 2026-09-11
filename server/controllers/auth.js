import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { User } from "../models/index.js";
import { fail } from "../utils/validation.js";
import { userData } from "../services/users.js";
export async function register(req, res) {
  if (process.env.NODE_ENV === "production" && req.body?.role === "ADMIN")
    fail(
      "Administrator accounts must be created by an existing administrator.",
      403,
    );
  const data = await userData(req.body || {}, { registration: true });
  const user = await User.create(data);
  res.status(201).json(user);
}
export async function login(req, res) {
  const { email, password } = req.body || {};
  if (typeof email !== "string" || typeof password !== "string")
    fail("Email and password are required.");
  const user = await User.findOne({ email: email.trim().toLowerCase() }).select(
    "+password",
  );
  if (!user || !(await bcrypt.compare(password, user.password)))
    fail("Invalid email or password.", 401);
  if (user.status !== "ACTIVE")
    fail("Your account is inactive. Contact an administrator.", 403);
  const token = jwt.sign({}, process.env.JWT_SECRET, {
    subject: String(user._id),
    expiresIn: "8h",
    algorithm: "HS256",
  });
  res.json({ token, user });
}
export async function me(req, res) {
  await req.user.populate("assignedArea");
  res.json(req.user);
}
