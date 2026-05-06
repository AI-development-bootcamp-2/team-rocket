# F07: Task Management (Admin)

| | |
|---|---|
| **Phase** | 3 |
| **Sprint** | Sprint 2–3 |
| **Assigned to** | Dev B (Backend) + Dev D (Frontend) |
| **Severity** | CRITICAL |
| **Depends on** | F02, F03, F06 |

## Summary

Admin CRUD for tasks. Each task belongs to one project. Status: open/closed.

## Tasks & Subtasks

### 1. Backend: Tasks module

- [ ] GET /tasks — list, filter by project_id, status
- [ ] **GET /tasks/:id** — returns task details + parent project name + parent client name
- [ ] POST /tasks — create (Admin only): project_id, name. Default status=open.
- [ ] PUT /tasks/:id — update name, status
- [ ] DELETE /tasks/:id — soft delete: set status=closed. **Existing user-task assignments remain in DB but the task is excluded from all reporting dropdowns (status filter). Historical time entries are preserved.**
- [ ] All mutations audit logged

### 2. Frontend: Task list page

- [ ] Create TaskListPage.jsx
- [ ] Table: project, task name, status badge, assigned users count, actions
- [ ] Filter by project, status

### 2b. Required UI states (v3.2 §14.1)

- [ ] **Loading**: skeleton rows
- [ ] **Empty**: 'No tasks yet' with create button
- [ ] **Save success**: toast after create/edit
- [ ] **Delete confirm** (close task): dialog 'Task will be removed from all reporting dropdowns. Historical entries are preserved.'
- [ ] **Disabled control**: closed task row shows 'Closed' badge; reopen is admin-only
- [ ] **Server error**: toast on 500

### 3. Tests

- [ ] Test: Task requires valid project_id
- [ ] Test: Closing task sets status=closed
- [ ] **Test: GET /tasks does NOT return closed tasks when `status=open` filter applied**
- [ ] **Test: POST /time-entries with closed task_id returns 422 with error 'Task is closed'**
- [ ] **Test: GET /tasks/:id returns 404 for non-existent task**
- [ ] **Test: Closing a task does not delete existing time entries or assignments**

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

## UI/UX — Pixel-Perfect Design Reference

> Source: Figma management admin exports `managment_Group_933` (empty) + `managment_Group_936` (filled). Tokens updated per Figma MCP extraction. Full token reference: `specs/figma-design-spec.md`

### TaskListPage

Same table layout as F04–F06. Column order (RTL):
- שם משימה | פרויקט | לקוח | תאריך התחלה | תאריך סיום | סטטוס | [פעולות]

### TaskForm Modal

**Modal header:**
- Title: "יצירת משימה" / "עריכת משימה" `22px weight 700`
- Icon button (task/checkmark SVG): `40×40px, background: #142A3F, border-radius: 10px`

**Fields:**
- שם המשימה: text input, `height: 48px`
- שיוך לפרוייקט קיים: dropdown (cascades client → project lookup), `height: 48px`
- Date range row: [תאריך התחלה] — [תאריך סיום] (same style as F06 project dates)
- תאור המשימה: textarea, `min-height: 80px`

**Footer CTA states:**
- Empty: "צור משימה ⊕" `background: #9CA3AF`
- Filled: "צור משימה ⊕" `background: #142A3F`
- Edit mode: "שמירה" `background: #142A3F`

**Empty list state:**
- Centered illustration (person + question marks SVG), `18px` text "אין מידע קיים עד כה"

## Files to Create/Modify

- `server/src/modules/tasks/*`
- `client/src/features/admin/tasks/*`

## Acceptance Criteria

- [ ] Tasks belong to projects
- [ ] Status toggle open/closed
- [ ] Closed task not available in reporting dropdowns

