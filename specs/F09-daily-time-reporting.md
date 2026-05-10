# F09: Daily Time Reporting

| | |
|---|---|
| **Phase** | 4 |
| **Sprint** | Sprint 3–4 |
| **Assigned to** | Dev A (Backend) + Dev C (Frontend) |
| **Severity** | CRITICAL |
| **Depends on** | F03, F08 |

## Summary

The core user feature. Daily report form with cascading dropdowns, existing entries list, validation, multi-task support, save/cancel flow.

## Tasks & Subtasks

### 1. Backend: Time entries module

- [x] GET /time-entries — list by user_id, date, week, month. User: own only. Admin: any user.
- [x] GET /time-entries/:id — single entry
- [x] POST /time-entries — create: date, start_time, end_time, client_id, project_id, task_id, location, description. Calculate duration_minutes automatically.
- [x] PUT /time-entries/:id — update **(only if `status IN ('draft','rejected')` AND month not locked AND week status is `draft` or `rejected`)**. **Requires `version` field in request body. If `DB.version !== body.version` → return 409 `{ error: 'CONFLICT', message: 'Entry was modified by someone else. Please reload and try again.' }`. On successful update, increment version. If entry was previously `rejected`, auto-transition `status → 'draft'` and clear `rejection_reason`.**
- [x] DELETE /time-entries/:id — **soft delete** (only if `status IN ('draft','rejected')` AND month not locked): execute `UPDATE time_entries SET deleted_at = NOW() WHERE id = :id`. All GET queries add `WHERE deleted_at IS NULL`.
- [x] Implement overlap detection across all projects for same user+date
- [x] Implement cross-midnight duration calculation
- [x] **Manual duration override**: if request body includes `duration_override_minutes` without `end_time`, derive `end_time = start_time + duration_override_minutes`. If both `end_time` and `duration_override_minutes` are provided, `end_time` wins and `duration_override_minutes` is ignored.
- [x] Validate: no future dates, required fields, task must be assigned and open, project/client must be active
- [x] Validate: task.status must be `open` — closed task returns 422 `{ error: 'Task is closed' }`
- [x] Validate: end_time > start_time (except cross-midnight)
- [x] Return daily summary: total hours, remaining hours vs standard
- [x] **Admin edit path**: Admin can PUT /time-entries/:id for any user's draft entry. On save, store `last_modified_by = admin_user_id` and `last_modified_by_role = 'admin'` on the entry. Audit logged with action=ADMIN_EDIT.
- [x] All mutations audit logged with old/new values

### 2. Backend: Dropdown data endpoints

- [x] GET /time-entries/dropdown-data — returns user's available clients→projects→tasks tree based on assignments.
  > Response shape: `{ clients: [...], sort_prefs: { client_id, project_id, task_id } }`. The `sort_prefs` field is read from `users.sort_prefs JSONB`.
  > Clients, projects, and tasks sorted by past-usage frequency (derived from `sort_prefs`). Frontend pre-selects the `sort_prefs` values as the initial form defaults.
  > **"No assignments" empty state**: if `clients` array is empty, frontend shows info banner: `'לא שוייכת עדיין למשימות. פנה למנהל המערכת לקבלת גישה.'` and disables the 'הוספת פרויקט' button.
- [x] GET /time-entries/daily-summary?date=&user_id= — returns `{ date, total_hours, standard_hours, remaining_hours, entry_count, status: 'full'|'partial'|'missing'|'day_off' }`. `standard_hours` respects `users.daily_hours_override` and holiday calendar. `status='day_off'` when date is a holiday or weekend.
- [x] After POST or PUT /time-entries: compute `monthlyTotal / monthlyQuota`. If ≥90% and no existing `QUOTA_WARNING` notification for this `user_id + month + year` → call `notificationsService.create({ type: 'QUOTA_WARNING', userId, month, year })`.

### 3. Frontend: Daily report page (default/home screen)

