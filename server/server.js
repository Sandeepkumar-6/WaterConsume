import mongoose from "mongoose";
import { validateEnv } from "./config/env.js";
import { connectDB } from "./config/db.js";
try {
  validateEnv();
  const { default: app } = await import("./app.js");
  await connectDB();
  const port = Number(process.env.PORT || 5000);
  const server = app.listen(port, "0.0.0.0", () =>
    console.log(`Water portal API: listening on port ${port}`),
  );
  server.on("error", async (err) => {
    console.error(
      err.code === "EADDRINUSE"
        ? `Port ${port} is already in use. Stop the other backend before starting this one. Run only one npm run dev instance.`
        : `Server could not start: ${err.message}`,
    );
    await mongoose.disconnect();
    process.exitCode = 1;
  });
  let stopping = false;
  const shutdown = () => {
    if (stopping) return;
    stopping = true;
    server.close(async () => {
      await mongoose.disconnect();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 5000).unref();
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
