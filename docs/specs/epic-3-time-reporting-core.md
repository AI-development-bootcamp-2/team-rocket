# Epic 3 — Time Reporting Core

> **Days**: Days 3–4 | **Priority**: CRITICAL  
> **Goal**: Employees can log, view, and report time  
> **Features**: F09 (Daily Time Entries), F11 (Monthly View), F12 (Absence Reporting)

---

## Features

| ID | Feature | Lead | Day |
|----|---------|------|-----|
| F09 | Daily Time Entries — BE | Dev A | Day 3–4 |
| F09 | Daily Report Page — FE | Dev C | Day 3–4 |
| F11 | Monthly View — FE | Dev D | Day 3 |
| F12 | Absence Reporting — BE + FE | Dev B (BE), Dev D (FE) | Day 3–4 |

**Milestone**: Employee can log a workday, see monthly view, report an absence.

> ⚠️ F09 is the heaviest single feature. Protect Day 3 for it — overlap detection + cross-midnight + quota calculation all live here.

---

## F09 — Daily Time Entries

### Business Rules

#### Input Methods
- **Start time + end time** (primary): duration auto-calculated
- **Manual duration** (fallback): if user only knows total time
- If both are entered, **start/end is the source of truth**
- If manual duration conflicts with calculated duration → validation error
- **No rounding**: exact minutes are recorded

#### Standard Day
- Default: **9 hours** per working day
- Non-working days: **Friday and Saturday**
- Admin can configure holidays and special schedules (see Epic 5)

#### Monthly Quota
```
Monthly quota = (working days × 9h) − holidays − full-day absences − partial absences ± admin exceptions
```
- User may report more than 9h on a specific day, as long as monthly quota is not exceeded
- If monthly quota would be exceeded → **block submission**, require Admin exception
- Monthly view must show: **X / Y hours reported** progress indicator

#### Daily Allocation Rule
Every working day must be **fully allocated** (= daily standard hours) across all entries + absences **before** the user can submit the week.

#### Overlap Rule
Overlapping time entries are **blocked** across ALL projects for the same user:
- Allowed: 09:00–12:00 then 12:00–15:00 (adjacent)
- Blocked: 09:00–12:00 and 10:00–13:00 (overlap at 10:00–12:00)
- Overlap check must also account for **cross-midnight spans**

#### Cross-Midnight Work (MAJOR)
- Entries crossing midnight are supported (e.g., 22:00–02:00)
- Entry belongs to the **start date**
- Duration calculation correctly handles midnight crossing
- Overlap detection must handle cross-midnight spans correctly

### Required Fields

| Field | Type | Required | Default | Notes |
|-------|------|----------|---------|-------|
| Date | Date picker | Yes | Today | Cannot report future dates for work |
| Location | Dropdown | Yes | — | משרד / לקוח / בית |
| Start time | Time input | Yes | Current time | — |
| End time | Time input | Yes | Current time | Must be after start (except cross-midnight) |
| Client | Dropdown | Yes | Auto if 1 | Filtered by user assignments |
| Project | Dropdown | Yes | Auto if 1 | Filtered by selected client |
| Task | Dropdown | Yes | Auto if 1 | Filtered by selected project |
| Description | Free text | Yes | — | Max length TBD; cannot be empty |

### Conditional Required Fields

| Condition | Required |
|-----------|---------|
| Monthly quota exceeded | Comment / reason for exception |
| Rejected entry correction | Correction comment |

### Validation Rules (CRITICAL)

- End time cannot be before start time (except cross-midnight)
- Overlapping intervals blocked across all projects for same user
- Cannot report for inactive/archived task, project, or client
- Future work reports are blocked
- Past reports editable only until month is locked
- Locked month cannot be edited unless Admin reopens it
- If daily hours < daily standard: warning (not blocking — must resolve before weekly submit)
- If daily hours > daily standard: informational warning
- If monthly quota would be exceeded: block submission
- Description field must not be empty
- All dropdown fields must have a valid selection

### Daily Screen: Existing Reports Display (MAJOR)

The daily report screen must show **a list of all existing entries for the selected date**:
- Each entry shows: client, project, task, start/end time, duration, location, description, status
- User can tap/click to **edit** (if week/month is not locked/submitted)
- List updates in **real time** as new entries are saved

### Save and Edit Flow

After filling all fields and saving:
1. Show success indicator
2. Reset screen to **blank form** (ready for next entry)
3. Update the existing-entries list below the form

Cancelling before save discards the entry (unsaved changes dialog if navigating away).

Reports can be edited until the month is locked. After lock: read-only.

### Multi-Task Reporting

- User can log multiple entries per day (different clients/projects/tasks)
- Screen shows remaining hours to report for the day
- Cannot close daily reporting until all hours are allocated

### API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/time-entries` | User (own) / Admin (any) | List entries (filter: date, user_id, status) |
| GET | `/time-entries/:id` | User (own) / Admin (any) | Get single entry |
| POST | `/time-entries` | User | Create entry |
| PUT | `/time-entries/:id` | User (own, before lock) / Admin | Edit entry |
| DELETE | `/time-entries/:id` | User (own, before lock) / Admin | Delete entry |

#### Create/Edit Request

