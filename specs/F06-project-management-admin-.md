# F06: Project Management (Admin)

| | |
|---|---|
| **Phase** | 3 |
| **Sprint** | Sprint 2–3 |
| **Assigned to** | Dev B (Backend) + Dev D (Frontend) |
| **Severity** | CRITICAL |
| **Depends on** | F02, F03, F05 |

## Summary

Admin CRUD for projects. Each project belongs to one client. Tasks can be added from the project screen.

## Tasks & Subtasks

### 1. Backend: Projects module

- [ ] GET /projects — list (Admin: all; User: only projects with assigned tasks). Filter by client_id, is_active
- [ ] GET /projects/:id — single project with tasks list
- [ ] POST /projects — create **(Admin only** — `canAssignProjectTasks` flag does NOT grant project creation): client_id, name. Default is_active=true. Warn on duplicate name under same client.
- [ ] PUT /projects/:id — update **(Admin only)**
- [ ] DELETE /projects/:id — soft delete. Warning if has active tasks. **Archiving a project removes all its tasks from user-facing reporting dropdowns (GET /tasks filters by project.is_active=true).**
- [ ] All mutations audit logged

### 2. Frontend: Project list page

- [ ] Create ProjectListPage.jsx with table: client name, project name, status, task count, actions
- [ ] Filter by client, status
- [ ] Inline button to add task from project row (per original spec)
- [ ] Mobile responsive

### 2b. Required UI states (v3.2 §14.1)

- [ ] **Loading**: skeleton rows
- [ ] **Empty**: 'No projects yet' with create button
- [ ] **Save success**: toast after create/edit
- [ ] **Delete confirm**: dialog before archive ('All tasks will be hidden from dropdowns')
- [ ] **Disabled control**: edit/archive buttons greyed for non-admin with tooltip 'Admin only'
- [ ] **Server error**: toast on 500

### 3. Tests

- [ ] Test: Project requires valid client_id
- [ ] Test: Duplicate name warns but allows
- [ ] Test: User sees only assigned projects

## API Endpoints


| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | /projects | User/Admin | List (filtered) |
| GET | /projects/:id | User/Admin | Single with tasks |
| POST | /projects | Admin | Create |
| PUT | /projects/:id | Admin | Update |
| DELETE | /projects/:id | Admin | Soft delete |

## Database Tables

projects

## Screens / UI

ProjectListPage, ProjectForm (modal)

## UI/UX — Pixel-Perfect Design Reference

> Source: Figma management admin exports `managment_Group_932` (empty) + `managment_Group_935` (filled). Tokens updated per Figma MCP extraction. Full token reference: `specs/figma-design-spec.md`

### ProjectListPage

Same table layout as F04/F05. Column order (RTL):
- שם פרויקט | שם לקוח | מנהל ראשי | תאריך התחלה | תאריך סיום | סטטוס | [פעולות]

Employee pill tags in "עובדים משויכים" column: same style as F05 (28px, #F1F3F5, overflow "+N")

### ProjectForm Modal

**Modal header:**
- Title: "יצירת פרויקט" / "עריכת פרויקט" `22px weight 700`
- Icon button (project/folder SVG): `40×40px, background: #142A3F, border-radius: 10px`

**Fields:**
- שם הפרוייקט: text input, `height: 48px`
- שם הלקוח: dropdown (select from existing clients)
- שיוך מנהל ראשי: dropdown (select from users with manager role)
- Date range row: [תאריך התחלה input] — [תאריך סיום input]
  - Both inputs side by side, separated by `—` em-dash text
  - Format: `DD/MM/YYYY`, `height: 48px`
  - Calendar icon on left side (RTL end) of each input
- תאור הפרויקט: textarea, `min-height: 80px`

**Footer CTA states:**
- Empty/invalid: "צור פרוייקט ⊕" `background: #9CA3AF` (disabled gray)
- All filled: "צור פרוייקט ⊕" `background: #142A3F` (active navy)
- Edit mode: "שמירה" `background: #142A3F`

## Files to Create/Modify

- `server/src/modules/projects/*`
- `client/src/features/admin/projects/*`

## Acceptance Criteria

- [ ] Projects belong to clients
- [ ] Can add task from project screen
- [ ] Soft delete works with warning
- [ ] Only Admin can create/edit/archive projects — `canAssignProjectTasks` flag does not grant write access here
- [ ] Archived project's tasks excluded from all user-facing reporting dropdowns

