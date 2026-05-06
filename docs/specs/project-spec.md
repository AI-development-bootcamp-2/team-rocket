# Time Reporting System — Project Specification

> **Version**: 3.0 | **Status**: All Decisions Locked | **Date**: May 2026  
> **Source**: Derived from `Time_Report_Master_Spec_v3.docx`

---

## 1. Executive Summary

A Hebrew (RTL) responsive web application for managing and reporting employee work hours.  
Employees report daily hours against clients, projects, and tasks, and report absences.  
Administrators manage all entities, review/approve reports, lock months, and export data.

**All decisions are locked. There are 0 open product questions.**

### Severity Legend

| Level | Meaning | Planning Impact |
|-------|---------|----------------|
| CRITICAL | System is broken or unsafe without it | Must be in Sprint 1–2. Cannot launch. |
| MAJOR | Core workflow is incomplete without it | Must be in Sprint 2–4. |
| MINOR | Improves quality, system works without it | Sprint 4+ / polish phase. |

---

## 2. System Overview

### Technical Stack

| Component | Technology |
|-----------|-----------|
| Frontend | React |
| Backend | Node.js |
| Database | PostgreSQL |
| Containerization | Docker + Docker Compose |
| CI Pipeline | GitHub Actions |
| CD Pipeline | Vercel / Render / Railway (team choice) |
| API Docs | Swagger |
| Testing | Jest or Vitest (min 60% coverage) |

### Core Principle