- [ ] Create DailyReportPage.jsx — this is the default screen after login
- [ ] Show: date picker (default: today), daily standard (9h), progress indicator showing hours reported vs standard
- [ ] Show existing entries for selected date (ExistingEntriesList.jsx) with edit/delete actions
- [ ] ReportForm.jsx: location dropdown, start time, end time, auto-calculated duration, client→project→task cascading dropdowns, description textarea
- [ ] Auto-select if only one option in dropdown
- [ ] Sort toggle (alphabetical / frequency) persisted per user
- [ ] Save button: call POST, show success toast, reset form for next entry
- [ ] Cancel button: discard form, reset to blank
- [ ] Validation: all fields required, end > start, show field-level errors
- [ ] Warning banners: under/over standard hours for the day
- [ ] **Unsaved changes guard**: intercept browser navigation / route change when form is dirty. Show dialog: 'יש לך שינויים שלא נשמרו. לצאת בכל זאת?' (You have unsaved changes. Leave anyway?)
- [ ] **"Modified by Admin" badge**: if `entry.last_modified_by_role === 'admin'`, show badge on entry card with tooltip showing admin name and timestamp from audit log

### 3b. Required UI states (v3.2 §14.1)

- [ ] **Loading**: skeleton entry list while fetching
- [ ] **Empty**: 'No entries for this day — start reporting' message
- [ ] **No-permission**: 403 state if user somehow hits admin-only endpoints
- [ ] **Validation error**: inline field errors (required, end>start, overlap)
- [ ] **Server error**: toast on 500
- [ ] **Offline indicator**: disable Save with 'No internet connection'
- [ ] **Save success**: toast 'Entry saved' + form reset
- [ ] **Conflict (409)**: dialog 'Entry was modified by someone else. Reload to see latest version.'
- [ ] **Locked month**: all form fields disabled, banner 'החודש נעול — קריאה בלבד'
- [ ] **Unsaved changes**: dialog before navigate-away
- [ ] **Quota warning**: yellow banner when reported hours ≥90% of monthly quota
- [ ] **Disabled control**: edit/delete disabled for submitted entries (tooltip: 'שבוע זה כבר הוגש')

### 4. Frontend: Cascading dropdowns

- [ ] Client dropdown: populated from assignments. On select → filter projects
- [ ] Project dropdown: filtered by client. On select → filter tasks
- [ ] Task dropdown: filtered by project
- [ ] If only 1 option at any level → auto-select and move to next
- [ ] Clear downstream selections when parent changes

### 5. Tests

- [x] Test: Overlapping entries blocked (same user, any project)
- [x] Test: Adjacent entries allowed (12:00-15:00 then 15:00-18:00)
- [x] Test: Cross-midnight duration calculated correctly
- [x] Test: Future date blocked
- [x] Test: Unassigned task blocked
- [x] Test: Closed task blocked with 422
- [x] Test: Locked month blocks create/edit/delete
- [x] Test: Submitted week blocks edit/delete (status not draft/rejected)
- [x] Test: Optimistic lock — concurrent PUT with stale version returns 409
- [x] Test: Daily hours summary correct
- [x] Test: Sort by frequency returns most-used first
- [x] Test: Admin edit sets last_modified_by_role='admin' and audit logs ADMIN_EDIT

## API Endpoints


| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | /time-entries | User/Admin | List with filters (date, week, month, user_id) |
| GET | /time-entries/:id | User/Admin | Single entry |
| POST | /time-entries | User | Create entry (own only) |
| PUT | /time-entries/:id | User/Admin | Update (with version check) |
| DELETE | /time-entries/:id | User/Admin | Soft delete |
| GET | /time-entries/dropdown-data | User | Cascading dropdown tree + sort_prefs pre-selection defaults |
| GET | /time-entries/daily-summary?date=&user_id= | User/Admin | Returns `{ date, total_hours, standard_hours, remaining_hours, entry_count, status: 'full'\|'partial'\|'missing'\|'day_off' }` |

## Database Tables

time_entries, user_task_assignments (read), clients/projects/tasks (read)

## Screens / UI

DailyReportPage (home), ReportForm, ExistingEntriesList

## UI/UX — Pixel-Perfect Design Reference

> Source: Figma exports `webapp_Desktop_resolution_0.png` through `webapp_Desktop_resolution-9_0.png`. Tokens updated per Figma MCP extraction. Full token reference: `specs/figma-design-spec.md`

