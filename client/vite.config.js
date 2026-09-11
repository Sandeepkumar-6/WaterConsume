import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  const value =
    env.VITE_API_URL || (command === "serve" ? "http://localhost:5000" : "");
  let api;
  try {
    api = new URL(value);
    if (
      !["http:", "https:"].includes(api.protocol) ||
      api.username ||
      api.password ||
      api.search ||
      api.hash ||
      !["/", "/api", "/api/"].includes(api.pathname)
    )
      throw new Error();
    const hostedBuild =
      command === "build" &&
      (mode === "production" || process.env.VERCEL === "1");
    if (
      hostedBuild &&
      (api.protocol !== "https:" ||
        api.hostname === "localhost" ||
        api.hostname.endsWith(".localhost") ||
        api.hostname.startsWith("127.") ||
        ["[::1]", "0.0.0.0"].includes(api.hostname))
    )
      throw new Error();
  } catch {
    throw new Error(
      "Set VITE_API_URL to the backend HTTP(S) origin, optionally ending in /api. Production builds require a public HTTPS URL. For a local preview use npm run build -w client -- --mode development.",
    );
  }
  return {
    plugins: [react()],
    define: {
      "import.meta.env.VITE_API_URL": JSON.stringify(`${api.origin}/api`),
    },
    server: { port: 5173, strictPort: true },
  };
});