The system **prioritizes simplicity for the daily reporter**. The default screen on login is the daily reporting form. Every field has sensible defaults (today's date, current time, auto-selected single client/project/task). Complexity lives in the admin side, not the user side.

### Language & Browsers
- **Language**: Hebrew (RTL) only
- **Design**: Mobile-first responsive
- **Browsers**: Chrome, Edge, Safari — latest versions on desktop and mobile

---

## 3. Roles & Permissions (CRITICAL)

### Role Model

| Role | Description |
|------|-------------|
| **User** | Regular employee. Reports only for himself. Sees only assigned tasks. |
| **User + canAssignProjectTasks** | Can assign tasks within specific projects. Cannot approve, export, lock, or manage settings. |
| **Admin** | Full access to all management, approval, export, lock, audit, and settings. |

### Permission Matrix Summary

| Action | User | User+Flag | Admin |
|--------|------|-----------|-------|
| Report own work / absence | ✅ | ✅ | ✅ |
| View own history | ✅ | ✅ | ✅ |
| View other users' reports | ❌ | ❌ | ✅ |
| Create/edit/archive users, clients, projects, tasks | ❌ | ❌ | ✅ |
| Assign users to tasks | ❌ | Scoped only | ✅ |
| Approve / reject reports | ❌ | ❌ | ✅ |
| Export Excel / PDF | ❌ | ❌ | ✅ |
| Lock / unlock month | ❌ | ❌ | ✅ |
| View audit logs | ❌ | ❌ | ✅ |

> Full permission matrix: see `epic-2-admin-entity-crud.md`

---

## 4. Master Data Model (CRITICAL)

### Entity Hierarchy

```
Client → Project → Task → UserTaskAssignment → User
```

- **Client**: unique ID, name, contact info (optional), `is_active`
- **Project**: belongs to one client, `is_active`
- **Task**: belongs to one project, status (open/closed)
- **UserTaskAssignment**: user ↔ task link, `is_active`

Users see **only** entities where they have active task assignments.

### Delete / Archive Policy

- **Zero hard deletes** for any business data.
- All deletes = soft delete (mark inactive/closed).
- Every delete requires: confirmation modal → warning if active reports exist → success feedback → audit log entry.
- Historical reports remain linked to archived entities.

---

## 5. Global Technical Rules

### Authentication (CRITICAL)
- Email/password login only (no SSO for v1)
- JWT with refresh token rotation: access token 15 min, refresh token 7 days
- Inactivity timeout: 30 minutes
- Account lockout: 15 min after 5 failed attempts
- `Remember Me`: refresh token in HTTP-only cookie (30-day expiry); email may pre-fill from localStorage, **password never stored client-side**
- Forced password change on first login and after admin reset
- Password policy: min 8 chars, 1 uppercase, 1 lowercase, 1 digit, 1 special char; cannot equal email

> Full auth spec: see `epic-1-foundation.md`

### Security Rules (CRITICAL)
- HTTPS required for all traffic
- CORS: restrict to known frontend domain(s)
- CSRF protection via SameSite cookie or CSRF token
- Rate limiting: 100 req/min per user, 10 login attempts/min per IP
- File upload: server-side MIME type validation (not just extension)

### Concurrency (MAJOR)
- Optimistic locking via `version` or `updatedAt` field on all editable entities
- On conflict: reject save with "This record was modified by someone else. Please refresh."

### CI/CD & Git Workflow (CRITICAL)
- Branch protection on `main`/`master`; PRs required; min 1 reviewer
- All tests must pass before merge
- README with full installation + run instructions
- Swagger API documentation

---

## 6. UI/UX Global Requirements (MAJOR)

### Required UI States (every screen)

| State | What it shows |
|-------|--------------|
| Loading | Spinner or skeleton |
| Empty | Illustration + helpful text + CTA |
| No permission | Lock icon + explanation |
| Validation error | Red border + message per field |
| Server error | Friendly message + retry |
| Offline | Banner + disabled actions |
| Save success | Auto-dismiss toast |
| Locked month | Read-only mode + banner |
| Delete confirmation | Modal with impact warning |
| Unsaved changes | Dialog on navigation |
| Quota warning | Progress bar color change |

### Navigation Structure

**User navigation:**
- Time Report (home/default)
- Monthly View
- Report History

**Admin navigation (includes all user screens plus):**
- Dashboard, User Management, Client/Project/Task Management, Assignments
- Month Closing, Report Review, Audit Log, Export, Settings

### Mobile Requirement (CRITICAL)
All major flows — user AND admin — must work on mobile. Mobile-first is not optional.

---

## 7. System Constants

| Parameter | Value | Configurable? |
|-----------|-------|--------------|
| Daily standard hours | 9 | Yes (Admin) |
| Non-working days | Friday, Saturday | Yes (Admin calendar) |
| Absence types | חופשה, מחלה, מילואים, אחר | No |
| Work locations | משרד, לקוח, בית | No |
| User roles | User, Admin | No |
| Max file upload | 10 MB | No |
| Allowed upload types | PDF, JPG, JPEG, PNG, DOC, DOCX | No |
| Access token expiry | 15 minutes | No |
| Refresh token expiry | 7 days | No |
| Inactivity timeout | 30 minutes | No |
| Timer auto-stop | 12 hours | No |
| Timer reminder | 10 hours | No |
| Monthly submit deadline | Last working day of month, 23:59 | No |
| Password min length | 8 characters | No |
| Time rounding | None (exact minutes) | No |

---

## 8. Epic Specs (Implementation Files)

| File | Epic | Days | Features | Priority |
|------|------|------|----------|---------|
| [epic-1-foundation.md](./epic-1-foundation.md) | Foundation | Day 1 | F01, F02, F03 | CRITICAL |
| [epic-2-admin-entity-crud.md](./epic-2-admin-entity-crud.md) | Admin CRUD | Day 2 | F04–F08 | CRITICAL |
| [epic-3-time-reporting-core.md](./epic-3-time-reporting-core.md) | Time Reporting Core | Days 3–4 | F09, F11, F12 | CRITICAL |
| [epic-4-submission-approval.md](./epic-4-submission-approval.md) | Submit & Approve | Day 5 | F10, F13, F14 | CRITICAL |
| [epic-5-admin-operations.md](./epic-5-admin-operations.md) | Admin Operations | Day 6 | F15–F19 | HIGH/MEDIUM |

---

## 9. Design Gap Summary (CRITICAL)

Approximately **50% of required v1 screens are designed** in Figma as of May 5, 2026.

**Priority missing screens to design first:**
1. Weekly submission flow (both platforms)
2. Admin report review and approval screen
3. Admin dashboard

**Missing entirely:** desktop absence form, admin rejection dialog, month lock/unlock screen, timer UI, audit log viewer, export screen, holiday settings, first-login password change, user rejection notice, delete/archive confirmation modals.

**Missing UI states on all existing screens:** loading, server error, offline, locked-month banner, unsaved changes warning.

> Full design gap analysis: see master spec section 17.
