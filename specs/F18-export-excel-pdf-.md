# F18: Export (Excel/PDF)

| | |
|---|---|
| **Phase** | 6 |
| **Sprint** | Sprint 6 |
| **Assigned to** | Dev E (Full-stack) |
| **Severity** | MAJOR |
| **Depends on** | F14, F15 |

## Summary

Admin exports reports in Excel or PDF format. By month, user, project, client. Unapproved exports show watermark. Final payroll export auto-locks month.

## Tasks & Subtasks

### 1. Backend: Export module

- [ ] GET /exports?month=&year=&user_id=&client_id=&project_id=&format=xlsx|pdf — Admin only
- [ ] Excel generation (using exceljs or xlsx library): date, start/end time, duration, client, project, task, location, description, absence type, approval status, **correction history**
- [ ] **Correction history in export**: for each time_entry, JOIN audit_logs WHERE action IN ('ADMIN_EDIT','ENTRY_CORRECTED') AND target_entity_id = entry.id. If any corrections exist, add a 'Corrections' sub-row or notes column showing: correction date, actor, old value → new value.
- [ ] PDF generation (using pdfkit or puppeteer)
- [ ] If month not approved: add 'NOT APPROVED' watermark on every page
- [ ] If format=payroll: auto-lock the month after export. Call `monthLocksService.lock(year, month, adminId)` (shared service from F15). Set is_locked=true.
- [ ] **Export filename format**: `YYYY-MM_[user_full_name_snake_case]_[report_type].[ext]` e.g. `2026-03_john_smith_monthly.xlsx`. For multi-user exports: `YYYY-MM_all_users_monthly.xlsx`.
- [ ] Add digital timestamp and generating admin ID to export metadata
- [ ] Export action audit logged

### 2. Frontend: Export page

- [ ] ExportPage.jsx — Admin only
- [ ] Filter controls: month picker, user dropdown, client dropdown, project dropdown, format toggle (Excel/PDF)
- [ ] Preview summary before export (row count, date range, approval status)
- [ ] Warning if month not fully approved
- [ ] Checkbox: 'Lock month after export (payroll)' with confirmation
- [ ] Download button triggers file generation + download

### 2b. Required UI states (v3.2 §14.1)

- [ ] **Loading**: spinner on download button while generation is in flight (can take seconds for large exports)
- [ ] **Empty**: 'No entries match your filters' before download
- [ ] **Validation error**: payroll lock checkbox requires all weeks to be approved (inline warning)
- [ ] **Delete confirm**: payroll lock dialog 'This will lock the month and prevent any further editing'
- [ ] **Save success**: file download starts; toast 'Export generated and downloaded'
- [ ] **Server error**: toast on 500

### 3. Tests

- [ ] Test: Export contains correct data for filters
- [ ] Test: Unapproved month has watermark
- [ ] Test: Payroll export locks month
- [ ] Test: Export audit logged

## API Endpoints


| Method | Endpoint | Auth |
|--------|----------|------|
| GET | /exports | Admin |

## Database Tables

time_entries, absence_entries, month_locks (read + write for payroll lock)

## Screens / UI

ExportPage

## UI/UX — Pixel-Perfect Design Reference

> Source: Figma management admin desktop exports. Tokens updated per Figma MCP extraction. Full token reference: `specs/figma-design-spec.md`

### ExportPage

**Layout:** standard management portal layout (sidebar `#1B2450` + page bg `#F3F4F6`)

**Page header:**
- Title: "ייצוא נתונים" `22px weight 700 #111827`

**Export configuration card** (`background: #FFFFFF, border-radius: 12px, padding: 24px`):

**Filter section:**
- Month/year selector: dropdown or month navigator, `height: 48px`
- User(s) selector: multi-select dropdown or "all users" toggle
- Report type radio: "דוח שעות עבודה" / "דוח העדרויות" / "שניהם"

**Format selection:**
- Two format buttons side by side:
  - Excel: `background: #DCFCE7, border: 2px solid #16A34A, color: #16A34A` when selected
  - PDF: `background: #FEE2E2, border: 2px solid #EF4444, color: #EF4444` when selected
  - Unselected: `background: #FFFFFF, border: 1px solid #E0E0E0, color: #050804`
  - `height: 52px, border-radius: 8px, font: 14px weight 600`
  - Icon: Excel spreadsheet / PDF document icon above text

**Export button:**
- "ייצא קובץ" `background: #142A3F, height: 48px, border-radius: 8px, full-width`
- Disabled (no selection): `background: #9CA3AF`

**Download in progress state:**
- Button shows spinner + "מייצא..." text
- Progress bar below button (optional): `height: 4px, fill: #142A3F, track: #E0E0E0`

**Success state:**
- Green success banner: "הקובץ הורד בהצלחה ✓" `background: #DCFCE7, color: #16A34A`
- Or auto-triggers browser file download directly

## Files to Create/Modify

- `server/src/modules/exports/*`
- `client/src/features/admin/export/*`

## Acceptance Criteria

- [ ] Excel and PDF exports work
- [ ] Correct data per filters
- [ ] Watermark on unapproved
- [ ] Payroll locks month (via shared monthLocksService from F15)
- [ ] Correction history rows appear for admin-edited entries
- [ ] Exported file has standardized filename: YYYY-MM_[user]_[type].[ext]

