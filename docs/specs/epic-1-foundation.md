# Epic 1 — Foundation

> **Days**: Day 1 | **Priority**: CRITICAL  
> **Goal**: Project runs, DB is ready, login works  
> **Features**: F01, F02, F03

---

## Features

| ID | Feature | Lead |
|----|---------|------|
| F01 | Project Setup + Docker | Dev A |
| F02 | Database Schema (all 15 tables + seeds) | Dev B |
| F03 | Auth — Backend + Frontend | Dev A (BE), Dev C (FE) |

**Milestone**: `docker-compose up` runs, admin can log in, JWT works.

---

## F01 — Project Setup + Docker

### What to build
- Monorepo structure with 3 services: frontend, backend, database
- `docker-compose.yml` that brings up all services with a single command
- Environment variable management (`.env` files, `.env.example`)
- GitHub Actions CI pipeline (runs tests on every PR, blocks merge on failure)
- CD pipeline configured (Vercel / Render / Railway — team choice)
- README with full installation and run instructions

### Structure
```
/
├── frontend/         # React app
├── backend/          # Node.js API
├── docker-compose.yml
├── .env.example
└── README.md
```

### CI Requirements
- All tests must pass before merge
- Branch protection on `main`: PRs required, min 1 reviewer, no direct push

---

## F02 — Database Schema

### All 15 Required Tables

```sql
users
  id UUID PK
  email VARCHAR UNIQUE NOT NULL
  password_hash VARCHAR NOT NULL
  full_name VARCHAR NOT NULL
  role ENUM('user', 'admin') NOT NULL DEFAULT 'user'
  is_active BOOLEAN DEFAULT TRUE
  must_change_password BOOLEAN DEFAULT TRUE
  created_at TIMESTAMPTZ
  updated_at TIMESTAMPTZ

permission_flags
  id UUID PK
  user_id UUID FK → users
  flag_name VARCHAR NOT NULL           -- 'canAssignProjectTasks'
  scoped_project_ids JSONB             -- array of project UUIDs
  granted_by UUID FK → users
  created_at TIMESTAMPTZ

clients
  id UUID PK
  name VARCHAR NOT NULL
  contact_info TEXT
  is_active BOOLEAN DEFAULT TRUE
  created_at TIMESTAMPTZ
  updated_at TIMESTAMPTZ

projects
  id UUID PK
  client_id UUID FK → clients
  name VARCHAR NOT NULL
  is_active BOOLEAN DEFAULT TRUE
  created_at TIMESTAMPTZ
  updated_at TIMESTAMPTZ

tasks
  id UUID PK
  project_id UUID FK → projects
  name VARCHAR NOT NULL
  status ENUM('open', 'closed') DEFAULT 'open'
  created_at TIMESTAMPTZ
  updated_at TIMESTAMPTZ

user_task_assignments
  id UUID PK
  user_id UUID FK → users
  task_id UUID FK → tasks
  is_active BOOLEAN DEFAULT TRUE
  created_at TIMESTAMPTZ
  updated_at TIMESTAMPTZ
  UNIQUE(user_id, task_id)             -- no duplicate active assignment

time_entries
  id UUID PK
  user_id UUID FK → users
  date DATE NOT NULL
  start_time TIME NOT NULL
  end_time TIME                        -- nullable while timer is running
  duration_minutes INT                 -- nullable while timer is running
  client_id UUID FK → clients          -- nullable while timer is running
  project_id UUID FK → projects        -- nullable while timer is running
  task_id UUID FK → tasks              -- nullable while timer is running
  location ENUM('משרד', 'לקוח', 'בית') -- nullable while timer is running
  description TEXT
  status ENUM('draft', 'submitted', 'approved', 'rejected', 'locked') DEFAULT 'draft'
  version INT DEFAULT 1                -- optimistic locking
  created_at TIMESTAMPTZ
  updated_at TIMESTAMPTZ

absence_entries
  id UUID PK
  user_id UUID FK → users
  type ENUM('חופשה', 'מחלה', 'מילואים', 'אחר') NOT NULL
  start_date DATE NOT NULL
  end_date DATE NOT NULL
  is_partial BOOLEAN DEFAULT FALSE
  notes TEXT
  status ENUM('draft', 'submitted', 'approved') DEFAULT 'draft'
  created_at TIMESTAMPTZ
  updated_at TIMESTAMPTZ

attachments
  id UUID PK
  absence_id UUID FK → absence_entries
  file_name VARCHAR NOT NULL
  file_path VARCHAR NOT NULL
  mime_type VARCHAR NOT NULL
  size_bytes INT NOT NULL
  uploaded_by UUID FK → users
  created_at TIMESTAMPTZ

weekly_submissions
  id UUID PK
  user_id UUID FK → users
  week_start_date DATE NOT NULL
  status ENUM('draft', 'missing', 'submitted', 'approved', 'rejected') DEFAULT 'draft'
  submitted_at TIMESTAMPTZ
  reviewed_by UUID FK → users
  reviewed_at TIMESTAMPTZ
  rejection_reason TEXT

month_locks
  id UUID PK
  year INT NOT NULL
  month INT NOT NULL
  locked_by UUID FK → users
  locked_at TIMESTAMPTZ
  unlocked_by UUID FK → users
  unlocked_at TIMESTAMPTZ
  is_locked BOOLEAN DEFAULT FALSE
  UNIQUE(year, month)

audit_logs
  id UUID PK
  actor_user_id UUID FK → users
  target_entity_type ENUM('user','client','project','task','assignment','timeEntry','absence','month','export','session')
  target_entity_id UUID NOT NULL
  action ENUM('create','update','delete','archive','submit','approve','reject','reopen','export','login','loginFail')
  old_value JSONB
  new_value JSONB
  reason TEXT
  timestamp TIMESTAMPTZ NOT NULL
  ip_address VARCHAR

system_settings
  id UUID PK
  key VARCHAR UNIQUE NOT NULL
  value JSONB NOT NULL
  updated_by UUID FK → users
  updated_at TIMESTAMPTZ

holiday_calendar
  id UUID PK
  date DATE NOT NULL UNIQUE
  name VARCHAR NOT NULL
  type ENUM('holiday', 'special') NOT NULL
  created_by UUID FK → users
  created_at TIMESTAMPTZ

-- active_timers table removed: running timers are tracked via time_entries rows where end_time IS NULL.
```

