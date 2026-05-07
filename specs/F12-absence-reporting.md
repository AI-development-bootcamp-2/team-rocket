# F12: Absence Reporting

| | |
|---|---|
| **Phase** | 5 |
| **Sprint** | Sprint 4–5 |
| **Assigned to** | Dev B (Backend) + Dev D (Frontend) |
| **Severity** | MAJOR |
| **Depends on** | F03, F02 |

## Summary

Report absences: vacation, sick, reserve duty, other. Date range with auto Friday/Saturday exclusion. Partial absence. Document upload for sick/reserve.

## Tasks & Subtasks

### 1. Backend: Absences module

- [ ] GET /absences — list by user, month, type  > **Scoping**: User sees own absences only. Admin sees all users' absences; optionally filtered by `user_id`, `date_from`, `date_to`.- [ ] POST /absences — create: `type`, `start_date`, `end_date`, `is_partial`, `notes`. Status defaults to `draft`. Auto-exclude Fri/Sat from count. Validate against monthly quota.
  > **Document validation**: POST/PUT without document → accept, return `{ data, warning: 'חובה לצרף מסמך עד להגשה' }`. Hard block only happens at weekly submission (F13): if week contains `sick`/`reserve` absence without a document, `POST /weekly-submissions/submit` returns 422.
  > **Absence status lifecycle (Option A)**: absences use `status IN ('draft','submitted')` only — no independent approval flow. When a weekly submission is approved, all absences in that week are implicitly approved (their status becomes `submitted` on weekly submit, and approval is tracked via the weekly submission record).
- [ ] PUT /absences/:id — update (only if week not submitted). **Requires `version` field. If DB.version !== body.version → 409 Conflict (same optimistic lock pattern as time_entries in F09).**
- [ ] DELETE /absences/:id — soft delete (only if week not submitted)
- [ ] POST /absences/:id/documents — upload file. Validate: PDF/JPG/JPEG/PNG/DOC/DOCX, max 10MB, server-side MIME check. Allowed even after submission/lock (audit logged).
- [ ] DELETE /absences/:id/documents/:docId — remove document (audit logged)
- [ ] Calculate absence impact on monthly quota (full day = -9h, partial = -4.5h)
- [ ] Validate: sick requires document, reserve requires document, other has optional notes
- [ ] Validate: partial absence requires work entries for remaining hours
- [ ] Future absences allowed

### 2. Frontend: Absence report page

- [ ] AbsenceReportPage.jsx — form + list of existing absences
- [ ] AbsenceForm.jsx: type dropdown (4 types), date range picker, partial checkbox, notes textarea
- [ ] Date range picker auto-grays-out Fri/Sat
- [ ] Document upload component (drag-and-drop or file picker)
- [ ] Show document requirement indicator for sick/reserve
- [ ] AbsenceList.jsx: table of absences with status, edit/delete, **document download link(s)** (if absence has attachments, show file name as download link calling GET /absences/:id/documents/:docId which streams the file — auth-protected)
- [ ] Desktop version (currently TBD in Figma — needs design before this task can be built)

### 2b. Required UI states (v3.2 §14.1)

- [ ] **Loading**: skeleton absence list
- [ ] **Empty**: 'No absences reported' message
- [ ] **Validation error**: sick/reserve without document shows inline warning (not a hard block until submit)
- [ ] **Save success**: toast 'Absence saved'
- [ ] **Delete confirm**: dialog before delete
- [ ] **Disabled control**: edit/delete disabled for submitted weeks (tooltip 'שבוע זה כבר הוגש')
- [ ] **Server error**: toast on 500

### 3. Tests

- [ ] Test: Fri/Sat excluded from date range
- [ ] Test: Sick without document shows warning
- [ ] Test: Partial absence requires work hours for remainder
- [ ] Test: File upload validates type and size
- [ ] Test: Document upload after lock is audit logged
- [ ] Test: Absence reduces monthly quota correctly

## API Endpoints


| Method | Endpoint | Auth |
|--------|----------|------|
| GET | /absences | User/Admin |
| POST | /absences | User |
| PUT | /absences/:id | User (pre-submit) |
| DELETE | /absences/:id | User (pre-submit) |
| POST | /absences/:id/documents | User (always) |
| GET | /absences/:id/documents/:docId | User/Admin (auth-protected file stream) |
| DELETE | /absences/:id/documents/:docId | User/Admin |

## Database Tables

absence_entries, attachments

