# Epic 1 — Foundation Tasks

**Jira Epic**: `[EPIC] Foundation — Project Setup, DB Schema & Auth`  
**Priority**: Critical | **Day**: 1  
**Spec**: [epic-1-foundation.md](../specs/epic-1-foundation.md)

---

## Story F01 — Project Setup + Docker
**Assignee**: Dev A  
**Story Points**: 3

### Tasks
- [ ] **T** Create monorepo folder structure (`/frontend`, `/backend`)
- [ ] **T** Write `docker-compose.yml` with 3 services: frontend, backend, postgres
- [ ] **T** Add `.env.example` with all required environment variables
- [ ] **T** Configure GitHub Actions CI pipeline (run tests on PR, block merge on failure)
- [ ] **T** Configure CD pipeline (Vercel / Render / Railway)
- [ ] **T** Write `README.md` with full installation and run instructions
- [ ] **T** Set up branch protection on `main`: require PR + 1 reviewer

#### Subtasks
- [ ] **ST** Verify `docker-compose up` brings up all 3 services cleanly
- [ ] **ST** Verify CI pipeline triggers on PR and passes/fails correctly

---

## Story F02 — Database Schema
**Assignee**: Dev B  
**Story Points**: 5

### Tasks
- [ ] **T** Set up Knex.js migration tooling in backend
- [ ] **T** Create migration: `users` table
- [ ] **T** Create migration: `permission_flags` table
- [ ] **T** Create migration: `clients` table
- [ ] **T** Create migration: `projects` table
- [ ] **T** Create migration: `tasks` table
- [ ] **T** Create migration: `user_task_assignments` table
- [ ] **T** Create migration: `time_entries` table
- [ ] **T** Create migration: `absence_entries` table
- [ ] **T** Create migration: `attachments` table
- [ ] **T** Create migration: `monthly_submissions` table
- [ ] **T** Create migration: `month_locks` table
- [ ] **T** Create migration: `audit_logs` table
- [ ] **T** Create migration: `system_settings` table
- [ ] **T** Create migration: `holiday_calendar` table
- [ ] **T** Create migration: `active_timers` table
- [ ] **T** Write seed: admin user (`admin@company.com`, `must_change_password = true`)
- [ ] **T** Write seed: default system settings (9h/day, Fri–Sat non-working)

#### Subtasks
- [ ] **ST** All 16 migrations run cleanly (`knex migrate:latest`)
- [ ] **ST** All migrations are reversible (`knex migrate:rollback` succeeds)
- [ ] **ST** Seeds run without errors (`knex seed:run`)

---

## Story F03-BE — Auth Backend
**Assignee**: Dev A  
**Story Points**: 8

### Tasks
- [ ] **T** Implement `POST /auth/login` — email/password, return JWT + set refresh cookie
- [ ] **T** Implement `POST /auth/logout` — invalidate refresh token
- [ ] **T** Implement `POST /auth/refresh` — rotate refresh token, issue new access token
- [ ] **T** Implement `POST /auth/change-password` — validate policy, update hash
- [ ] **T** Implement `GET /users/me` — return current user profile
- [ ] **T** Implement JWT middleware — attach `req.user`, return 401/403 on failure
- [ ] **T** Implement RBAC middleware — check role/permission for protected routes
- [x] **T** Implement password policy validation (8 chars, upper, lower, digit, special, ≠ email)
- [ ] **T** Implement rate limiting: 10 login attempts/min per IP (return 429)
- [ ] **T** Implement account lockout: 15 min after 5 consecutive failed attempts
- [ ] **T** Implement forced password change on first login and after admin reset
- [x] **T** Configure CORS to restrict to frontend domain(s)
- [x] **T** Configure HTTPS / security headers

#### Subtasks
- [x] **ST** Unit test: password policy validation (all rule combinations)
- [x] **ST** Unit test: JWT generation and expiry
- [ ] **ST** Integration test: login success → access + refresh tokens returned
- [ ] **ST** Integration test: login failure → 401, lockout after 5 attempts
- [ ] **ST** Integration test: refresh token rotation (old token rejected after rotation)
- [ ] **ST** Integration test: logout → refresh token invalidated
- [ ] **ST** Integration test: protected route without token → 401
- [ ] **ST** Integration test: protected route wrong role → 403
- [ ] **ST** Audit log test: login success + failure create correct records

---

## Story F03-FE — Auth Frontend
**Assignee**: Dev C  
**Story Points**: 5

### Tasks
- [ ] **T** Build Login screen: email field, password (show/hide toggle), Remember Me checkbox, login button, error message area
- [ ] **T** Build First-Login / Password Change screen (shown when `mustChangePassword = true`)
- [ ] **T** Implement `AuthContext`: `user`, `login()`, `logout()`, `isAuthenticated`
- [ ] **T** Implement `ProtectedRoute` component: redirect to `/login` if not authenticated
- [ ] **T** Add `axios` interceptor: attach Bearer token, auto-refresh on 401, logout on refresh fail
- [ ] **T** Pre-fill email from `localStorage` when Remember Me was previously checked
- [ ] **T** Show password policy hint on the change-password screen

#### Subtasks
- [ ] **ST** Login loading state: spinner on button during API call
- [ ] **ST** Login error state: inline message (not alert/modal)
- [ ] **ST** Locked account state: message with retry-after time
- [ ] **ST** First-login redirect works end-to-end

---

**✅ Milestone**: `docker-compose up` runs, admin can log in, JWT works.
