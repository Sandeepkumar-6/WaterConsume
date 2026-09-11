# Deploy the existing Smart Water portal

The target is Browser → Vercel React frontend → HTTPS Render API → MongoDB Atlas. No hosted services have been created or verified from this workspace. See [DEPLOYMENT-STATUS.md](DEPLOYMENT-STATUS.md) for current evidence and blockers.

## 1. Repository and existing application

This is an npm-workspace monorepo. `client/` is React/Vite and `server/` is Express/Mongoose. The root `package-lock.json` covers both workspaces. Use Node 24.x on both hosts.

| Component | Actual location |
| --- | --- |
| Manifests | `package.json`, `client/package.json`, `server/package.json` |
| Server entry / Express app | `server/server.js`, `server/app.js` |
| Environment / database connection | `server/config/env.js`, `server/config/db.js` |
| Models | `server/models/index.js`: User, Area, Consumption, Alert, AuditLog |
| Controllers | `server/controllers/auth.js`, `resources.js`, `analytics.js` |
| API routes | `server/routes/index.js`, mounted at `/api` |
| Authentication / error middleware | `server/middleware/auth.js`, `errors.js` |
| Business services | `server/services/users.js`, `limits.js`, `analytics.js` |
| Central frontend API | `client/src/services/api.js`; URL validation/normalization in `client/vite.config.js` |
| Session / route guards | `client/src/context/AuthContext.jsx`, `client/src/components/Layout.jsx` |
| BrowserRouter | `client/src/App.jsx` |

