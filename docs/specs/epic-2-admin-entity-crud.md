# Epic 2 — Admin Entity CRUD

> **Days**: Day 2 | **Priority**: CRITICAL  
> **Goal**: Admin can manage all master data  
> **Features**: F04, F05, F06, F07, F08

---

## Features

| ID | Feature | Lead |
|----|---------|------|
| F04 | Users — Backend + Frontend | Dev A (BE), Dev C (FE) |
| F05 | Clients — Backend + Frontend | Dev B (BE), Dev D (FE) |
| F06 | Projects — Backend + Frontend | Dev B (BE), Dev D (FE) |
| F07 | Tasks — Backend + Frontend | Dev B (BE), Dev D (FE) |
| F08 | Assignments — Backend + Frontend | Dev B (BE), Dev D (FE) |

**Milestone**: Admin can create users, clients, projects, tasks, and assign users to tasks.

---

## F04 — User Management

### Business Rules
- Admin can create users with an initial password (user must change on first login)
- Admin can edit: full name, email, role, `is_active`
- Admin can deactivate a user → all active sessions terminate immediately
- Admin can reset a user's password → generates a temporary password, user must change on next login
- The `canAssignProjectTasks` flag can be granted per user with a specific list of scoped project IDs
- Users CANNOT be hard-deleted; only deactivated (`is_active = false`)

### API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/users` | Admin | List all users (with filters: role, is_active) |
| GET | `/users/:id` | Admin | Get single user details |
| POST | `/users` | Admin | Create user |
| PUT | `/users/:id` | Admin | Edit user (name, email, role, is_active) |
| DELETE | `/users/:id` | Admin | Soft deactivate (sets is_active = false) |
| POST | `/users/:id/reset-password` | Admin | Reset user password, forces must_change_password |
| GET | `/users/me` | Any authenticated | Get own profile |
| PUT | `/permission-flags/:userId` | Admin | Set/update canAssignProjectTasks flag + scoped projects |

### Create User Request

```json
// POST /users
{
  "email": "employee@company.com",
  "fullName": "שם עובד",
  "role": "user",
  "initialPassword": "Temp@1234"
}
// Response: 201 Created with user object. must_change_password = true.
```

### Employee Table View (from spec)
The user list screen must display:
- Full name, email, role, status (active/inactive)
- Action buttons: Edit, Deactivate/Activate, Reset Password

### Audit Logging
All of the following must create an audit log record:
- Create user
- Edit user (old + new values)
- Deactivate / reactivate user
- Change user role or grant/revoke permission flag
- Password reset by admin

---

## F05 — Client Management

### Business Rules
- Admin can create, edit, and archive clients
- Duplicate client names: allowed (no restriction)
- Archiving a client: all its projects and tasks become unreportable (cascade `is_active = false` on cascading dropdowns), but historical reports are preserved
- Cannot hard-delete a client that has historical reports
- Deletion requires: confirmation modal → warning if active projects exist → audit log

### API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/clients` | Admin | List all clients (filter: is_active) |
| GET | `/clients/:id` | Admin | Get single client |
| POST | `/clients` | Admin | Create client |
| PUT | `/clients/:id` | Admin | Edit client |
| DELETE | `/clients/:id` | Admin | Soft archive (is_active = false) |

### Client Object

```json
{
  "id": "uuid",
  "name": "Client Name",
  "contactInfo": "optional free text",
  "isActive": true,
  "createdAt": "2026-01-01T00:00:00Z"
}
```

### Audit Logging
- Create, edit, archive client → audit log with old/new values

---

## F06 — Project Management

### Business Rules
- Projects belong to exactly one client
- Duplicate project names under the same client: **system shows a warning but allows it**
- Archiving a project: all tasks in it become unreportable (they disappear from user dropdowns)
- Admin can create a task directly from the project editing screen
- Cannot hard-delete a project with historical reports

