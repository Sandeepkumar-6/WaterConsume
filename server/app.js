import "./config/env.js";
import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import routes from "./routes/index.js";
import { errorHandler } from "./middleware/errors.js";
import { allowedOrigins } from "./config/env.js";
const app = express();
app.disable("x-powered-by");
app.set("trust proxy", Number(process.env.TRUST_PROXY_HOPS || 0));
app.use(cors({ origin: allowedOrigins() }));
app.use((req, res, next) => {
  res.set("X-Content-Type-Options", "nosniff");
  res.set("Cache-Control", "no-store");
  next();
});
app.use(express.json({ limit: "100kb" }));
app.get("/api/health", (req, res) =>
  res.status(mongoose.connection.readyState === 1 ? 200 : 503).json({
    success: mongoose.connection.readyState === 1,
    database:
      mongoose.connection.readyState === 1 ? "connected" : "unavailable",
  }),
);
app.use(
  "/api",
  (req, res, next) => {
    if (mongoose.connection.readyState !== 1)
      return res.status(503).json({
        success: false,
        message:
          "MongoDB is unavailable. Start MongoDB and check the database connection.",
      });
    next();
  },
  routes,
);
app.use((req, res) =>
  res.status(404).json({ success: false, message: "Endpoint not found." }),
);
app.use(errorHandler);
export default app;
