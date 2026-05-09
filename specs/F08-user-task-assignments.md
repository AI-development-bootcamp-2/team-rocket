# F08: User-Task Assignments

| | |
|---|---|
| **Phase** | 3 |
| **Sprint** | Sprint 3 |
| **Assigned to** | Dev B (Backend) + Dev D (Frontend) |
| **Severity** | CRITICAL |
| **Depends on** | F04, F07 |

## Summary

Assign users to tasks (not to clients or projects). Users only see entities where they have active assignments. Supports canAssignProjectTasks permission flag.

## Tasks & Subtasks

### 1. Backend: Assignments module

- [x] GET /assignments — list. Admin: all. User+flag: within scoped projects. User: own assignments.
- [x] **GET /assignments/:id** — single assignment with user, task, project, client details
- [x] POST /assignments — create: user_id, task_id. Validate no duplicate active assignment. Admin or User+flag (scoped).
- [x] PUT /assignments/:id — toggle is_active
- [x] DELETE /assignments/:id — set is_active=false
- [x] Validate permission flag scope: User+canAssignProjectTasks can only assign within their allowed project IDs
- [x] All mutations audit logged

### 2. Frontend: Assignment page

- [x] Create AssignmentPage.jsx
- [x] Matrix view or table: rows = users, columns = tasks (grouped by project)
- [x] Checkbox to toggle assignment
- [x] Filter by project, user
- [x] **Scoped picker for User+flag**: when current actor has `canAssignProjectTasks` flag, the project dropdown only shows their scoped project IDs. Show a scope-limited label: 'You can only assign within your allowed projects'. Tasks outside scope are greyed out.

### 2b. Required UI states (v3.2 §14.1)

- [x] **Loading**: skeleton matrix
- [x] **Empty**: 'No assignments' per user row
- [x] **No-permission**: 403 if regular user without flag tries to access
- [x] **Disabled control**: out-of-scope tasks greyed with tooltip 'Outside your allowed projects'
- [x] **Save success**: inline confirmation (checkbox state + brief toast)
- [x] **Server error**: toast on 500

### 3. Tests

- [x] Test: No duplicate active assignment
- [x] Test: User+flag can only assign in scoped projects
- [x] Test: Regular user cannot create assignments
- [x] Test: Deactivating assignment hides task from user's dropdowns

## API Endpoints


| Method | Endpoint | Auth |
|--------|----------|------|
| GET | /assignments | Role-filtered |
| GET | /assignments/:id | Role-filtered |
| POST | /assignments | Admin / User+flag |
| PUT | /assignments/:id | Admin / User+flag |
| DELETE | /assignments/:id | Admin / User+flag |

## Database Tables

user_task_assignments, permission_flags

## Screens / UI

AssignmentPage, AssignmentMatrix

## UI/UX — Pixel-Perfect Design Reference

> Source: Figma management admin exports `managment_Group_928`. Tokens updated per Figma MCP extraction. Full token reference: `specs/figma-design-spec.md`

### Assignment Modal (שיוך עובד חדש למשימה)

**Layout:** wider modal `width: 900px, border-radius: 12px`, overlay `rgba(0,0,0,0.45)`

**Modal header (RTL):**
- Right: title "שיוך עובד חדש למשימה" `22px weight 700`
- Below title: breadcrumb trail showing context — Client `→` Project `→` Task
  Each breadcrumb node: `background: #F3F4F6, border-radius: 6px, padding: 4px 8px, font: 12px #050804`
  Arrow separator: `→` `color: #666666`
- Left: icon button (people+ SVG) `40×40px, background: #142A3F, border-radius: 10px`
- Top-left: × close `32px circle`

**Search input:** `width: 100%, height: 40px`, "חיפוש לפי שם עובד" placeholder

**Section label:** "בחר עובד מהרשימה" `14px weight 600 #050804`

**Employee selection table:**
- 7 columns: ☑ checkbox | מס׳ עובד | שם מלא | תפקיד | סוג | אחוז משרה | שיוך ארגוני
- Header: `background: #1B2340, color: #FFFFFF, height: 40px, font: 14px weight 600`
- Rows: `height: 44–48px, border-bottom: 1px solid #E5E7EB`
- Selected row: `background: #EFF6FF`, checkbox `background: #142A3F` with white ✓
- Multi-select: all selected rows highlighted simultaneously

**Footer CTA:**
- Disabled (0 selected): "שייך עובד למשימה ⊕" `background: #9CA3AF`
- Active (≥1 selected): "שייך עובד למשימה ⊕" `background: #142A3F`
- `height: 48px, border-radius: 8px, font: 15px weight 600 #FFFFFF`

### AssignmentMatrix (inline view, if applicable)

The management portal may also show an assignment matrix table (per task → assigned employees list with employee pill tags). Pill tags style: `height: 28px, background: #F1F3F5, border-radius: 14px, font: 12px` — same as F05.

## Files to Create/Modify

- `server/src/modules/assignments/*`
- `client/src/features/admin/assignments/*`

## Acceptance Criteria

- [ ] Users only see assigned tasks in reporting
- [ ] Permission flag scope enforced
- [ ] Assignment history preserved

