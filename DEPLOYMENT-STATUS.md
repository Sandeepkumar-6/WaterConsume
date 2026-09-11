# Deployment status — 11 September 2026

The Smart Water Portal is deployed and the production path from Vercel through Render to MongoDB Atlas has been verified.

| Component | Status | Production resource |
| --- | --- | --- |
| Frontend | **Live** | https://water-consume.vercel.app |
| Backend API | **Live** | https://waterconsume-1.onrender.com |
| Database | **Live** | MongoDB Atlas `SmartWaterCluster`, database `smart_water_portal` |
| Source | **Published** | `main` at https://github.com/Sandeepkumar-6/WaterConsume |

## Production configuration

- Vercel builds the Vite client with `VITE_API_URL=https://waterconsume-1.onrender.com`.
- Render runs the Express API in Singapore with `NODE_ENV=production`, Node 24, the private Atlas URI, a private JWT secret, `TRUST_PROXY_HOPS=1`, and `FRONTEND_URL=https://water-consume.vercel.app`.
- Atlas permits the two Render Singapore outbound ranges `74.220.52.0/24` and `74.220.60.0/24`.
- The local migration IP rule is temporary. Its expiry does not affect either deployed service.
- The unchanged local MongoDB database remains available as a backup.

## Verified behavior

- `GET https://waterconsume-1.onrender.com/api/health` returns HTTP 200 with `database: connected`.
- Production CORS preflight returns HTTP 204 and allows the exact Vercel origin.
- Atlas-backed administrator authentication and dashboard API access work through the public Render URL.
- The public frontend and a direct `/login` request both return HTTP 200.
- A headless Chrome production smoke test successfully logged in, opened the dashboard, refreshed the authenticated page, opened consumption, and redirected an anonymous `/dashboard` request to `/login`.
- The browser smoke test reported no page or console errors.
- Before deployment, 25 backend tests, 8 Playwright tests, and the production client build passed.
- Atlas contains the migrated records and indexes: 6 users, 7 areas, 210 consumption records, 23 alerts, and 0 audit logs.
- Previously published demo passwords are rejected. Production public registration can create staff accounts only.

## Operations

- Render's free instance can sleep during inactivity, so the first request can take 50 seconds or more.
- Keep the backend at one instance because business mutations are serialized within a single process.
- Vercel was deployed successfully with the CLI. Connecting the Vercel project to GitHub for automatic deployments still requires granting the Vercel GitHub app repository access; manual production deployment remains available with `vercel deploy --prod` from `client`.
- The earlier failed Oregon Render service can be removed after confirming the Singapore service `WaterConsume-1` is the active production service.
