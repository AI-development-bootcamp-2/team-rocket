# Epic 3 — Time Reporting Core Tasks

**Jira Epic**: `[EPIC] Time Reporting Core — Daily Entries, Monthly View & Absences`  
**Priority**: Critical | **Days**: 3–4  
**Spec**: [epic-3-time-reporting-core.md](../specs/epic-3-time-reporting-core.md)

> ⚠️ F09 is the heaviest feature. Protect Day 3 for it — overlap detection, cross-midnight, and quota calc all live here.

---

## Story F09-BE — Daily Time Entries Backend
**Assignee**: Dev A  
**Story Points**: 13

### Tasks
- [ ] **T** Implement `GET /time-entries` — list entries (filter: date, user_id, status)
- [ ] **T** Implement `GET /time-entries/:id` — get single entry
- [ ] **T** Implement `POST /time-entries` — create entry with full validation
- [ ] **T** Implement `PUT /time-entries/:id` — edit entry (optimistic lock via `version`)
- [ ] **T** Implement `DELETE /time-entries/:id` — delete entry (if not locked/submitted)
- [ ] **T** Build `durationCalculator.js` — calculate minutes between start/end, handle midnight crossing
- [ ] **T** Build `overlapDetector.js` — check all existing entries for overlap including cross-midnight spans
- [ ] **T** Build `quotaCalculator.js` — monthly quota = working days × 9h − holidays − absences ± exceptions
- [ ] **T** Enforce: cannot report for inactive/archived task, project, or client
- [ ] **T** Enforce: future work reports blocked
- [ ] **T** Enforce: past reports blocked if month is locked
- [ ] **T** Enforce: description field cannot be empty
- [ ] **T** Return per-day quota progress in `GET /time-entries` response

#### Subtasks
- [ ] **ST** Unit test: `durationCalculator` — normal entry, cross-midnight, exact minutes (no rounding)
- [ ] **ST** Unit test: `overlapDetector` — adjacent (allowed), overlapping (blocked), cross-midnight overlap
- [ ] **ST** Unit test: `quotaCalculator` — 22 working days, 1 holiday, 1 half-day absence
- [ ] **ST** Integration test: `POST /time-entries` — success
- [ ] **ST** Integration test: `POST /time-entries` — blocked by overlap
- [ ] **ST** Integration test: `POST /time-entries` — blocked by future date
- [ ] **ST** Integration test: `POST /time-entries` — blocked by inactive entity
- [ ] **ST** Integration test: `PUT /time-entries/:id` — blocked when month is locked
- [ ] **ST** Integration test: `PUT /time-entries/:id` — 409 Conflict on version mismatch (optimistic lock)
- [ ] **ST** Permission test: user cannot view/edit another user's entries

---

## Story F09-FE — Daily Report Page Frontend
**Assignee**: Dev C  
**Story Points**: 8

### Tasks
- [ ] **T** Build daily report form: date picker, location dropdown, start/end time, client/project/task cascading dropdowns, description field
- [ ] **T** Implement cascading dropdown logic: client → project → task, filtered by user assignments
- [ ] **T** Implement auto-select when only one option exists at a dropdown level
- [ ] **T** Implement frequency-sort preference (persisted per user)
- [ ] **T** Build `ExistingEntriesList` — shows all entries for the selected date in real time
- [ ] **T** Implement time picker with cross-midnight support
- [ ] **T** Show remaining hours indicator for the day (daily standard − logged hours)
- [ ] **T** After save: reset form to blank, update existing-entries list
- [ ] **T** Unsaved changes dialog when navigating away mid-entry

#### Subtasks
- [ ] **ST** UI test: form resets to blank after successful save
- [ ] **ST** UI test: existing-entries list updates in real time
- [ ] **ST** UI test: validation errors shown inline per field
- [ ] **ST** UI test: locked month shows read-only mode with banner

---

## Story F11 — Monthly View Frontend
**Assignee**: Dev D  
**Story Points**: 5

### Tasks
- [ ] **T** Build monthly calendar grid — one cell per day
- [ ] **T** Implement day status indicators: מלא (full) / חסר (missing) / חריג (irregular)
- [ ] **T** Build detail list below calendar — all entries for selected day
- [ ] **T** Implement quota progress bar: X / Y hours (green → yellow → red)
- [ ] **T** Implement locked-month banner + read-only mode
- [ ] **T** Click entry in list → open edit form (if not locked)
- [ ] **T** Implement `GET /monthly-summary` call to fetch quota stats

#### Subtasks
- [ ] **ST** UI test: day status shows correct label for full/missing/irregular days
- [ ] **ST** UI test: locked month — all entries read-only, banner visible
- [ ] **ST** UI test: progress bar color changes at thresholds

---

## Story F12-BE — Absence Reporting Backend
**Assignee**: Dev B  
**Story Points**: 8

### Tasks
- [ ] **T** Implement `GET /absences` — list absences (filter: user_id, date range)
- [ ] **T** Implement `GET /absences/:id`
- [ ] **T** Implement `POST /absences` — create absence with type, date range, is_partial
- [ ] **T** Implement `PUT /absences/:id` — edit absence (before submission)
- [ ] **T** Implement `DELETE /absences/:id` — cancel absence (before submission)
- [ ] **T** Implement `POST /absences/:id/documents` — file upload with server-side MIME validation
- [ ] **T** Implement absence quota reduction: full day = −9h, partial = −4.5h
- [ ] **T** Exclude Fri/Sat from absence day count automatically
- [ ] **T** Allow document upload even after month lock (audit logged)
- [ ] **T** Enforce: sick (`מחלה`) and reserve duty (`מילואים`) require document

#### Subtasks
- [ ] **ST** Integration test: create absence → monthly quota correctly reduced
- [ ] **ST** Integration test: partial absence → user must also report work hours for remaining half
- [ ] **ST** Integration test: `POST /absences/:id/documents` — PDF accepted, .exe rejected (MIME check)
- [ ] **ST** Integration test: `POST /absences/:id/documents` — file > 10 MB rejected
- [ ] **ST** Integration test: document upload after month lock → allowed, audit logged
- [ ] **ST** Integration test: Fri/Sat excluded from absence day count

---

## Story F12-FE — Absence Reporting Frontend
**Assignee**: Dev D  
**Story Points**: 5

### Tasks
- [ ] **T** Build absence form: type dropdown, date range picker, partial-day toggle
- [ ] **T** Show document upload section (required badge for מחלה / מילואים)
- [ ] **T** Show absence impact preview: "This removes X hours from your monthly quota"
- [ ] **T** Build `AbsenceList` — list of existing absences for the month
- [ ] **T** Build `DocumentUpload` component with drag-and-drop and file type feedback

#### Subtasks
- [ ] **ST** UI test: required document badge visible for sick/reserve types
- [ ] **ST** UI test: quota impact preview updates dynamically as date range changes

---

**✅ Milestone**: Employee can log a workday, see monthly view, and report an absence.
