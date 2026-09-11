import jwt from "jsonwebtoken";
import { User } from "../models/index.js";
import { fail } from "../utils/validation.js";
export async function authenticate(req, res, next) {
  const token = req.headers.authorization?.split(" ");
  if (token?.[0] !== "Bearer" || !token[1])
    fail("Please sign in to continue.", 401);
  let payload;
  try {
    payload = jwt.verify(token[1], process.env.JWT_SECRET, {
      algorithms: ["HS256"],
    });
  } catch {
    fail("Your session has expired. Please sign in again.", 401);
  }
  req.user = await User.findById(payload.sub);
  if (!req.user || req.user.status !== "ACTIVE")
    fail("This account is inactive or no longer exists.", 401);
  next();
}
export function admin(req, res, next) {
  if (req.user.role !== "ADMIN") fail("Administrator access is required.", 403);
  next();
}
export function areaScope(user, area) {
  if (user.role === "ADMIN") return area ? { area: area } : {};
  if (area && String(user.assignedArea) !== String(area))
    fail("You are not authorized to access this area.", 403);
  return { area: user.assignedArea || null };
}