### API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/projects` | Admin | List all projects (filter: client_id, is_active) |
| GET | `/projects/:id` | Admin | Get single project |
| POST | `/projects` | Admin | Create project |
| PUT | `/projects/:id` | Admin | Edit project |
| DELETE | `/projects/:id` | Admin | Soft archive (is_active = false) |

### Cascade Rule
When a client is archived:
1. All its projects → `is_active = false`
2. All tasks under those projects → `status = 'closed'`
3. All active `user_task_assignments` for those tasks → `is_active = false`

---

## F07 — Task Management

### Business Rules
- Tasks belong to exactly one project
- Task lifecycle: `open` → `closed` (soft delete = close)
- Closed tasks disappear from user reporting dropdowns but historical reports remain
- Task can be created directly from the project screen

### API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/tasks` | Admin | List all tasks (filter: project_id, status) |
| GET | `/tasks/:id` | Admin | Get single task |
| POST | `/tasks` | Admin | Create task |
| PUT | `/tasks/:id` | Admin | Edit task (name, status) |
| DELETE | `/tasks/:id` | Admin | Close task (status = 'closed') |

---

## F08 — Assignment Management

### Business Rules
- A user can only be assigned to specific tasks (not to clients or projects broadly)
- No duplicate active assignment for the same user + task combination
- Deactivating an assignment removes the task from the user's reporting dropdowns
- Historical entries linked to deactivated assignments are preserved
- `canAssignProjectTasks` flag: user with this flag can assign users to tasks within their scoped projects ONLY — they cannot create projects/tasks/clients or view other users' reports

### API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/assignments` | Admin | List assignments (filter: user_id, task_id, is_active) |
| POST | `/assignments` | Admin + scoped flag | Assign user to task |
| PUT | `/assignments/:id` | Admin + scoped flag | Toggle is_active |
| DELETE | `/assignments/:id` | Admin | Remove assignment (sets is_active = false) |

### Assignment Matrix UI
The frontend must display an assignment matrix screen:
- Rows: users
- Columns: tasks (grouped by project/client)
- Checkbox per cell = active assignment
- Flag-scoped user sees only their allowed projects

### Scoped Flag Enforcement (Backend)
When a user with `canAssignProjectTasks` calls `/assignments`:
1. Check their `permission_flags.scoped_project_ids`
2. The target task's `project_id` must be in the allowed list
3. Return 403 if not in scope

---

## Dropdown Behavior (User Reporting Dropdowns)

When a user opens the daily reporting form, dropdowns must:
- Show only **active** clients/projects/tasks where the user has an **active** assignment
- Cascade: selecting Client filters Projects; selecting Project filters Tasks
- **Auto-select if only one option exists** at any level
- Sort: alphabetical by default, with user-preference for frequency sort (persisted per user)

---

## Delete / Archive Flow (All Entities)

Every delete action must follow this exact flow:

1. User clicks "Archive" / "Deactivate"
2. System checks for active reports / assignments linked to this entity
3. **Confirmation modal** shown:
   - If linked active records exist: "This client has 5 active projects. Archive all?"
   - Otherwise: standard "Are you sure?" confirmation
4. On confirm: soft delete performed
5. **Success toast** shown
6. **Audit log** record created

---

## Test Plan

| Category | What to test | Priority |
|----------|-------------|---------|
| Permission | All CRUD endpoints return 403 for non-admin users | CRITICAL |
| Permission | canAssignProjectTasks user can only assign within scoped projects | CRITICAL |
| Integration | Create user → must_change_password = true | CRITICAL |
| Integration | Reset password → user flagged for password change | CRITICAL |
| Integration | Deactivate user → all sessions terminated | CRITICAL |
| Integration | Archive client → cascades to projects, tasks, assignments | CRITICAL |
| Integration | Duplicate project name under same client shows warning | MAJOR |
| Integration | Assignment UNIQUE constraint prevents duplicate user+task | MAJOR |
| Audit | Every CRUD action creates correct audit log record | MAJOR |
| UI | Dropdown cascade filters correctly by user assignments | MAJOR |
| UI | Auto-select when only one option exists | MAJOR |
