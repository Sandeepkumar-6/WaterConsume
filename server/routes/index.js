import { Router } from "express";
import rateLimit from "express-rate-limit";
import { authenticate, admin } from "../middleware/auth.js";
import * as auth from "../controllers/auth.js";
import * as r from "../controllers/resources.js";
import * as a from "../controllers/analytics.js";
const router = Router();
router.post(
  "/auth/register",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 30,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: {
      success: false,
      message: "Too many registration attempts. Please try again later.",
    },
  }),
  auth.register,
);
router.post(
  "/auth/login",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 100,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: {
      success: false,
      message: "Too many sign-in attempts. Please try again later.",
    },
  }),
  auth.login,
);
router.use(authenticate);
router.get("/auth/me", auth.me);
router.route("/areas").get(r.listAreas).post(admin, r.saveArea);
router
  .route("/areas/:id")
  .get(r.getArea)
  .put(admin, r.saveArea)
  .delete(admin, r.deleteArea);
router.patch("/areas/:id/status", admin, r.updateAreaStatus);
router.delete("/areas/:id/permanent", admin, r.hardDeleteArea);
router.route("/users").get(admin, r.listUsers).post(admin, r.saveUser);
router
  .route("/users/:id")
  .get(admin, r.getUser)
  .put(admin, r.saveUser)
  .delete(admin, r.deleteUser);
router.patch("/users/:id/status", admin, r.updateUserStatus);
router.delete("/users/:id/permanent", admin, r.hardDeleteUser);
router.route("/consumption").get(r.listConsumption).post(r.saveConsumption);
router
  .route("/consumption/:id")
  .get(r.getConsumption)
  .put(admin, r.saveConsumption)
  .delete(admin, r.deleteConsumption);
router.get("/dashboard", a.dashboard);
router.get("/monitoring", admin, a.monitoring);
router.get("/reports", admin, a.reports);
router.get("/alerts", r.listAlerts);
router.put("/alerts/:id", admin, r.updateAlert);
router.patch("/alerts/:id/status", admin, r.updateAlert);
export default router;
