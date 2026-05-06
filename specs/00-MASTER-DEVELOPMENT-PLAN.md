# Time Reporting System — Development Plan

## How to Use This Plan

This plan breaks the master spec into 19 feature specs. Each feature has tasks with checkbox subtasks, API endpoints, database tables, UI screens, file paths, and acceptance criteria.

For each feature, there is a separate markdown file in the `docs/features/` folder that your devs can pick up independently.

The plan is designed for a **4–6 developer team** with work parallelized across backend/frontend pairs.

---

## Team Structure (Recommended)

| Dev | Role | Focus |
|-----|------|-------|
| Dev A | Backend Lead | Auth, time entries, weekly submissions, approvals |
| Dev B | Backend | Clients, projects, tasks, assignments, month lock, audit log |
| Dev C | Frontend Lead | Auth UI, daily report, monthly view, approval UI, dashboard |
| Dev D | Frontend | Admin CRUD pages, absence UI, audit log UI, month lock UI |
| Dev E | Full-stack | Infrastructure, CI/CD, timer, export, notifications, settings |
| Dev F (if 6) | QA / Frontend | Testing, mobile responsive, UI states, polish |

---

## Sprint Timeline

| Sprint | Duration | Features | Milestone |
|--------|----------|----------|-----------|
| Sprint 1 | 2 weeks | F01 Setup, F02 Database, F03 Auth (start) | Docker runs, DB ready, login works |
| Sprint 2 | 2 weeks | F03 Auth (finish), F04 Users, F05 Clients | Auth complete, admin can manage users+clients |
| Sprint 3 | 2 weeks | F06 Projects, F07 Tasks, F08 Assignments, F09 Reporting (start) | All entities manageable, assignments work |
| Sprint 4 | 2 weeks | F09 Reporting (finish), F11 Monthly View, F12 Absences (start) | Core reporting flow complete |
| Sprint 5 | 2 weeks | F12 Absences (finish), F13 Weekly Submit, F14 Approval, F10 Timer | Lifecycle working end-to-end |
| Sprint 6 | 2 weeks | F15 Month Lock, F16 Dashboard, F17 Audit Log, F18 Export | Admin operations complete |
| Sprint 7 | 2 weeks | F19 Notifications+Settings, Mobile polish, UI states, bug fixes | Feature complete |
| Sprint 8 | 1 week | Testing, documentation, Swagger, README, deployment | Production ready |

---

## Dependency Map

```
F01 (Setup) ──┬── F02 (Database) ──┬── F03 (Auth) ──┬── F04 (Users) ──── F08 (Assignments)
              │                    │               ├── F05 (Clients)         │
              │                    │               ├── F06 (Projects)         │
              │                    │               └── F07 (Tasks) ───────────┘
              │                    │                                           │
              │                    │                          F09 (Daily Reporting) ◄─┘
              │                    │                            │           │
              │                    │                    F11 (Monthly)   F12 (Absences)
              │                    │                            │           │
              │                    │                    F13 (Weekly Submit) ◄┘
              │                    │                            │
              │                    │                    F14 (Approval)
              │                    │                            │
              │                    │              ┌─── F15 (Month Lock)
              │                    │              ├─── F16 (Dashboard)
              │                    │              ├─── F17 (Audit Log)
              │                    │              ├─── F18 (Export)
              │                    │              └─── F19 (Notifications)
              │                    │
              │                    └── F10 (Timer) ← depends on F09
```

---

## Parallel Work Map (Who Works on What, When)

| Sprint | Dev A (BE) | Dev B (BE) | Dev C (FE) | Dev D (FE) | Dev E (FS) |
|--------|------------|------------|------------|------------|------------|
| S1 | F02 DB Schema | F02 DB Indexes | — | — | F01 Setup + F03 Auth BE |
| S2 | F04 Users BE | F05 Clients BE | F03 Auth FE | — | F03 Auth finish |
| S3 | F09 Reporting BE | F06+F07 Projects/Tasks BE | F04 Users FE | F05 Clients FE | F08 Assignments |
| S4 | F09 Reporting BE finish | F08 Assignments BE | F09 Reporting FE | F06+F07 FE | F12 Absences BE |
| S5 | F13 Weekly Submit BE | F12 Absences finish | F09+F11 FE finish | F12 Absences FE | F10 Timer |
| S6 | F14 Approval BE | F15 Month Lock BE | F14 Approval FE + F16 Dashboard | F15 Lock FE + F17 Audit FE | F18 Export |
| S7 | F17 Audit Log BE | Bug fixes | F16 Dashboard FE | Mobile polish | F19 Notifications |
| S8 | Testing + Swagger | Testing | UI states polish | Mobile testing | CD + README |