### Main Monthly Report View (DailyReportPage — desktop)

**Page background:** `#F2F3F7`

**Header bar** (fixed, `height: 60px`, `background: #FFFFFF`, `border-bottom: 1px solid #E5E7EB`):
- Right: `▲ abra` logo + "דיווח שעות" label (`16–18px, weight: 700, color: #050804`)
- Center: month navigator pill — `border: 1px solid #E5E7EB`, `border-radius: 9999px`, `width: ~180px`, `height: 36px`  
  Contents: `‹` arrow button + month name (`16px, weight: 600`) + `›` arrow button  
  Arrow buttons: `32×32px` gray outlined circles
- Left: two pill CTA buttons  
  "דיווח ידני": `background: #F97316`, pill, `height: 36px`, `border-radius: 9999px`, `width: ~130px`, clock icon  
  "הפעלת שעון": `background: #EC4899` (solid or gradient to `#E879F9`), pill, `height: 36px`, `border-radius: 9999px`, `width: ~140px`, ▶ play icon

**KPI cards row** (below header, flex 5-column grid, `margin-top: 60px`, `gap: 16px`):
Each card: `background: #FFFFFF`, `border-radius: 12px`, `padding: 20px`, box-shadow
- Icon: colored SVG `~20px` top-right (RTL: top-right)
- KPI value: `32–36px, weight: 800, color: #111827`
- Label above value: `13px, color: #6B7280`
- Sub-label below value: `11px, color: #666666`

| KPI | Icon | Notes |
|---|---|---|
| שעות חודשיות | blue clock | shows "מתוך 180" sub-label |
| ימי חופשה | sun icon | "נוצלו החודש" sub |
| ימי מחלה | building icon | |
| דיווחים חסרים | red circle-X | alert styling |
| פרויקטים מדווחים | teal briefcase | "פרויקטים מדווחים החודש" sub |

**Section block** (`margin-top: 24px`):
- Title "פירוט יומי": `18–20px, weight: 700, color: #111827`
- Subtitle "רשימת הדיווחים לחודש {month} {year}": `13px, color: #6B7280`
- Filter button "כל הדיווחים": small pill, `border: 1px solid #E0E0E0`, `height: 32px`, dropdown caret

**Daily row cards:**
- `background: #FFFFFF`, `border-radius: 12px`, `height: 60–64px`, `margin-bottom: 8px`
- Layout (RTL, right → left):
  1. Calendar/briefcase icon: `color: #666666`, `~20px`
  2. Date + day name: `14px, weight: 600, color: #050804`
  3. Status badge (colored pill)
  4. Location badge (gray pill): `background: #F3F4F6, color: #050804, font: 13px`
  5. Project count chip: `background: #F3F4F6, color: #6B7280, font: 13px`
  6. `‹` chevron (leftmost): `color: #666666`

**Status badge colors:**
- חסר: `background: #FEE2E2, color: #EF4444`
- 9 שעות (complete): `background: #DCFCE7, color: #16A34A`
- 7 שעות (partial): `background: #FEF3C7, color: #D97706`
- סוף"ש (weekend): `background: #DBEAFE, color: #2563EB`

### Daily Report Edit (ReportForm — Drawer or Modal)

**Side drawer variant** (`width: ~460px`, slides in from right in RTL):
- `background: #FFFFFF`, heavy left box-shadow
- Does NOT dim background page

**Full modal variant** (`width: ~830px`, centered):
- Page overlay: `rgba(0,0,0,0.45)`, `border-radius: 16px`

**Drawer/modal header** (RTL):
```
[× close button, 32px circle] [🗑 מחיקת דיווח red text] [status badge] [date text] [📅 calendar icon]
```
- Close ×: `border: 1px solid #E0E0E0`, `background: #FFFFFF`, icon `#050804`
- Delete: `color: #EF4444`, trash icon + text, `font: 14px`

**Tab bar:**
- Modal: underline style — active tab `color: #6B2FAA`, `border-bottom: 2px solid #6B2FAA`, `font: 14px weight 600`
- Drawer: segmented pill style — active tab `background: #FFFFFF + shadow`, `color: #111827`; container `background: #F3F4F6`, `border-radius: 8px`, `height: 40–44px`

