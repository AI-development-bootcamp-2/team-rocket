# F05: Client Management (Admin)

| | |
|---|---|
| **Phase** | 3 |
| **Sprint** | Sprint 2–3 |
| **Assigned to** | Dev A (Backend) + Dev C (Frontend) |
| **Severity** | CRITICAL |
| **Depends on** | F02, F03 |

## Summary

Admin CRUD for clients: create, edit, soft delete (archive). Clients default to active.

## Tasks & Subtasks

### 1. Backend: Clients module

- [x] GET /clients — list all clients (Admin: all; User: only clients with assigned tasks)
- [x] GET /clients/:id — single client
- [x] POST /clients — create (Admin only): `name`, `contact_info` (optional), `client_number` (optional, admin-assigned human-readable identifier e.g. `#001`, UNIQUE). Default `is_active=true`. **If name already exists (case-insensitive): return 201 with `{ data: {...}, warning: 'A client with this name already exists' }` — warn but allow (per v3.2 section 6).**
- [x] PUT /clients/:id — update (Admin only): `name`, `contact_info`, `client_number`, `is_active`
- [x] DELETE /clients/:id — soft delete: set is_active=false (Admin only). Warning if has active projects. **Archiving a client removes all its projects and tasks from all user-facing reporting dropdowns immediately (GET /projects and GET /tasks filter by client.is_active=true).**
- [x] All mutations audit logged

### 2. Frontend: Client list page

- [ ] Create ClientListPage.jsx with table: name, contact info, status, project count, actions
- [ ] Filter by active/inactive
- [x] Create/edit via modal form (ClientForm.jsx)
- [ ] Archive confirmation with warning: 'This client has X active projects'
- [ ] Mobile responsive

### 2b. Required UI states (v3.2 §14.1)

- [ ] **Loading**: skeleton while list fetches
- [ ] **Empty**: 'No clients yet' with create button
- [ ] **Save success**: toast after create/edit
- [ ] **Delete confirm**: dialog before archive ('All projects and tasks will be hidden from user dropdowns')
- [ ] **Validation error**: duplicate name shows inline warning (not a block — allow with warning)
- [ ] **Server error**: toast on 500

### 3. Tests

- [x] Test: Create client returns 201
- [x] Test: Archive sets is_active=false
- [x] Test: User endpoint returns only assigned clients
- [x] Test: Non-admin cannot create/edit/delete

## API Endpoints


| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | /clients | User/Admin | List (filtered by role) |
| GET | /clients/:id | User/Admin | Single client |
| POST | /clients | Admin | Create |
| PUT | /clients/:id | Admin | Update |
| DELETE | /clients/:id | Admin | Soft delete |

## Database Tables

clients

## Screens / UI

ClientListPage, ClientForm (modal)

## UI/UX — Pixel-Perfect Design Reference

> Source: Figma management admin exports `managment_Group_931` (empty) + `managment_Group_934` (filled). Tokens updated per Figma MCP extraction. Full token reference: `specs/figma-design-spec.md`

### ClientListPage

Same table layout as F04 UserListPage (see above). Column order (RTL):
- שם לקוח | מס׳ לקוח | תאריך יצירה | פרויקטים פעילים | סטטוס | [פעולות]

Employee pill tags in "עובדים משויכים" column (if shown):
- Each employee: `height: 28px, background: #F1F3F5, border-radius: 14px, font: 12px`
- Overflow: "+N" badge `#142A3F`
- Hover tooltip: dark card `background: #1E2540, color: #FFFFFF, border-radius: 8px`

### ClientForm Modal

**Modal header:**
- Title: "יצירת לקוח" (create) / "עריכת לקוח" (edit) `22px weight 700`
- Icon button (briefcase SVG): `40×40px, background: #142A3F, border-radius: 10px`
- "עריכה" badge next to title in edit mode: `background: #DBEAFE, color: #2563EB, font: 12px, border-radius: 4px`

**Fields:**
- שם הלקוח: text input, `height: 48px`
- תאור הלקוח: textarea, `min-height: 80px`

**Footer:** "שמירה" button full-width `height: 48px, background: #142A3F`

### Delete Confirmation Dialog (Client/Any entity)

- Centered modal ~400px, `border-radius: 12px`
- Red trash icon centered top
- Title: "למחוק את הלקוח [שם]?" `20px weight 700 #111827`
- Body: warning text `14px #6B7280`
- Buttons: [ביטול `background: #6B7F9E`] [מחיקה `background: #EF4444`]
  Both: `height: 44px, border-radius: 8px, color: #FFFFFF`

## Files to Create/Modify

- `server/src/modules/clients/*`
- `client/src/features/admin/clients/*`

## Acceptance Criteria

- [ ] Admin can create, edit, archive clients
- [ ] User sees only their assigned clients
- [ ] Archive shows warning about related projects
- [ ] Duplicate client name: allowed but returns warning
- [ ] Archived client's projects and tasks excluded from all user-facing dropdowns