### Seeds
- Seed one admin user: email `admin@company.com`, `must_change_password = true`
- Seed default system settings: `{ daily_standard_hours: 9, non_working_days: [5, 6] }`

### Migration Tool
Use **Knex.js** for migrations. All migrations must be reversible (up + down).

---

## F03 — Authentication

### Backend (Dev A)

#### API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/auth/login` | Public | Email + password login |
| POST | `/auth/logout` | Authenticated | Invalidate refresh token |
| POST | `/auth/refresh` | Refresh token | Issue new access token (rotation) |
| POST | `/auth/change-password` | Authenticated | Change own password |
| GET | `/users/me` | Authenticated | Get current user profile |

#### Login Request / Response

```json
// POST /auth/login
{ "email": "user@company.com", "password": "...", "rememberMe": true }

// 200 OK
{
  "accessToken": "...",       // 15-min JWT in response body
  "user": { "id": "...", "fullName": "...", "role": "...", "mustChangePassword": false }
}
// Refresh token set as HTTP-only cookie (SameSite=Strict)
// Cookie expiry: 7 days (or 30 days if rememberMe=true)
```

#### Token Rules
- **Access token**: 15-minute expiry, sent in `Authorization: Bearer` header
- **Refresh token**: 7-day expiry (30-day if `rememberMe`), stored in HTTP-only cookie
- **Refresh rotation**: every `/auth/refresh` call issues a new token and invalidates the old one
- **Logout**: invalidates the specific refresh token (store revoked tokens or use token family)
- **Inactivity timeout**: frontend auto-logs out after 30 minutes of no activity
- **Admin deactivates user**: ALL active sessions terminate immediately

#### Password Rules
- Min 8 characters, 1 uppercase, 1 lowercase, 1 digit, 1 special character
- Cannot equal the email address
- Stored with `bcrypt` cost factor 12
- `must_change_password = true` on first login and after admin reset

#### Security
- Rate limit: 10 login attempts/minute per IP (return 429)
- Account lockout: 15 minutes after 5 consecutive failed attempts (per user)
- HTTPS required; CORS restricted to frontend domain(s)

#### RBAC Middleware
All protected routes use middleware that:
1. Validates access token
2. Attaches `req.user` with `{ id, role, permissionFlags }`
3. Returns 401 if token missing/expired, 403 if role insufficient

#### Audit Logging
- Every login success → audit log (`login`)
- Every login failure → audit log (`loginFail`)
- Every password change → audit log

---

### Frontend (Dev C)

#### Screens

**Login Screen** — required fields:
- Email field
- Password field (with show/hide toggle)
- Remember Me checkbox
- Login button
- Error message area (wrong credentials, account locked)

**First-Login / Password Change Screen** — shown when `mustChangePassword = true`:
- Current password (or skip if just-created)
- New password with policy hint display
- Confirm new password
- Submit button

#### Auth State Management
- `AuthContext` provides: `user`, `login()`, `logout()`, `isAuthenticated`
- `ProtectedRoute` component: redirects to `/login` if not authenticated
- `axios` interceptor: attaches `Authorization: Bearer <token>` to all requests; on 401, attempts token refresh; on refresh failure, logs out
- Email can be pre-filled from `localStorage` if `rememberMe` was previously checked

#### UI States
- Loading: spinner on login button during API call
- Error: inline error message (not an alert/modal)
- Locked account: specific message with retry-after time

---

## Test Plan

| Category | What to test | Priority |
|----------|-------------|---------|
| Unit | Password validation (policy rules), bcrypt hash/compare | CRITICAL |
| Unit | JWT generation, expiry, refresh rotation logic | CRITICAL |
| Integration | POST /auth/login — success, wrong password, locked account, rate limit | CRITICAL |
| Integration | POST /auth/refresh — valid token, expired token, rotated (replay) token | CRITICAL |
| Integration | POST /auth/logout — token invalidated | CRITICAL |
| Integration | POST /auth/change-password — enforced on first login | CRITICAL |
| Permission | Protected route returns 401 without token | CRITICAL |
| Permission | Protected route returns 403 for wrong role | CRITICAL |
| Audit | Login success creates audit_log record | MAJOR |
| Audit | Login failure creates audit_log record | MAJOR |