---

## Project Folder Structure


```
time-report-system/
├── docker-compose.yml
├── .github/
│   └── workflows/
│       ├── ci.yml
│       └── cd.yml
├── client/                          # React frontend
│   ├── Dockerfile
│   ├── package.json
│   ├── vite.config.js
│   ├── public/
│   └── src/
│       ├── main.jsx                 # App entry point
│       ├── App.jsx                  # Router + providers
│       ├── api/                     # API client layer
│       │   ├── client.js            # Axios instance, interceptors, token refresh
│       │   ├── auth.api.js
│       │   ├── users.api.js
│       │   ├── clients.api.js
│       │   ├── projects.api.js
│       │   ├── tasks.api.js
│       │   ├── assignments.api.js
│       │   ├── timeEntries.api.js
│       │   ├── absences.api.js
│       │   ├── weeklySubmissions.api.js
│       │   ├── approvals.api.js
│       │   ├── monthLocks.api.js
│       │   ├── exports.api.js
│       │   ├── auditLogs.api.js
│       │   └── settings.api.js
│       ├── components/              # Shared/reusable UI
│       │   ├── ui/                  # Design system primitives
│       │   │   ├── Button.jsx
│       │   │   ├── Input.jsx
│       │   │   ├── Select.jsx
│       │   │   ├── Modal.jsx
│       │   │   ├── Toast.jsx
│       │   │   ├── Table.jsx
│       │   │   ├── DatePicker.jsx
│       │   │   ├── TimePicker.jsx
│       │   │   ├── FileUpload.jsx
│       │   │   ├── Spinner.jsx
│       │   │   ├── EmptyState.jsx
│       │   │   ├── ErrorState.jsx
│       │   │   └── ConfirmDialog.jsx
│       │   └── layout/
│       │       ├── AppShell.jsx     # Main layout wrapper
│       │       ├── Sidebar.jsx
│       │       ├── Header.jsx
│       │       ├── MobileNav.jsx
│       │       └── ProtectedRoute.jsx
│       ├── features/                # Feature modules
│       │   ├── auth/
│       │   │   ├── LoginPage.jsx
│       │   │   ├── ChangePasswordPage.jsx
│       │   │   ├── useAuth.js
│       │   │   └── AuthContext.jsx
│       │   ├── time-reports/
│       │   │   ├── DailyReportPage.jsx
│       │   │   ├── ReportForm.jsx
│       │   │   ├── ExistingEntriesList.jsx
│       │   │   ├── MonthlyViewPage.jsx
│       │   │   ├── MonthlyCalendar.jsx
│       │   │   ├── ReportHistoryPage.jsx
│       │   │   ├── WeeklySubmitBar.jsx
│       │   │   └── QuotaProgressBar.jsx
│       │   ├── timer/
│       │   │   ├── TimerButton.jsx
│       │   │   ├── TimerCompletionDialog.jsx
│       │   │   └── useTimer.js
│       │   ├── absences/
│       │   │   ├── AbsenceReportPage.jsx
│       │   │   ├── AbsenceForm.jsx
│       │   │   ├── DocumentUpload.jsx
│       │   │   └── AbsenceList.jsx
│       │   ├── notifications/
│       │   │   ├── NotificationBell.jsx
│       │   │   ├── NotificationList.jsx
│       │   │   └── useNotifications.js
│       │   └── admin/
│       │       ├── dashboard/
│       │       │   ├── AdminDashboard.jsx
│       │       │   └── SubmissionStatusTable.jsx
│       │       ├── users/
│       │       │   ├── UserListPage.jsx
│       │       │   ├── UserForm.jsx
│       │       │   └── ResetPasswordDialog.jsx
│       │       ├── clients/
│       │       │   ├── ClientListPage.jsx
│       │       │   └── ClientForm.jsx
│       │       ├── projects/
│       │       │   ├── ProjectListPage.jsx
│       │       │   └── ProjectForm.jsx
│       │       ├── tasks/
│       │       │   ├── TaskListPage.jsx
│       │       │   └── TaskForm.jsx
│       │       ├── assignments/
│       │       │   ├── AssignmentPage.jsx
│       │       │   └── AssignmentMatrix.jsx
│       │       ├── reports-review/
│       │       │   ├── ReportReviewPage.jsx
│       │       │   ├── WeeklyReviewCard.jsx
│       │       │   └── RejectReasonDialog.jsx
│       │       ├── month-lock/
│       │       │   ├── MonthLockPage.jsx
│       │       │   └── LockConfirmDialog.jsx
│       │       ├── audit-log/
│       │       │   └── AuditLogPage.jsx
│       │       ├── export/
│       │       │   └── ExportPage.jsx
│       │       └── settings/
│       │           ├── HolidayCalendarPage.jsx
│       │           └── SystemSettingsPage.jsx
│       ├── hooks/                   # Shared hooks
│       │   ├── useDebounce.js
│       │   ├── usePagination.js
│       │   └── useUnsavedChanges.js
│       ├── stores/                  # State management (Zustand or Context)
│       │   ├── authStore.js
│       │   ├── timerStore.js
│       │   └── notificationStore.js
│       ├── utils/
│       │   ├── formatters.js        # Date, time, duration formatting
│       │   ├── validators.js        # Client-side validation
│       │   ├── constants.js         # Shared constants
│       │   └── rtl.js               # RTL utilities
│       └── styles/
│           └── globals.css
│
├── server/                          # Node.js backend
│   ├── Dockerfile
│   ├── package.json
│   └── src/
│       ├── app.js                   # Express setup, middleware, swagger
│       ├── server.js                # Server entry point
│       ├── config/
│       │   ├── database.js
│       │   ├── jwt.js
│       │   └── env.js
│       ├── middleware/
│       │   ├── auth.middleware.js          # JWT verification
│       │   ├── rbac.middleware.js          # Role/permission checking
│       │   ├── validation.middleware.js    # Request validation
│       │   ├── rateLimiter.middleware.js
│       │   ├── errorHandler.middleware.js
│       │   └── auditLog.middleware.js      # Auto-log mutations
│       ├── modules/                 # Feature modules (controller + service + routes + validation + tests)
│       │   ├── auth/
│       │   │   ├── auth.controller.js
│       │   │   ├── auth.service.js
│       │   │   ├── auth.routes.js
│       │   │   ├── auth.validation.js
│       │   │   └── auth.test.js
│       │   ├── users/
│       │   │   ├── users.controller.js
│       │   │   ├── users.service.js
│       │   │   ├── users.routes.js
│       │   │   ├── users.validation.js
│       │   │   └── users.test.js
│       │   ├── clients/
│       │   │   └── ... (same pattern)
│       │   ├── projects/
│       │   ├── tasks/
│       │   ├── assignments/
│       │   ├── time-entries/
│       │   │   ├── timeEntries.controller.js
│       │   │   ├── timeEntries.service.js
│       │   │   ├── timeEntries.routes.js
│       │   │   ├── timeEntries.validation.js
│       │   │   ├── timeEntries.test.js
│       │   │   └── overlapDetector.js     # Overlap validation logic
│       │   ├── absences/
│       │   ├── weekly-submissions/
│       │   ├── approvals/
│       │   ├── month-locks/
│       │   ├── audit-logs/
│       │   ├── exports/
│       │   ├── notifications/
│       │   ├── timer/
│       │   └── settings/
│       ├── database/
│       │   ├── connection.js
│       │   ├── migrations/          # Numbered migration files
│       │   │   ├── 001_create_users.js
│       │   │   ├── 002_create_clients.js
│       │   │   ├── 003_create_projects.js
│       │   │   ├── 004_create_tasks.js
│       │   │   ├── 005_create_assignments.js
│       │   │   ├── 006_create_time_entries.js
│       │   │   ├── 007_create_absences.js
│       │   │   ├── 008_create_attachments.js
│       │   │   ├── 009_create_weekly_submissions.js
│       │   │   ├── 010_create_month_locks.js
│       │   │   ├── 011_create_audit_logs.js
│       │   │   ├── 012_create_settings.js
│       │   │   ├── 013_create_holiday_calendar.js
│       │   │   ├── 014_create_active_timers.js
│       │   │   └── 015_create_permission_flags.js
│       │   └── seeds/
│       │       ├── admin-user.js    # Default admin account
│       │       └── test-data.js     # Dev/test seed data
│       ├── utils/
│       │   ├── quotaCalculator.js   # Monthly quota math
│       │   ├── durationCalculator.js # Cross-midnight duration
│       │   ├── passwordUtils.js     # Bcrypt hashing
│       │   ├── tokenUtils.js        # JWT sign/verify
│       │   └── fileUtils.js         # Upload handling
│       └── types/
│           └── enums.js             # Status enums, role enums, etc.
│
└── docs/
    ├── master-spec.md
    ├── api-spec.md                  # Swagger source
    └── features/                    # Individual feature specs
        ├── F01-project-setup.md
        ├── F02-database-schema.md
        ├── ...
        └── F19-notifications.md
```


