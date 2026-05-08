# Codebase Audit — F01–F04 + F06

**Date:** 2026-05-08  
**Scope:** F01 Infrastructure, F02 Database, F03 Auth, F04 Users, F06 Projects  
**Test coverage:** 92.2% statements · 100% branches · 93.1% functions  
**Status after fixes:** ✅ 5 bugs fixed · ⚠️ 2 open items remain

---

## Bugs Found & Fixed (this session)

| # | Bug | File | Fix |
|---|-----|------|-----|
| 1 | Login form "stuck" — 401 from wrong password triggered refresh logic → silent page reload | `frontend/src/api/axiosClient.ts:50` | Only intercept 401 when access token exists in memory |
| 2 | `rememberMe=false` still issued a persistent 7-day cookie | `server/src/controllers/auth.controller.ts` | Conditionally set `maxAge` only when `rememberMe=true`; use `CookieOptions` type from express |
| 3 | 423 lockout response missing `retryAfterMinutes` field (frontend read it, server never sent it) | `server/src/middleware/error.middleware.ts` + `server/src/services/auth.service.ts` | Added `extra?: Record<string, unknown>` to `AppError`; `assertNotLocked` passes `{ retryAfterMinutes }` |
| 4 | `initCron()` exported but never called — 3 scheduled jobs silently never ran | `server/src/server.ts` | Added `initCron()` call in server startup callback |
| 5 | `extractIp()` in two controllers manually parsed `x-forwarded-for`, bypassing the `trust proxy` chain | `server/src/controllers/projects.controller.ts` + `permission-flags.controller.ts` | Simplified to `req.ip` (trust proxy is set to `1` in `app.ts`) |

All fixes committed: `fix: 5 bugs - login 401 intercept, rememberMe session cookie, lockout retryAfterMinutes, initCron wired, extractIp trust-proxy`  
Tests after fixes: **150/150 pass** (148 existing + 2 new `rememberMe` cookie assertions)

---

## Open Items

### 2. F04 Users — zero API-level integration tests

All 10 user endpoints work correctly but have no integration tests. Unit tests cover the service layer at ~93% but no supertest coverage exists for the HTTP layer.

**Endpoints with no integration tests:**
- `GET /users` (admin)
- `GET /users/:id` (admin)
- `GET /users/me` (any user)
- `PUT /users/me` (any user)
- `POST /users/me/sort-preference`
- `POST /users` (admin)
- `PUT /users/:id` (admin)
- `DELETE /users/:id` (admin)
- `POST /users/:id/reset-password` (admin)
- `GET/POST/DELETE /users/:id/permissions` (admin)

Mirror pattern: `server/tests/integration/projects.test.ts` (31 cases, 100% coverage)  
Effort estimate: ~4 hours

---

## Feature Verification

### F01 — Infrastructure ✅

- Docker Compose: server (3001), frontend (5173), postgres, redis
- Helmet, CORS (restricted to `FRONTEND_URL`), global rate limit 100 req/min
- Login rate limit: 10 req/min per IP
- Multer file upload middleware configured
- Cron infrastructure present and **now wired** (`initCron()` called on startup)
  - Sunday 23:59 — weekly submission auto-flag (F13)
  - Thursday 09:00 — reminder emails (F19)
  - Every minute — timer 12h auto-stop (F10)
- `GET /uploads/:filename` auth-protected route: **not yet added** (needed by F08 attachments; not blocking now)

### F02 — Database ✅ (19/19 migrations)

All tables, constraints, indexes, and seed data verified:

| Range | Tables |
|-------|--------|
| 001–005 | users, clients, projects, tasks, user_task_assignments |
| 006–009 | time_entries, absence_entries, attachments, weekly_submissions |
| 010–013 | month_locks, audit_logs, system_settings, holiday_calendar |
| 014–019 | active_timers, permission_flags, refresh_tokens, notifications, indexes (×2) |

Foreign keys: all have `ON DELETE CASCADE` or `SET NULL`  
Unique constraints: email, client_number, token_hash, (year, month)  
Soft deletes: `is_active` / `deleted_at` filters applied consistently

### F03 — Authentication ✅ (4/4 endpoints, all bugs fixed)

- `POST /auth/login` — bcrypt compare, lockout check, audit log, rate limited, **session vs persistent cookie now correct**
- `POST /auth/logout` — cookie-based, sets `revoked_at`, clears cookie
- `POST /auth/refresh` — validates hash, rotates token, rate limited
- `POST /auth/change-password` — validates old password, policy check, revokes all other tokens, audit log

Security verified:
- Access token: 15 min JWT
- Refresh token: 7-day, SHA-256 hashed in DB, rotated on each use
- Account lockout: 5 failed attempts → 15 min cooldown, **`retryAfterMinutes` now returned in 423 body**
- **Login 401 interceptor fixed**: no more silent reload on wrong password

66 integration tests + 2 new `rememberMe` cookie tests = **68 auth tests**

### F04 — Users ✅ (10 endpoints correct, no integration tests)

- Admin CRUD: create, read, update, soft-deactivate with all validations
- Self-service: `GET /users/me`, `PUT /users/me` (name only — email/role change blocked)
- Sort preference: stored as JSONB in `sort_prefs`
- Reset password: generates temp password, sets `must_change_password=true`
- Permissions: grant/list/revoke `canAssignProjectTasks` (does NOT grant project CRUD)
- Deactivation: immediately invalidates all refresh tokens; self-deactivation blocked (403)
- Audit logging on all mutations (CREATE, UPDATE, DEACTIVATE, PASSWORD_RESET)

### F06 — Projects ✅ (5/5 endpoints, 31 tests, 100% coverage)

- Admin CRUD: create, read, update, soft-archive
- User scoping: users see only projects with active task assignments (JOIN on `user_task_assignments`)
- Duplicate names: same client → 201 + warning; different clients → no warning
- Archive: warns if active tasks exist; removes `projectId` from all `scoped_project_ids` arrays
- `extractIp` fixed — now uses `req.ip` (trust proxy chain respected)

---

## Security Summary

| Area | Status |
|------|--------|
| Password hashing | bcrypt cost 12 ✅ |
| Input validation | email regex, enum checks, integer IDs, string trim ✅ |
| SQL injection | parameterized queries everywhere ✅ |
| RBAC | `requireRole('admin')` on all admin endpoints ✅ |
| Cookies | HttpOnly · Secure · SameSite=strict ✅ |
| Rate limiting | 10/min login · 100/min global · refresh limited ✅ |
| CORS | restricted to `FRONTEND_URL` ✅ |
| Audit logging | all mutations logged with actor IP ✅ |
| Error responses | no sensitive data leaked ✅ |
| Token storage | hashed in DB; access token in memory only ✅ |
| IP extraction | uses `req.ip` (trust proxy=1) ✅ |

---

## Remaining Checklist

- [x] Write F04 users integration tests — **done** (51 cases across all 10 endpoints + permissions; `server/tests/integration/users.test.ts`)
- [x] Add `GET /uploads/:filename` auth-protected static route — **done** (`server/src/app.ts`; path-traversal safe via `path.basename`)
- [ ] Implement F05 clients CRUD (unblocks `ProjectForm` client dropdown)
