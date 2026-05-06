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

- [ ] Create root folder with docker-compose.yml
- [ ] Create client/ folder with Vite + React setup
- [ ] Create server/ folder with Express setup
- [ ] Create docs/ folder
- [ ] Add .gitignore, .env.example, README skeleton

### 2. Docker environment

- [ ] Create Dockerfile for client (React dev server)
- [ ] Create Dockerfile for server (Node.js)
- [ ] Create docker-compose.yml with 3 services: client, server, postgres
- [ ] Add volume mounts for hot reload in dev
- [ ] Add health checks for all services
- [ ] Test: docker-compose up builds and runs all 3 services

### 2b. Security middleware (Backend)

- [ ] Install `helmet` — set HSTS, X-Content-Type-Options, X-Frame-Options, Referrer-Policy on all responses
- [ ] Install `cors` — restrict to `FRONTEND_URL` env var only. Reject other origins with 403.
- [ ] Install `express-rate-limit` — global: 100 req/min per IP; auth-specific: 10 req/min per IP on `POST /auth/login`
- [ ] All three middlewares applied before any route in `app.js`

### 2c. Cron scheduler infrastructure (Backend)

- [ ] Install `node-cron` (or equivalent)
- [ ] Create `server/src/cron/index.js` — central cron registry
- [ ] Register placeholder cron slots:
  - `Sunday 23:59 IL` → weekly-submissions auto-flag (F13)
  - `Thursday 09:00 IL` → reminder email dispatch (F19)
  - Every minute → active timer 12h auto-stop check (F10)
  - On every time_entry save → quota warning check (F19)
- [ ] All cron jobs must be idempotent (safe to re-run)

### 2d. File storage setup

- [ ] Install `multer` for multipart upload handling
- [ ] Configure storage destination: `server/uploads/` (dev) or S3-compatible bucket (prod, via env var `STORAGE_DRIVER=local|s3`)
- [ ] Enforce server-side MIME type validation (check magic bytes, not just extension)
- [ ] Limits: max file size 10 MB, allowed types: `image/jpeg`, `image/png`, `application/pdf`, `application/msword`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`
- [ ] Static file serving for local dev: `GET /uploads/:filename` (auth-protected)

### 3. CI Pipeline (GitHub Actions)

- [ ] Create .github/workflows/ci.yml
- [ ] Steps: install deps → lint → run tests → build
- [ ] Run on PR to main and on push to main
- [ ] Add branch protection rule on main (require PR, 1 reviewer, CI pass)

### 4. CD Pipeline

- [ ] Choose hosting service (Vercel/Render/Railway)
- [ ] Create .github/workflows/cd.yml
- [ ] Auto-deploy on push to main after CI passes
- [ ] Set up environment variables in hosting platform

### 5. Shared tooling

- [ ] Set up ESLint + Prettier for both client and server
- [ ] Set up testing framework (Jest or Vitest)
- [ ] Add Swagger/OpenAPI skeleton to server
- [ ] Configure path aliases

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

- [ ] docker-compose up starts all 3 services with no errors
- [ ] Client accessible at localhost:3000
- [ ] Server accessible at localhost:5000/api
- [ ] CI pipeline runs and passes on PR
- [ ] CD auto-deploys to staging on merge to main
- [ ] CORS blocks cross-origin requests from unlisted origins
- [ ] Rate limiter returns 429 after 10 login attempts/min
- [ ] Helmet headers present on all API responses
- [ ] Cron scheduler initialises without error on server start
- [ ] File uploads land in correct storage destination