---

## Feature Index

| ID | Name | Phase | Sprint | Severity | Depends On |
|-----|------|-------|--------|----------|------------|
| F01 | Project Setup & Infrastructure | 1 | Sprint 1 | CRITICAL | — |
| F02 | Database Schema & Migrations | 1 | Sprint 1 | CRITICAL | F01 |
| F03 | Authentication | 2 | Sprint 1–2 | CRITICAL | F01, F02 |
| F04 | User Management (Admin) | 3 | Sprint 2–3 | CRITICAL | F02, F03 |
| F05 | Client Management (Admin) | 3 | Sprint 2–3 | CRITICAL | F02, F03 |
| F06 | Project Management (Admin) | 3 | Sprint 2–3 | CRITICAL | F02, F03, F05 |
| F07 | Task Management (Admin) | 3 | Sprint 2–3 | CRITICAL | F02, F03, F06 |
| F08 | User-Task Assignments | 3 | Sprint 3 | CRITICAL | F04, F07 |
| F09 | Daily Time Reporting | 4 | Sprint 3–4 | CRITICAL | F03, F08 |
| F10 | Timer Feature | 6 | Sprint 5 | MAJOR | F09 |
| F11 | Monthly View & Report History | 4 | Sprint 4 | CRITICAL | F09 |
| F12 | Absence Reporting | 5 | Sprint 4–5 | MAJOR | F03, F02 |
| F13 | Weekly Submission | 5 | Sprint 5 | CRITICAL | F09, F12 |
| F14 | Admin Report Review & Approval | 5 | Sprint 5–6 | CRITICAL | F13 |
| F15 | Month Lock/Unlock | 6 | Sprint 6 | CRITICAL | F14 |
| F16 | Admin Dashboard | 6 | Sprint 6 | MAJOR | F13, F14 |
| F17 | Audit Log | 6 | Sprint 6 | CRITICAL | F02 |
| F18 | Export (Excel/PDF) | 6 | Sprint 6 | MAJOR | F14, F15 |
| F19 | Notifications & Holiday Settings | 6 | Sprint 6–7 | MAJOR | F13, F14 |

---

## Individual Feature Specs

See the `docs/features/` folder for individual files:

- `F01-project-setup-infrastructure.md`
- `F02-database-schema-migrations.md`
- `F03-authentication.md`
- `F04-user-management-admin-.md`
- `F05-client-management-admin-.md`
- `F06-project-management-admin-.md`
- `F07-task-management-admin-.md`
- `F08-user-task-assignments.md`
- `F09-daily-time-reporting.md`
- `F10-timer-feature.md`
- `F11-monthly-view-report-history.md`
- `F12-absence-reporting.md`
- `F13-weekly-submission.md`
- `F14-admin-report-review-approval.md`
- `F15-month-lock-unlock.md`
- `F16-admin-dashboard.md`
- `F17-audit-log.md`
- `F18-export-excel-pdf-.md`
- `F19-notifications-holiday-settings.md`
