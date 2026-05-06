# F04: User Management (Admin)

| | |
|---|---|
| **Phase** | 3 |
| **Sprint** | Sprint 2–3 |
| **Assigned to** | Dev A (Backend) + Dev C (Frontend) |
| **Severity** | CRITICAL |
| **Depends on** | F02, F03 |

## Summary

Admin CRUD for users: create with initial password, edit details, toggle active/inactive, change role, grant permission flags. Employee table view.

## Tasks & Subtasks

### 1. Backend: Users module

- [ ] GET /users — list all users (Admin only), with filters: active/inactive, role, search by name/email
- [ ] GET /users/:id — single user details (Admin only)
- [ ] GET /users/me — current user profile (any authenticated user)
- [ ] POST /users — create user (Admin only): `first_name`, `last_name`, email, initial password, role (`'admin'|'user'` — no other values). Optional profile fields: `employee_number`, `employment_type` (`full_time|part_time|contractor`), `employment_percentage` (0–100, default 100), `department`, `daily_hours_override`. Set `must_change_password=true`
- [ ] PUT /users/:id — update user (Admin only): `first_name`, `last_name`, email, role, `is_active`, `employee_number`, `employment_type`, `employment_percentage`, `department`, `daily_hours_override`
- [ ] DELETE /users/:id — soft delete: set `is_active=false` (Admin only). **Cannot deactivate self — returns 403 `{ error: 'SELF_DEACTIVATION_FORBIDDEN', message: 'אינך יכול לבטל את הפעלת החשבון שלך' }`**
- [ ] Validate: email uniqueness, password policy on create, cannot deactivate self
- [ ] On deactivate: kill all active sessions for that user (delete from refresh_tokens)
- [ ] All mutations audit logged
- [ ] **PUT /users/me** — authenticated user can update own `first_name` and `last_name` only (email/role changes require Admin). Note: UI sends `first_name` + `last_name` separately; server stores them as separate columns. Returns updated user profile.
- [ ] **POST /users/me/sort-preference** — store `{ client_id, project_id, task_id }` frequency map per user. Stored as `sort_prefs JSONB` in users table (add column to F02 migration 001). Returns 204.

### 2. Backend: Permission flags

- [ ] POST /users/:id/permissions — grant canAssignProjectTasks with scoped_project_ids array
- [ ] DELETE /users/:id/permissions/:flagId — revoke flag
- [ ] GET /users/:id/permissions — list flags for a user
- [ ] Validate: only Admin can grant, scoped_project_ids must be valid active projects

### 3. Frontend: User list page

- [ ] Create UserListPage.jsx with table: name, email, role, status badge, actions
- [ ] Search bar (by name or email)
- [ ] Filter by: role (user/admin), status (active/inactive)
- [ ] Action buttons: edit, deactivate/reactivate, reset password
- [ ] Create button opens UserForm modal/page
- [ ] Mobile responsive: card layout on small screens

### 3b. Required UI states (v3.2 §14.1)

- [ ] **Loading**: skeleton rows while user list fetches
- [ ] **Empty**: 'No users found' with create button
- [ ] **No-permission**: 403 page if non-admin somehow reaches this route
- [ ] **Server error**: toast on 500
- [ ] **Save success**: toast after create/edit
- [ ] **Delete confirm**: confirmation dialog before deactivate ('This will log the user out immediately')
- [ ] **Disabled control**: deactivate-self button disabled with tooltip 'Cannot deactivate your own account'

### 4. Frontend: User form

- [ ] Create UserForm.jsx — used for both create and edit
- [ ] Fields: first name, last name (displayed concatenated as `"${first} ${last}"` everywhere in UI), email, password (create only), role dropdown (`משתמש` / `מנהל`), is_active toggle
- [ ] Optional profile fields section: employee number, employment type, employment percentage, department, daily hours override
- [ ] Permission flag section: toggle canAssignProjectTasks, multi-select for allowed projects
- [ ] Validation: required fields, email format, password strength (create only)
- [ ] Confirmation dialog on deactivate (warning about active sessions)

### 5. Frontend: Reset password dialog

- [ ] Create ResetPasswordDialog.jsx
- [ ] Admin enters new temporary password
- [ ] Shows confirmation: 'User will be required to change password on next login'
- [ ] Success toast after reset

### 6. Tests

- [ ] Test: Admin can create user with valid data
- [ ] Test: Duplicate email returns 409
- [ ] Test: Non-admin cannot access user endpoints
- [ ] Test: Deactivate sets is_active=false and user cannot login
- [ ] Test: Permission flag correctly scopes project access

