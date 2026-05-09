# F07: Task Management (Admin)

| | |
|---|---|
| **Phase** | 3 |
| **Sprint** | Sprint 2â€“3 |
| **Assigned to** | Dev B (Backend) + Dev D (Frontend) |
| **Severity** | CRITICAL |
| **Depends on** | F02, F03, F06 |

## Summary

Admin CRUD for tasks. Each task belongs to one project. Status: open/closed.

## Tasks & Subtasks

### 1. Backend: Tasks module

- [x] GET /tasks â€” list, filter by `project_id`, `status`
  > **User scoping**: User sees only tasks assigned to them (via `user_task_assignments`). Admin sees all tasks.
- [x] **GET /tasks/:id** â€” returns task details + parent project name + parent client name
- [x] POST /tasks â€” create (Admin only): `project_id`, `name`, `start_date` (optional DATE), `end_date` (optional DATE), `description` (optional TEXT). Default `status=open`.
- [x] PUT /tasks/:id â€” update `name`, `status`, `start_date`, `end_date`, `description`
- [x] DELETE /tasks/:id â€” soft delete: set status=closed. **Existing user-task assignments remain in DB but the task is excluded from all reporting dropdowns (status filter). Historical time entries are preserved.**
- [x] All mutations audit logged

### 2. Frontend: Task list page

- [x] Create TaskListPage.jsx
- [x] Table: project, task name, status badge, assigned users count, actions
- [x] Filter by project, status

### 2b. Required UI states (v3.2 Â§14.1)

- [x] **Loading**: skeleton rows
- [x] **Empty**: 'No tasks yet' with create button
- [x] **Save success**: toast after create/edit
- [x] **Delete confirm** (close task): dialog 'Task will be removed from all reporting dropdowns. Historical entries are preserved.'
- [x] **Disabled control**: closed task row shows 'Closed' badge; reopen is admin-only
- [x] **Server error**: toast on 500

### 3. Tests

- [x] Test: Task requires valid project_id
- [x] Test: Closing task sets status=closed
- [x] **Test: GET /tasks does NOT return closed tasks when `status=open` filter applied**
- [ ] **Test: POST /time-entries with closed task_id returns 422 with error 'Task is closed'** *(blocked — requires F09 time-entries module)*
- [x] **Test: GET /tasks/:id returns 404 for non-existent task**
- [x] **Test: Closing a task does not delete existing time entries or assignments**

## API Endpoints


| Method | Endpoint | Auth |
|--------|----------|------|
| GET | /tasks | User/Admin |
| GET | /tasks/:id | User/Admin |
| POST | /tasks | Admin |
| PUT | /tasks/:id | Admin |
| DELETE | /tasks/:id | Admin |

## Database Tables

tasks

## Screens / UI

TaskListPage, TaskForm (modal)

## UI/UX â€” Pixel-Perfect Design Reference

> Source: Figma management admin exports `managment_Group_933` (empty) + `managment_Group_936` (filled). Tokens updated per Figma MCP extraction. Full token reference: `specs/figma-design-spec.md`

### TaskListPage

Same table layout as F04â€“F06. Column order (RTL):
- ×©× ×ž×©×™×ž×” | ×¤×¨×•×™×§×˜ | ×œ×§×•×— | ×ª××¨×™×š ×”×ª×—×œ×” | ×ª××¨×™×š ×¡×™×•× | ×¡×˜×˜×•×¡ | [×¤×¢×•×œ×•×ª]
> **Implementation note**: The implemented `TasksTable` combines ×¤×¨×•×™×§×˜ + ×œ×§×•×— into one cell (project bold, client below) and adds a "×ž×©×ª×ž×©×™× ×ž×©×•×™×™×›×™× " column as required by §2. This satisfies the "assigned users count" requirement.
### TaskForm Modal

**Modal header:**
- Title: "×™×¦×™×¨×ª ×ž×©×™×ž×”" / "×¢×¨×™×›×ª ×ž×©×™×ž×”" `22px weight 700`
- Icon button (task/checkmark SVG): `40Ã—40px, background: #142A3F, border-radius: 10px`

**Fields:**
- ×©× ×”×ž×©×™×ž×”: text input, `height: 48px`
- ×©×™×•×š ×œ×¤×¨×•×™×™×§×˜ ×§×™×™×: dropdown (cascades client â†’ project lookup), `height: 48px`
- Date range row: [×ª××¨×™×š ×”×ª×—×œ×”] â€” [×ª××¨×™×š ×¡×™×•×] (same style as F06 project dates)
- ×ª××•×¨ ×”×ž×©×™×ž×”: textarea, `min-height: 80px`

**Footer CTA states:**
- Empty: "×¦×•×¨ ×ž×©×™×ž×” âŠ•" `background: #9CA3AF`
- Filled: "×¦×•×¨ ×ž×©×™×ž×” âŠ•" `background: #142A3F`
- Edit mode: "×©×ž×™×¨×”" `background: #142A3F`

**Empty list state:**
- Centered illustration (person + question marks SVG), `18px` text "××™×Ÿ ×ž×™×“×¢ ×§×™×™× ×¢×“ ×›×”"

## Files to Create/Modify

- `server/src/modules/tasks/*`
- `client/src/features/admin/tasks/*`

## Acceptance Criteria

- [x] Tasks belong to projects
- [x] Status toggle open/closed
- [x] Closed task not available in reporting dropdowns
