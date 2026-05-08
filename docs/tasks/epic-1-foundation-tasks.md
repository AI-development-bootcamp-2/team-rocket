# Epic 1 — Foundation Tasks

**Jira Epic**: `[EPIC] Foundation — Project Setup, DB Schema & Auth`  
**Priority**: Critical | **Day**: 1  
**Spec**: [epic-1-foundation.md](../specs/epic-1-foundation.md)

---

## Story F01 — Project Setup + Docker
**Assignee**: Dev A  
**Story Points**: 3

> ⚠️ Status unknown — work not visible on branch `Foundation--Backend`. Verify separately.

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

> ✅ Marked complete via PR #2 (`f3c7b8b`). All 19 migrations present on disk (16 spec tables + refresh_tokens, notifications, indexes).  
> ⚠️ Note: task list says `monthly_submissions` but migration and spec use `weekly_submissions` — implementation follows spec.  
> ⚠️ Note: admin seed uses `admin@system.com`, not `admin@company.com` from the task list.

### Tasks
- [x] **T** Set up Knex.js migration tooling in backend
- [x] **T** Create migration: `users` table
- [x] **T** Create migration: `permission_flags` table
- [x] **T** Create migration: `clients` table
- [x] **T** Create migration: `projects` table
- [x] **T** Create migration: `tasks` table
- [x] **T** Create migration: `user_task_assignments` table
- [x] **T** Create migration: `time_entries` table
- [x] **T** Create migration: `absence_entries` table
- [x] **T** Create migration: `attachments` table
- [x] **T** Create migration: `monthly_submissions` table
- [x] **T** Create migration: `month_locks` table
- [x] **T** Create migration: `audit_logs` table
- [x] **T** Create migration: `system_settings` table
- [x] **T** Create migration: `holiday_calendar` table
- [x] **T** Create migration: `active_timers` table
- [x] **T** Write seed: admin user (`admin@company.com`, `must_change_password = true`)
- [x] **T** Write seed: default system settings (9h/day, Fri–Sat non-working)

#### Subtasks
- [x] **ST** All 16 migrations run cleanly (`knex migrate:latest`)
- [x] **ST** All migrations are reversible (`knex migrate:rollback` succeeds)
- [x] **ST** Seeds run without errors (`knex seed:run`)

---

## Story F03-BE — Auth Backend
**Assignee**: Dev A  
**Story Points**: 8

> ✅ All tasks complete. Integration tests written and compile-verified (`npm test` passes).  
> ⚠️ Integration tests require a live Postgres instance to execute — run with `npm run test:integration`.

### Tasks
- [x] **T** Implement `POST /auth/login` — email/password, return JWT + set refresh cookie
- [x] **T** Implement `POST /auth/logout` — invalidate refresh token
- [x] **T** Implement `POST /auth/refresh` — rotate refresh token, issue new access token
- [x] **T** Implement `POST /auth/change-password` — validate policy, update hash
- [x] **T** Implement `GET /users/me` — return current user profile
- [x] **T** Implement JWT middleware — attach `req.user`, return 401/403 on failure
- [x] **T** Implement RBAC middleware — check role/permission for protected routes
- [x] **T** Implement password policy validation (8 chars, upper, lower, digit, special, ≠ email)
- [x] **T** Implement rate limiting: 10 login attempts/min per IP (return 429)
- [x] **T** Implement account lockout: 15 min after 5 consecutive failed attempts
- [x] **T** Implement forced password change on first login and after admin reset
- [x] **T** Configure CORS to restrict to frontend domain(s)
- [x] **T** Configure HTTPS / security headers

#### Subtasks
- [x] **ST** Unit test: password policy validation (all rule combinations)
- [x] **ST** Unit test: JWT generation and expiry
- [x] **ST** Integration test: login success → access + refresh tokens returned
- [x] **ST** Integration test: login failure → 401, lockout after 5 attempts
- [x] **ST** Integration test: refresh token rotation (old token rejected after rotation)
- [x] **ST** Integration test: logout → refresh token invalidated
- [x] **ST** Integration test: protected route without token → 401
- [x] **ST** Integration test: protected route wrong role → 403
- [x] **ST** Audit log test: login success + failure create correct records

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