## API Endpoints


| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | /users | Admin | List users with filters |
| GET | /users/:id | Admin | Single user |
| GET | /users/me | User | Own profile |
| PUT | /users/me | User | Update own full_name |
| POST | /users/me/sort-preference | User | Persist dropdown sort preference |
| POST | /users | Admin | Create user |
| PUT | /users/:id | Admin | Update user |
| DELETE | /users/:id | Admin | Soft delete (deactivate) |
| POST | /users/:id/permissions | Admin | Grant permission flag |
| DELETE | /users/:id/permissions/:flagId | Admin | Revoke permission flag |

## Database Tables

users, permission_flags

## Screens / UI

UserListPage, UserForm (modal), ResetPasswordDialog

## UI/UX — Pixel-Perfect Design Reference

> Source: Figma management admin desktop exports. Tokens updated per Figma MCP extraction (File ID: `91bxDhniN8DFIWjo9dLuLR`). Full token reference: `specs/figma-design-spec.md`

### UserListPage

**Layout:** standard management layout — sidebar `#1B2450` (280px) + page bg `#F3F4F6`

**Page header (RTL):**
- Right: title "ניהול משתמשים" `22px weight 700 #111827` + subtitle `13px #6B7280`
- Left: "יצירה" dropdown button `background: #142A3F, height: 36px, border-radius: 8px`

**Search row:** search input `width: 240px, height: 40px`, magnifier icon right (RTL end = left)

**Users table:**
- Container: `background: #FFFFFF`, `border-radius: 8px`, box-shadow
- Header: `background: #1B2340`, white text `14px weight 600`, `height: 48px`
- Rows: `height: 48–52px`, `border-bottom: 1px solid #E5E7EB`
- Hover row: `background: #EFF6FF`
- Column order (RTL right → left): שם מלא | מס׳ עובד | תפקיד | סוג | אחוז משרה | שיוך ארגוני | סטטוס | [פעולות]
- Status badge: Active = `#DCFCE7 + #16A34A`, Inactive = `#E5E7EB + #050804`
- Actions column: edit pencil icon + delete trash icon (both `#666666`, on hover `#142A3F` / `#EF4444`)
- Right-click context menu: "עריכה" (blue) + "מחיקה" (red) card `border-radius: 8px, box-shadow`

**Checkbox (multi-select):**
- Unchecked: `border: 1.5px solid #E0E0E0`, `width: 16px, height: 16px, border-radius: 3px`
- Checked: `background: #142A3F`, white ✓ checkmark

**Pagination:** centered, navy active page `#142A3F`, 15 rows/page default

### UserForm (modal) — Create/Edit

**Layout:** centered modal `width: 600px, border-radius: 12px`, overlay `rgba(0,0,0,0.45)`

**Modal header (RTL):**
- Right: title "יצירת משתמש" / "עריכת משתמש" `22px weight 700`
- Left: icon button (user+ SVG) `40×40px, background: #142A3F, border-radius: 8px`
- Top-left: × close `32px circle, border: 1px solid #E5E7EB`

**Fields:** שם פרטי + שם משפחה (side by side) | מס׳ עובד | דואר אלקטרוני | תפקיד (dropdown) | סוג משרה (dropdown) | אחוז משרה | שיוך ארגוני | תקן שעות יומי
- Input: `height: 48px, border: 1px solid #E0E0E0, border-radius: 8px`
- Label: `14px weight 500 #050804`, above each input

**Permissions toggle section** (permission_flags):
- Toggle rows, each `height: 48px`
- Toggle switch: `40×24px`, active `#142A3F`, inactive `#E0E0E0`

**Footer:** "שמירה" button full-width `height: 48px, background: #142A3F, border-radius: 8px`
- Disabled: `background: #9CA3AF` when required fields empty

### ResetPasswordDialog

**Layout:** smaller modal ~400px, same styling
- Title: "איפוס סיסמה" + body text warning `14px #6B7280`
- Buttons: [ביטול `#6B7F9E`] + [איפוס `#142A3F`]

## Files to Create/Modify

- `server/src/modules/users/*`
- `client/src/features/admin/users/*`

## Acceptance Criteria

- [ ] Admin can create, edit, deactivate users
- [ ] Employee table shows all users with correct data
- [ ] Deactivated user cannot log in
- [ ] Permission flag restricts scope correctly
- [ ] All actions appear in audit log
- [ ] Admin cannot deactivate own account — returns 400 with clear message
- [ ] User can update own full_name via PUT /users/me
- [ ] Sort preference persisted and returned in dropdown-data endpoint