## Screens / UI

AbsenceReportPage, AbsenceForm, DocumentUpload, AbsenceList

## UI/UX — Pixel-Perfect Design Reference

> Source: Figma mobile app exports (absence tab, multi-day absence screen). Tokens updated per Figma MCP extraction. Full token reference: `specs/figma-design-spec.md`

### Absence Tab (within Manual Report bottom sheet — Mobile)

**Tab structure:** Segmented control "דיווח עבודה" | "דיווח היעדרות" — same pill style as work tab  
Full description in F09; absence tab content detailed here.

**Absence type dropdown:**
- Full-width, `height: 48px, border: 1px solid #E0E0E0, border-radius: 8px`
- Default placeholder: "סוג העדרות" `color: #666666`
- Options (with emoji):
  - 🏖️ חופשה - חצי יום
  - 🏖️ חופשה - יום מלא
  - 😷 מחלה
  - 🪖 מילואים
- Open state: floating card below trigger, `background: #FFFFFF, box-shadow, border-radius: 10px`
  Item height: `44px`, separator: `#F3F4F6`
  Selected: text `#3B82F6` + filled circle check on left side `#3B82F6`

**"צירוף קבצים רלוונטים" section:**
- Section label: `15–16px weight 500 #1A1A2E`, right-aligned

**File upload drop zone:**
- `background: #EFF6FF, border: 2px dashed #3B82F6, border-radius: 12px, padding: 24px`
- Folder icon: `background: circular blue, icon: #3B82F6, ~48px`
- Link: "לחץ כאן להעלאת הקובץ" `#3B82F6 underlined`
- Format hint: "סוגי הקבצים הנתמכים: JPG / PNG / PDF" `smaller, #3B82F6`

**Uploaded file row** (replaces drop zone after upload):
- `height: 56px, background: #FFFFFF, border: 1px solid #E0E0E0, border-radius: 8px`
- Right: PDF icon (white paper + red "PDF" badge)
- Center: filename `14px #111827`
- Left: red trash icon `#EF4444`

**"או" divider + multi-day navigation:**
- Horizontal rule + "או" centered text
- "לדווח על העדרות יותר מיום אחד" nav row → tap → navigates to multi-day screen

### Multi-Day Absence Screen (AbsenceReportPage — Mobile)

**Header:** title "דיווח העדרות לפי טווח" centered bold + `>` nav button (circle `#FFFFFF`) on right

**Form fields:**
- Absence type dropdown (same as above)
- Hint text: "מלא את הזמנים" `13px #666666`
- "תאריך התחלה" row:
  - Label right: `15px weight 500 #1A1A2E`
  - Date chip left: rounded pill, `border: 1.5px solid #3B82F6 (filled)` / turns `#EF4444` when picker open
  - Tap → inline calendar expands below row
- "תאריך סיום" row: same as start date
- "סה"כ ימי דיווח: X ימים" auto-calculated: value `#3B82F6` bold
- File upload zone (same as single-day)

**Inline calendar** (expands between rows on tap):
- `background: #FFFFFF, border-radius: 12px, padding: 12px`
- Header: `<` `>` month arrows (both sides) + month name right + year link left
- Day headers: abbreviated Hebrew, `12px #666666`
- Cells: `44×44px`; selected = filled navy circle `#142A3F` `36px diameter`; range = `#EFF6FF` row
- Active field (start vs end): active date chip outlined red `#EF4444` to show "editing this"

**Full calendar modal** (alternative to inline, if date range picker style):
- Centered overlay modal `~340px wide, radius: 16px, overlay: rgba(0,0,0,0.25)`
- Below calendar: [נקה `border: 1px solid #E0E0E0, ~25% width`] + [שמירה `bg: #1A2B4A, ~72% width`]
  Both: `height: 48px, border-radius: 10px`

### Absence Tab (Webapp — same modal/drawer as F09)

- "דיווח העדרות" tab in the daily edit modal
- Contains: absence type dropdown + optional time fields + file upload zone
- Same input/card styling as webapp (see F09 UI/UX section)

## Files to Create/Modify

- `server/src/modules/absences/*`
- `server/src/utils/fileUtils.js`
- `client/src/features/absences/*`

## Acceptance Criteria

- [ ] All 4 absence types work
- [ ] Fri/Sat auto-excluded
- [ ] Document upload with type/size validation
- [ ] Quota updated correctly
- [ ] Post-lock upload audit logged