**Work Hours section:**
- "שעות עבודה" label + collapse chevron
- "תקן יומי X שע'" badge: `background: #DCFCE7, color: #16A34A, font: 12px`
- 3-column grid: שעת כניסה | שעת יציאה | סה"כ שעות
  Each input: `background: #F9FAFB`, `border: 1px solid #E0E0E0`, `height: 40px`, `border-radius: 8px`
  Label above: `12px, color: #6B7280`

**Projects section:**
- Section header: "פרוייקטים" `14px weight 600` + pencil edit icon `#666666`

- **Empty state card** (`background: #F9FAFB`, `border-radius: 12px`, `~160px` tall):
  - Centered illustration (plant/succulent SVG)
  - "עדיין אין פרוייקטים מדווחים" `16px weight 600 #050804`
  - Body text `13px #666666`

- **Add project button** (dashed):
  `border: 2px dashed #93C5FD`, `border-radius: 12px`, `background: #EFF6FF`, `color: #3B82F6`, `height: 44px`, full-width
  `+` circle icon + "הוספת פרויקט" text `14px weight 600`

- **Project entry card** (`background: #FFFFFF`, `border: 1px solid #E0E0E0`, `border-radius: 12px`):
  - Card header: "פרוייקט מס' {N}" `14px #050804` + collapse ↑ chevron + 🗑 "מחיקת פרוייקט N" `#EF4444`
  - 4-column input row: [פרוייקט dropdown] [משימה dropdown] [מיקום dropdown] [שעות text input]
    Each: `height: 48px`, `border: 1px solid #E0E0E0`, `border-radius: 8px`, `background: #FFFFFF`
    Dropdown chevron on LEFT side (RTL end)
  - Notes textarea: full-width, `min-height: 80px`, `border: 1px solid #E0E0E0`, `border-radius: 8px`

**"Modified by Admin" badge:**
- Appears on entry card when `entry.last_modified_by_role === 'admin'`
- Style: small pill badge, amber background `#FEF3C7`, text `#D97706`, "עודכן ע"י מנהל"
- Include tooltip with admin name + timestamp on hover

**Summary footer** (sticky bottom of modal/drawer):
- `background: #FFFFFF`, `border-top: 1px solid #F3F4F6`
- Right: "✨ סיכום:" `13px weight 700` + total hours `14px weight 600 #050804` + project count pink pill (`background: #FDF2F8, color: #EC4899`)
- Left: progress bar + "X מתוך Y שעות" `12px` + "חסרות Z שעות לדיווח" `12px #666666`
- Progress bar: `height: 6px`, track `#E5E7EB`, fill `#F59E0B`, orange dot cursor at fill endpoint
- Save button: full-width, `height: 48px`, `border-radius: 12px`
  - Active: `background: #142A3F`, white text "שמירה" `16px weight 600`
  - Disabled: `background: #9CA3AF`, same text

**Drawer Step 1** (hours entry only, before projects):
- Shows "המשך לדיווות פרוייקטים" navy button instead of project form: `background: #142A3F`, full-width, `height: 48px`
- Save button at bottom is gray/disabled until projects are also filled

## Files to Create/Modify

- `server/src/modules/time-entries/*`
- `server/src/utils/overlapDetector.js`
- `server/src/utils/durationCalculator.js`
- `client/src/features/time-reports/DailyReportPage.jsx`
- `client/src/features/time-reports/ReportForm.jsx`
- `client/src/features/time-reports/ExistingEntriesList.jsx`

## Acceptance Criteria

- [ ] User can create time entries with all required fields
- [ ] Cascading dropdowns filter correctly based on assignments
- [ ] Auto-select works when only one option
- [ ] Overlap is blocked with clear error message
- [ ] Cross-midnight entries work correctly
- [ ] Daily progress shows hours vs standard
- [ ] Existing entries for the day are visible and editable
- [ ] Save resets form, cancel discards
- [ ] Concurrent edit (stale version) returns 409 Conflict
- [ ] Edit blocked after week is submitted (unless week is rejected)
- [ ] Unsaved changes dialog fires on navigate-away with dirty form
- [ ] Admin-modified entries show 'Modified by Admin' badge