The actual browser paths are `/`, `/login`, `/register`, `/dashboard`, `/consumption`, `/alerts`, `/profile`, `/areas`, `/users`, `/monitoring`, and `/reports`. The last four are admin-only. `client/vercel.json` supplies the Vite SPA fallback so these paths load on direct navigation and refresh. See [Vercel's Vite guide](https://vercel.com/docs/frameworks/frontend/vite).

There are no vehicles, policies, claims, surveyors, file uploads, local document storage, or external asset services in this project. Reports download as CSV in the browser. Cloudinary and persistent upload disks are unnecessary.

**GitHub repository:** [Sandeepkumar-6/WaterConsume](https://github.com/Sandeepkumar-6/WaterConsume). It was confirmed empty before this prepared project was initialized on the `main` branch, so there was no remote history to overwrite or merge.

Before each deployment commit, review the repository with:

```powershell
git status --short
git remote -v
git branch --show-current
git ls-files -- '.env' 'client/.env*' 'server/.env*' '*node_modules*' '*dist*' '*.archive*' '*.bson*'
```

Only `.env.example` templates should appear among environment files. If real environment files are already tracked, remove them from the index with `git rm --cached -- client/.env server/.env` (only the paths actually tracked), leaving local files intact. Rotate any secrets that reached GitHub. Review the staged diff before committing and pushing to the existing deployment branch. No force push, history rewrite, or visibility change is needed. Repository history could not be audited here.

## 2. Preserve and secure the current data

Read-only inventory during preparation:

| Collection | Records |
| --- | ---: |
| users | 6 (1 ADMIN, 5 STAFF) |
| areas | 7 |
| consumptions | 210 |
| alerts | 23 |
| auditlogs | 0 |

Database: `smart_water_portal` on local MongoDB. No application records were changed or deleted during preparation. Automated tests create and remove their own uniquely named databases.

**Five existing accounts match the demo passwords previously printed in the README.** Before exporting, start the local app (`npm run dev`), sign in as the existing administrator, open **Team members**, and edit each affected account to use a unique strong password. Update the administrator too. Preserve account IDs, roles, assignments, and historical records. Store the new passwords privately. Changing `SEED_*` values alone does not update accounts already in MongoDB. Do not expose the old database to the internet before this is complete.

Public registration is STAFF-only in production. The UI omits the administrator option and the API rejects a forged `role: ADMIN` registration with 403. Existing administrators keep all their management capabilities. Development retains the original role-selection flow.

## 3. MongoDB Atlas account and database

1. Sign in or create an account at [MongoDB Atlas](https://cloud.mongodb.com/). Account creation, login, and credentials require you; do not send passwords in chat.
2. Create/select a project such as `smart-water-portal`, then create a cluster. Choose a region close to the Render region. Atlas Free is suitable for a small demonstration; select a tier with suitable backups and availability for institutional use. Follow [Atlas cluster creation](https://www.mongodb.com/docs/atlas/tutorial/deploy-free-tier-cluster/).
3. Open **Database Access / Database Users → Add New Database User**. Choose password authentication, use a username such as `smart_water_app`, and generate/store a strong unique password. Grant `readWrite` on `smart_water_portal` and restrict access to the intended cluster. This is a database account, separate from your Atlas login. See [database users](https://www.mongodb.com/docs/atlas/security-add-mongodb-users/).
4. In **Network Access / IP Access List**, add your current public IP for migration. Once the Render service exists, add every outbound IP/CIDR shown in that service's **Connect → Outbound** section. Keep the list restricted; Vercel does not connect directly to MongoDB. Remove your temporary migration IP when done. See [Atlas IP access lists](https://www.mongodb.com/docs/atlas/security/ip-access-list/) and [Render outbound addresses](https://render.com/docs/outbound-ip-addresses).
5. Open the cluster's **Connect → Drivers**, choose Node.js, and copy its connection string. Replace the user/password placeholders and set the database path to **`smart_water_portal`**. URL-encode special characters in username/password. Keep Atlas's connection options, including retryable writes. See [Atlas driver connections](https://www.mongodb.com/docs/atlas/driver-connection/).

Pattern only (never commit the real value):

```text
mongodb+srv://<database-user>:<encoded-password>@<cluster-host>/smart_water_portal?retryWrites=true&w=majority
```

The real URI goes into **Render service → Environment → MONGO_URI**. It must never be a Vite variable or enter GitHub. Collections are created by migration or application writes; an empty database need not be manually pre-created.

## 4. Exact migration commands (PowerShell)

`mongodump` and `mongorestore` are not currently on this machine's PATH. Install the [MongoDB Database Tools](https://www.mongodb.com/docs/database-tools/installation/installation-windows/), add their `bin` directory to PATH, reopen PowerShell, and verify both commands with `--version`. Check source/target MongoDB version compatibility before restoring.

Stop application writes after rotating passwords. Leave MongoDB running. Keep the API stopped until the final dump is complete; these collections contain cross-references that must be copied together. Save the dump outside the repository and OneDrive:

```powershell
$backupDirectory = Join-Path $env:LOCALAPPDATA 'SmartWaterBackups'
New-Item -ItemType Directory -Force -Path $backupDirectory | Out-Null
$archivePath = Join-Path $backupDirectory ("smart-water-{0}.archive.gz" -f (Get-Date -Format 'yyyyMMdd-HHmmss'))
mongodump --uri='mongodb://localhost:27017/smart_water_portal' --archive="$archivePath" --gzip
if ($LASTEXITCODE -ne 0) { throw 'Backup failed. Do not proceed to restore.' }
Get-Item -LiteralPath $archivePath | Select-Object FullName,Length
```

Restore into a **new, empty** `smart_water_portal` database in Atlas, before starting the hosted API. Replace `YOUR_CLUSTER_HOST` with the host copied from Atlas; the tool prompts for the database password, keeping it out of shell history:

```powershell
mongorestore --uri='mongodb+srv://YOUR_CLUSTER_HOST/smart_water_portal?retryWrites=true&w=majority' --username='smart_water_app' --authenticationDatabase='admin' --nsInclude='smart_water_portal.*' --archive="$archivePath" --gzip --stopOnError
if ($LASTEXITCODE -ne 0) { throw 'Restore failed. Inspect the error before continuing.' }
```

There is deliberately no `--drop`. If restore partially fails, do not repeatedly import into a partially populated target or erase either database. Inspect what was restored and recover from the saved archive into a verified empty target. Keep the local source and archive until production acceptance. Dumps contain private user records and password hashes; never upload them to GitHub. See [Atlas migration with mongorestore](https://www.mongodb.com/docs/atlas/import/mongorestore/) and [mongorestore reference](https://www.mongodb.com/docs/database-tools/mongorestore/).

Use Atlas **Browse Collections** or Compass to compare collection counts with a fresh local inventory after password rotation. IDs, password hashes, references, consumption dates, and alerts must be preserved. Account edits will add audit logs, so the earlier count of zero is not a required final count.

### Optional seed, only for a separate empty demonstration database

The existing `npm run seed` already refuses to insert if any application collection contains data. Run it once, with no API or second seed process running. A repeated run skips insertion and does not overwrite records. Do not seed over the migrated database. Production reset is blocked.

If choosing an empty demonstration instead of migrating, privately configure Atlas `MONGO_URI`, a random `JWT_SECRET`, `FRONTEND_URL`, `NODE_ENV=production`, and strong `SEED_ADMIN_PASSWORD` / `SEED_STAFF_PASSWORD`, then run `npm run seed`. You can do this from a trusted local terminal with those values loaded privately into its environment. The seed creates `admin@smartwater.demo`, four staff, seven areas, and 210 consumption records. Use the password you supplied to sign in. Remove seed passwords from the hosting environment afterward; they are not required to run the API. Change seeded accounts to individual passwords before general use. Preserve the existing local database even if you choose a separate demonstration deployment.

## 5. Render backend

Render is a direct fit for this single-process Express application and does not need Docker. Its listener now uses `0.0.0.0` and the host-provided `PORT`. See [Render web services](https://render.com/docs/web-services).

1. Sign in to [Render](https://dashboard.render.com/), choose **New → Web Service → Git Provider**, authorize access to the specific repository, and select **`Sandeepkumar-6/WaterConsume`**, branch **`main`**.
2. Configure the service:

| Setting | Value |
| --- | --- |
| Name | Choose an available name, e.g. `smart-water-api` |
| Runtime | Node |
| Branch | `main` |
| Root Directory | **Leave blank (repository root)** |
| Build Command | `npm ci --workspace server --include-workspace-root=false --omit=dev` |
| Start Command | `npm start -w server` |
| Health Check Path | `/api/health` |
| Instances | **1**; no autoscaling or cluster/PM2 workers |

Although backend source is in `server/`, Render must build from the repository root: the lockfile and `scripts/setup.mjs` are outside `server/`. Render excludes files outside a configured root directory. See [Render monorepo support](https://render.com/docs/monorepo-support).

3. In **Environment**, enter:

| Variable | Value |
| --- | --- |
| `NODE_ENV` | `production` |
| `NODE_VERSION` | `24` (Node 24.x; root package engines also specify 24.x) |
| `MONGO_URI` | Your real Atlas URI, entered privately here |
| `JWT_SECRET` | New random secret, at least 32 characters; keep stable across restarts |
| `FRONTEND_URL` | Actual Vercel production origin, e.g. `https://YOUR-PROJECT.vercel.app` |
| `TRUST_PROXY_HOPS` | `1` for Render's reverse proxy |
| `PORT` | Let Render provide this; do not hard-code it |

Generate a fresh JWT secret into the Windows clipboard without displaying it:

```powershell
node -e "process.stdout.write(require('node:crypto').randomBytes(48).toString('hex'))" | Set-Clipboard
```

Paste it only into Render's `JWT_SECRET` field and save it privately. Do not reuse the local development secret. JWTs use HS256, expire after eight hours, travel in `Authorization: Bearer …`, and remain in tab-scoped session storage across refresh. CORS allows the exact configured origin. Proxy trust keeps the existing login/registration rate limiter scoped to clients; do not set unrestricted proxy trust. If another proxy is later added, verify its trusted hop count using [express-rate-limit's proxy guide](https://express-rate-limit.mintlify.app/guides/troubleshooting-proxy-issues).

If Vercel has not assigned a production domain yet, temporarily use `https://deployment-pending.invalid` as `FRONTEND_URL`. This grants no usable browser origin; replace it with the real Vercel URL before testing the app. Health checks do not need frontend access.

4. Choose a plan. For continuous production availability select an always-on paid instance; choose Free only if demo cold starts are acceptable. No plan has been purchased here. Review [Render Free limitations](https://render.com/docs/free).
5. Create the service, copy its outbound addresses into Atlas Network Access, and deploy/redeploy after access and migration are ready. Do **not** run the seed or reset automatically during build/start.
6. Copy the actual `https://…onrender.com` URL from the service dashboard. Do not assume the example name is available. Open `https://ACTUAL-BACKEND/api/health`; require HTTP 200 and `{"success":true,"database":"connected"}`. A 503 or failed startup requires fixing Atlas credentials/network access before continuing.

The application serializes mutations inside one process. Keep one instance and schedule deployments during a quiet period without active writes; overlapping instances during a rolling deploy can bypass that in-process serialization. Horizontal scaling or highly available multi-instance operation requires database-level concurrency work beyond this deployment preparation.

## 6. Vercel frontend

1. Sign in to [Vercel](https://vercel.com/new). Import **`Sandeepkumar-6/WaterConsume`**, authorize it if prompted, and select production branch **`main`**.
2. Set these project values:

| Setting | Value |
| --- | --- |
| Root Directory | `client` |
| Include source files outside Root Directory | Enabled, so npm workspaces can access the root manifests/lockfile |
| Framework Preset | Vite |
| Node.js version | 24.x |
| Install Command | `cd .. && npm ci` |
| Build Command | `npm run build` |
| Output Directory | `dist` |
| Production environment variable | `VITE_API_URL=https://ACTUAL-BACKEND.onrender.com` |

The install command runs from `client/` then installs the monorepo at its root. The build command runs in `client/`. See [Vercel monorepos](https://vercel.com/docs/monorepos).

`VITE_API_URL` accepts the backend origin with or without `/api`; the central Vite configuration normalizes it to exactly one `/api`. Do not set it to the frontend URL. A production build rejects a missing, localhost, credential-bearing, or non-HTTPS URL. Your ignored local `.env` is not uploaded. Database credentials and JWT secrets do not belong anywhere in Vercel for this static frontend.

3. Deploy and copy the actual production URL. Set Render's `FRONTEND_URL` to that exact origin (no route or query), save, and allow the API to redeploy. Changing `VITE_API_URL` also requires a new frontend deployment, because Vite replaces it at build time.
4. Production CORS does not allow arbitrary Vercel preview domains. Test the production deployment. For previews, use a separate backend/database with that preview origin configured explicitly; do not wildcard every `vercel.app` site.

## 7. Local compatibility and verification commands

From the repository root:

```powershell
npm.cmd install
npm.cmd run setup
npm.cmd run dev
```

The local settings remain `MONGO_URI=mongodb://localhost:27017/smart_water_portal`, `FRONTEND_URL=http://localhost:5173` (legacy `CLIENT_ORIGIN` still works), `PORT=5000`, `TRUST_PROXY_HOPS=0`, and `VITE_API_URL=http://localhost:5000`. Keep `NODE_ENV` unset for local development. All existing local `.env` values were preserved.

Run tests with MongoDB running:

```powershell
npm.cmd test
npm.cmd run test:e2e
```

For a production build, use the **actual** backend URL in a temporary terminal:

```powershell
$env:VITE_API_URL = 'https://ACTUAL-BACKEND.onrender.com'
npm.cmd run build
Remove-Item Env:VITE_API_URL
```

For local preview with a local backend, explicitly build in development mode:

```powershell
npm.cmd run build -w client -- --mode development
npm.cmd run preview -w client -- --port 5173
```

The temporary example HTTPS address used during preparation was only a build input, never a deployed service. Rebuild with your actual URL before publishing.

## 8. Required live acceptance checks

These remain unperformed until the actual accounts, GitHub branch, Atlas data, and hosted URLs are available. Local tests do not prove a cloud deployment works.

1. Open the Vercel production URL. In DevTools Network, check HTTPS API requests go only to the actual Render origin, with no localhost, mixed-content, or CORS errors. Check Console for errors.
2. Register a disposable STAFF account. Confirm its MongoDB record in Atlas; verify the stored password is a bcrypt hash, not plaintext. Login, refresh `/dashboard`, and open `/profile`. Verify logout clears the session and `/dashboard` redirects back to login.
3. Try a public `role: ADMIN` registration and require 403. As staff, verify admin pages redirect and `/api/users`, `/api/reports`, and other admin APIs return 403 even with a valid staff JWT. Without a JWT, require 401. Inactive users must lose access.
4. Login as the migrated admin with its new password. Confirm the migrated buildings, users, 210 consumption records (or your updated count), and alerts remain. Create an explicitly named test building with a 5000 L daily / 100000 L monthly limit. Add 3000 L for today: NORMAL. Add 1500 L: WARNING. Add 1000 L: EXCEEDED and a daily alert. Verify dashboard, monitoring, reports, filters, CSV export, and alert resolution.
5. Create/assign a test staff account to that building. Staff may read and add consumption only there. Confirm status changes, consumption edits/deletes, and limits recalculate alerts. Keep historical records intact; use disposable records for destructive checks.
6. Directly open and refresh every actual browser path listed above. Sign out and verify protected navigation again. Confirm the tab session survives ordinary refresh but expires with the JWT.
7. Restart/redeploy the API during a quiet period. Recheck health and saved data. Inspect Render logs for database, proxy/rate-limit, or startup errors. Compare Atlas counts and relationships after the migration.
8. Remove or deactivate test accounts and records only after reviewing which were created for this check. Record the real frontend URL, backend URL, database, GitHub repository, branch, deployment IDs, and results in `DEPLOYMENT-STATUS.md`.

Do not declare the application live until these checks pass. If login, authorization, credentials, or billing approval is needed at any provider, complete that step in your own account before continuing.
