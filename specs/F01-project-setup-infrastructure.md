# F01: Project Setup & Infrastructure

| | |
|---|---|
| **Phase** | 1 |
| **Sprint** | Sprint 1 |
| **Assigned to** | All (then Dev E leads) |
| **Severity** | CRITICAL |
| **Depends on** | None |

## Summary

Set up the monorepo, Docker environment, CI/CD pipeline, and project scaffolding. This is the foundation everything else builds on.

## Tasks & Subtasks

### 1. Initialize monorepo structure

- [x] Create root folder with docker-compose.yml
- [x] Create client/ folder with Vite + React setup
- [x] Create server/ folder with Express setup
- [x] Create docs/ folder
- [x] Create `.env.example` at repo root with the following keys (no real secrets — placeholder values only):

  ```dotenv
  # App
  NODE_ENV=development
  PORT=3001
  TZ=Asia/Jerusalem
  FRONTEND_URL=http://localhost:5173

  # Database
  DATABASE_URL=postgresql://user:password@localhost:5432/time_reporting

  # JWT
  JWT_ACCESS_SECRET=changeme_access_secret
  JWT_REFRESH_SECRET=changeme_refresh_secret
  JWT_ACCESS_EXPIRY=15m
  JWT_REFRESH_EXPIRY=7d

  # File storage
  STORAGE_DRIVER=local           # 'local' | 's3'
  AWS_BUCKET_NAME=
  AWS_REGION=
  AWS_ACCESS_KEY_ID=
  AWS_SECRET_ACCESS_KEY=

  # Email (nodemailer)
  EMAIL_HOST=smtp.example.com
  EMAIL_PORT=587
  EMAIL_USER=
  EMAIL_PASS=
  EMAIL_FROM=noreply@example.com

  # Business rules
  DAILY_STANDARD_HOURS=9
  MONTHLY_QUOTA_HOURS=186
  ```

### 2. Docker environment

- [x] Create Dockerfile for client (React dev server)
- [x] Create Dockerfile for server (Node.js)
- [x] Create docker-compose.yml with 3 services: client, server, postgres
- [x] Add volume mounts for hot reload in dev
- [x] Add health checks for all services
- [x] Test: docker-compose up builds and runs all 3 services

### 2b. Security middleware (Backend)

- [x] Install `helmet` — set HSTS, X-Content-Type-Options, X-Frame-Options, Referrer-Policy on all responses
- [x] Install `cors` — restrict to `FRONTEND_URL` env var only. Reject other origins with 403.
- [x] Install `express-rate-limit` — global: 100 req/min per IP; auth-specific: 10 req/min per IP on `POST /auth/login`
- [x] All three middlewares applied before any route in `app.js`

### 2c. Cron scheduler infrastructure (Backend)

- [x] Install `node-cron` (or equivalent)
- [x] Create `server/src/cron/index.js` — central cron registry
- [x] Register placeholder cron slots:
  - `Sunday 23:59 Asia/Jerusalem` → weekly-submissions auto-flag (F13): `cron.schedule('59 23 * * 0', checkMissingSubmissions, { timezone: 'Asia/Jerusalem' })`
  - `Thursday 09:00 Asia/Jerusalem` → reminder email dispatch (F19)
  - Every minute → active timer 12h auto-stop check (F10)
  - On every time_entry save → quota warning check (F09/F19)
- [x] Set `TZ=Asia/Jerusalem` in `.env.example` and ensure it is exported at process startup in `server.js` so all `Date` operations default to Israel time
- [x] All cron jobs must be idempotent (safe to re-run)

### 2d. File storage setup