```json
// POST /time-entries
{
  "date": "2026-05-06",
  "startTime": "09:00",
  "endTime": "12:30",
  "location": "משרד",
  "clientId": "uuid",
  "projectId": "uuid",
  "taskId": "uuid",
  "description": "Implemented login page"
}
```

#### Version Field (Optimistic Locking)
Every entry includes a `version` field. On update, the request must send the current `version`. If it doesn't match the DB version, return `409 Conflict`.

### Key Backend Modules

- `overlapDetector.js` — given a user + date + new time range, check all existing entries for overlap (including cross-midnight)
- `durationCalculator.js` — calculate minutes between start/end, handling midnight crossing
- `quotaCalculator.js` — calculate monthly quota for a user based on working days, holidays, absences

---

## F11 — Monthly View

### What to display

**Monthly calendar grid**:
- One cell per day of the month
- Day status indicator with 3 labels:
  - **מלא** (full) — day is fully allocated
  - **חסר** (missing) — working day with missing hours
  - **חריג** (irregular/exception) — over-quota or exception

**Detail list below calendar**:
- All entries for the selected day or month
- Each row shows: date, work duration (from–to), client, project, task, description
- Click entry → open for editing (if month not locked)

**Progress indicator**:
- X / Y hours reported for the month
- Color changes as quota is approached

### Read-only mode
When month is locked: calendar shows a banner "Month X is locked". All entries are read-only.

### API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/time-entries?userId=&year=&month=` | User (own) / Admin (any) | All entries for a month |
| GET | `/monthly-summary?userId=&year=&month=` | User (own) / Admin (any) | Quota stats for month |

---

## F12 — Absence Reporting

### Absence Types

| Type | Document Required | Admin Approval |
|------|-----------------|----------------|
| חופשה (Vacation) | No | Yes |
| מחלה (Sick) | Yes — medical certificate | Yes |
| מילואים (Reserve duty) | Yes — duty order | Yes |
| אחר (Other) | No | Yes |

### Business Rules

- **Date range support**: single day or from–to range
- **Friday and Saturday automatically excluded** from absence day count
- **Full-day absence**: reduces monthly quota by 9 hours per day
- **Half-day (partial) absence**: reduces quota by 4.5 hours; user must also report work hours for the remaining half
- User **cannot have 0 work hours** on a working day without using an absence type
- **Future absences are allowed** (pre-planned vacation)
- Absences **cannot be edited or cancelled** after weekly submission, EXCEPT:
  - Document attachment is always allowed, even after month lock
  - Document upload after month lock is audit logged

### Monthly Quota Impact

```
Quota reduction = (number of absence working days × 9h) + (partial days × 4.5h)
```

### Document Upload Rules

- Allowed types: PDF, JPG, JPEG, PNG, DOC, DOCX
- Max size: 2 MB per file
- **Server-side MIME type validation** (not just extension)
- Files stored with reference to the absence entry and the uploading user

### API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/absences` | User (own) / Admin (any) | List absences (filter: user_id, date range) |
| GET | `/absences/:id` | User (own) / Admin (any) | Get single absence |
| POST | `/absences` | User | Create absence |
| PUT | `/absences/:id` | User (own, before submit) / Admin | Edit absence |
| DELETE | `/absences/:id` | User (own, before submit) / Admin | Cancel absence |
| POST | `/absences/:id/documents` | User (own) / Admin | Upload document |
| DELETE | `/absences/:id/documents/:docId` | Admin only | Remove document |

#### Create Absence Request

```json
// POST /absences
{
  "type": "חופשה",
  "startDate": "2026-05-10",
  "endDate": "2026-05-12",
  "isPartial": false,
  "notes": "family vacation"
}
```

### Absence Form UI

- Calendar range picker (start date → end date)
- Type dropdown (4 options)
- Partial day toggle + instructions if partial selected
- Document upload section (shows required badge for מחלה / מילואים)
- Preview of absence impact: "This absence removes X hours from your monthly quota"

---

## Test Plan

| Category | What to test | Priority |
|----------|-------------|---------|
| Unit | Overlap detection — adjacent (allowed), overlap (blocked), cross-midnight | CRITICAL |
| Unit | Duration calculation — normal, cross-midnight, rounding (none) | CRITICAL |
| Unit | Monthly quota calculation — working days, holidays, absences | CRITICAL |
| Unit | Validation rules — future date blocked, inactive entity blocked | CRITICAL |
| Integration | POST /time-entries — success, overlap rejection, future date rejection | CRITICAL |
| Integration | PUT /time-entries — locked month rejects edit | CRITICAL |
| Integration | POST /absences — quota correctly reduced | CRITICAL |
| Integration | POST /absences/:id/documents — MIME validation, size limit | MAJOR |
| Integration | Document upload after month lock — allowed, audit logged | MAJOR |
| Permission | User cannot view/edit another user's entries | CRITICAL |
| Permission | Admin can edit any user's entry | CRITICAL |
| Validation | All required fields enforced | CRITICAL |
| Validation | Description cannot be empty | CRITICAL |
| UI | Calendar day status correct (full/missing/irregular) | MAJOR |
| UI | Existing entries list updates in real time | MAJOR |
| UI | Dropdown auto-selects when only one option | MAJOR |
