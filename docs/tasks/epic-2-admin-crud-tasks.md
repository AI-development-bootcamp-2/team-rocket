# Epic 2 — Admin Entity CRUD Tasks

**Jira Epic**: `[EPIC] Admin Entity Management — Users, Clients, Projects, Tasks, Assignments`  
**Priority**: Critical | **Day**: 2  
**Spec**: [epic-2-admin-entity-crud.md](../specs/epic-2-admin-entity-crud.md)

---

## Story F04 — User Management
**Assignee**: Dev A (BE) / Dev C (FE)  
**Story Points**: 8

### Tasks
- [ ] **T** BE: `GET /users` — list all users with filters (role, is_active)
- [ ] **T** BE: `GET /users/:id` — get single user
- [ ] **T** BE: `POST /users` — create user (Admin only), set `must_change_password = true`
- [ ] **T** BE: `PUT /users/:id` — edit user (name, email, role, is_active)
- [ ] **T** BE: `DELETE /users/:id` — soft deactivate (`is_active = false`), terminate all sessions
- [ ] **T** BE: `POST /users/:id/reset-password` — generate temp password, force change
- [ ] **T** BE: `PUT /permission-flags/:userId` — set/update `canAssignProjectTasks` + scoped project IDs
- [ ] **T** FE: Employee table view — full name, email, role, status columns
- [ ] **T** FE: Create/Edit user form modal
- [ ] **T** FE: Deactivate/Activate toggle with confirmation modal
- [ ] **T** FE: Reset Password button + dialog

#### Subtasks
- [ ] **ST** Permission test: all user CRUD endpoints return 403 for non-admin
- [ ] **ST** Integration test: create user → `must_change_password = true`
- [ ] **ST** Integration test: reset password → user flagged for forced change
- [ ] **ST** Integration test: deactivate user → all sessions terminated
- [ ] **ST** Audit log: create / edit / deactivate / reset-password all logged with old+new values

---

## Story F05 — Client Management
**Assignee**: Dev B (BE) / Dev D (FE)  
**Story Points**: 4

### Tasks
- [ ] **T** BE: `GET /clients` — list clients (filter: is_active)
- [ ] **T** BE: `GET /clients/:id` — get single client
- [ ] **T** BE: `POST /clients` — create client
- [ ] **T** BE: `PUT /clients/:id` — edit client
- [ ] **T** BE: `DELETE /clients/:id` — soft archive (`is_active = false`)
- [ ] **T** FE: Client list screen with Create/Edit/Archive actions
- [ ] **T** FE: Archive confirmation modal with active-project warning

#### Subtasks
- [ ] **ST** Integration test: archive client → cascades is_active to projects, tasks, assignments
- [ ] **ST** Audit log: create / edit / archive logged correctly

---

## Story F06 — Project Management
**Assignee**: Dev B (BE) / Dev D (FE)  
**Story Points**: 4

### Tasks
- [ ] **T** BE: `GET /projects` — list projects (filter: client_id, is_active)
- [ ] **T** BE: `GET /projects/:id` — get single project
- [ ] **T** BE: `POST /projects` — create project
- [ ] **T** BE: `PUT /projects/:id` — edit project
- [ ] **T** BE: `DELETE /projects/:id` — soft archive
- [ ] **T** BE: Cascade logic — archiving project closes tasks and deactivates assignments
- [ ] **T** FE: Project list screen grouped by client
- [ ] **T** FE: Duplicate name warning (warning toast, not blocking)

#### Subtasks
- [ ] **ST** Integration test: duplicate project name under same client shows warning but allows save
- [ ] **ST** Integration test: archive project → tasks closed, assignments deactivated

---

## Story F07 — Task Management
**Assignee**: Dev B (BE) / Dev D (FE)  
**Story Points**: 3

### Tasks
- [ ] **T** BE: `GET /tasks` — list tasks (filter: project_id, status)
- [ ] **T** BE: `GET /tasks/:id` — get single task
- [ ] **T** BE: `POST /tasks` — create task
- [ ] **T** BE: `PUT /tasks/:id` — edit task (name, status)
- [ ] **T** BE: `DELETE /tasks/:id` — close task (`status = 'closed'`)
- [ ] **T** FE: Task list within project screen
- [ ] **T** FE: "Add Task" shortcut directly from project edit screen

#### Subtasks
- [ ] **ST** Integration test: closed task disappears from user reporting dropdowns
- [ ] **ST** Integration test: historical reports still linked after task closed

---

## Story F08 — Assignment Management
**Assignee**: Dev B (BE) / Dev D (FE)  
**Story Points**: 5

### Tasks
- [ ] **T** BE: `GET /assignments` — list assignments (filter: user_id, task_id, is_active)
- [ ] **T** BE: `POST /assignments` — assign user to task (Admin + scoped flag)
- [ ] **T** BE: `PUT /assignments/:id` — toggle is_active
- [ ] **T** BE: `DELETE /assignments/:id` — deactivate assignment
- [ ] **T** BE: Enforce `canAssignProjectTasks` scope — task's project must be in user's allowed list
- [ ] **T** BE: UNIQUE constraint enforcement — no duplicate active user+task assignment
- [ ] **T** FE: Assignment matrix — rows = users, columns = tasks grouped by project
- [ ] **T** FE: Scoped-flag user sees only their allowed projects in matrix

#### Subtasks
- [ ] **ST** Permission test: `canAssignProjectTasks` user cannot assign outside scoped projects → 403
- [ ] **ST** Integration test: UNIQUE constraint prevents duplicate user+task assignment
- [ ] **ST** UI test: dropdown cascade filters correctly by user assignments
- [ ] **ST** UI test: auto-select when only one option exists at any level

---

**✅ Milestone**: Admin can create users, clients, projects, tasks, and assign users to tasks.