- [x] Install `multer` for multipart upload handling
- [x] Configure storage destination: `server/uploads/` (dev) or S3-compatible bucket (prod, via env var `STORAGE_DRIVER=local|s3`)
- [x] Enforce server-side MIME type validation (check magic bytes, not just extension)
- [x] Limits: max file size 10 MB, allowed types: `image/jpeg`, `image/png`, `application/pdf`, `application/msword`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`
- [x] Static file serving for local dev: `GET /uploads/:filename` (auth-protected)

### 3. CI Pipeline (GitHub Actions)

- [x] Create .github/workflows/ci.yml
- [x] Steps: install deps → lint → run tests → build
- [x] Run on PR to main and on push to main
- [x] Add branch protection rule on main (require PR, 1 reviewer, CI pass)
  > Branch protection must be configured manually in GitHub → Settings → Branches → Add rule: require PR, 1 reviewer, require status checks (`CI / Server` + `CI / Client`).

### 4. CD Pipeline

- [x] Choose hosting service (Railway — backend + frontend + PostgreSQL on one platform)
- [x] Create .github/workflows/cd.yml
- [x] Auto-deploy on push to main after CI passes (uses `workflow_run` trigger, only fires on CI success)
- [ ] Set up environment variables in hosting platform
  > Must be done manually in Railway dashboard. Required secrets:
  > - GitHub repo secret: `RAILWAY_TOKEN` (from Railway → Account Settings → Tokens)
  > - Railway service env vars (server): `NODE_ENV=production`, `PORT`, `DATABASE_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `JWT_ACCESS_EXPIRY`, `JWT_REFRESH_EXPIRY`, `FRONTEND_URL`, `TZ=Asia/Jerusalem`, `STORAGE_DRIVER`, `EMAIL_*`, `DAILY_STANDARD_HOURS`, `MONTHLY_QUOTA_HOURS`
  > - Railway service env vars (client): `VITE_API_URL` (Railway backend public URL)

### 5. Shared tooling

- [x] Set up ESLint + Prettier for both client and server
  - Root `.prettierrc` shared by both
  - `server/eslint.config.mjs` (ESLint 9 flat config + `eslint-config-prettier`)
  - `client/eslint.config.js` extended with `eslint-config-prettier`
  - `lint` and `lint:fix` and `format` scripts in both `package.json` files
- [x] Set up testing framework (Jest for server, Vitest for client)
  - `server/jest.config.js` — `testEnvironment: 'node'`
  - `client/vite.config.js` — `test: { environment: 'jsdom', globals: true }`
  - `client/src/test/setup.js` — imports `@testing-library/jest-dom`
  - `test` and `test:coverage` scripts in both `package.json` files
- [x] Add Swagger/OpenAPI skeleton to server
  - `server/src/swagger.js` — OpenAPI 3.0.3, JWT `bearerAuth`, scans `src/routes/**`
  - Mounted at `GET /api/docs` (disabled in production)
  - `GET /api/docs.json` raw spec endpoint (dev only)
- [x] Configure path aliases
  - Client: `vite.config.js` → `resolve.alias: { '@': '/src' }`
  - Server: `server/jsconfig.json` → `paths: { "@/*": ["./src/*"] }` (editor support)

## API Endpoints

None — infrastructure only

## Database Tables

PostgreSQL container configured, no tables yet

## Screens / UI

None — infrastructure only

## Files to Create/Modify

- `docker-compose.yml`
- `.github/workflows/ci.yml`
- `.github/workflows/cd.yml`
- `client/Dockerfile, package.json, vite.config.js`
- `server/Dockerfile, package.json, src/app.js, src/server.js`

## Acceptance Criteria

- [x] docker-compose up starts all 3 services with no errors
- [x] Client accessible at localhost:5173
- [x] Server accessible at localhost:3001/api
- [x] CI pipeline runs and passes on PR
- [x] CD auto-deploys to staging on merge to main (env vars must be set manually in Railway — see Section 4 note)
- [x] CORS blocks cross-origin requests from unlisted origins
- [x] Rate limiter returns 429 after 10 login attempts/min
- [x] Helmet headers present on all API responses
- [x] Cron scheduler initialises without error on server start
- [x] File uploads land in correct storage destination

