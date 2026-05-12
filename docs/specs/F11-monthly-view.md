# Feature Specification: F11 — Monthly View

**Feature Branch**: `feature/f11-monthly-view`  
**Created**: 2026-05-11  
**Status**: Draft  
**Epic**: Epic 3 — Time Reporting Core  
**Jira Story (BE)**: KAN-416 | **Jira Story (FE)**: (F11 FE tasks)

---

## Overview

The Monthly View gives employees a complete picture of their time-reporting status for any given month:
progress toward quota, hours missing relative to today, absence hours, days without any report, and a
breakdown of hours per project. It also powers the per-day status labels used in the calendar grid.

---

## User Stories & Acceptance Scenarios

### Story 1 — View monthly progress (Priority: P1)

An employee opens the monthly summary for the current month and immediately sees how many hours they
have reported, what the monthly target is, and the percentage completed.

**Why P1**: This is the primary value of the screen — employees need it to know if they are on track.

**Independent Test**: Call `GET /monthly-summary?userId=X&year=Y&month=M` and assert the three fields
`reportedHours`, `quotaHours`, `completionPercentage` are correct.

**Acceptance Scenarios**:

1. **Given** a user with 100% employment, 22 working days, no holidays, no absences, 99h reported,
   **When** `GET /monthly-summary` is called,
   **Then** `quotaHours = 198`, `reportedHours = 99`, `completionPercentage = 50`.

2. **Given** a user with 50% employment, 22 working days, no holidays, no absences,
   **When** `GET /monthly-summary` is called,
   **Then** `quotaHours = 99` (22 × 9h × 0.50), `completionPercentage` reflects reported / 99.

3. **Given** a month with 1 national holiday and 1 full-day absence,
   **When** `GET /monthly-summary` is called,
   **Then** `quotaHours = (workingDays − 2) × 9h × employment%`.

---

### Story 2 — See how far behind today's expected pace (Priority: P1)

An employee in the middle of the month sees a warning: "You are missing X hours according to today's
standard." This tells them how many hours they should have reported by today but have not.

**Why P1**: This is the actionable alert shown prominently in the side panel and mobile view.

**Independent Test**: Seed a month where the user should have reported 90h by today but only logged 54h.
Assert `missingHoursToDate = 36`.

**Acceptance Scenarios**:

1. **Given** today is the 15th of January (10 working days elapsed), standard is 9h/day, 0 absences,
   and the user has reported 54h,
   **When** `GET /monthly-summary` is called for January,
   **Then** `missingHoursToDate = max(0, 10 × 9 − 54) = 36`.

2. **Given** a fully caught-up user (reported ≥ expected by today),
   **When** `GET /monthly-summary` is called,
   **Then** `missingHoursToDate = 0` (never negative).

3. **Given** a past month (all working days elapsed),
   **When** `GET /monthly-summary` is called,
   **Then** `missingHoursToDate = max(0, quotaHours − reportedHours)` (full gap).

4. **Given** a future month (no working days elapsed yet),
   **When** `GET /monthly-summary` is called,
   **Then** `missingHoursToDate = 0`.

---

### Story 3 — Days without any report (Priority: P2)

The side panel shows a count of working days in the month where the employee logged neither time entries
nor absences. This helps employees spot forgotten days.

**Why P2**: Important for completeness but secondary to the quota progress.

**Independent Test**: Seed 3 working days with entries, 1 with a full-day absence, 2 with nothing.
Assert `daysWithoutReport = 2`.

**Acceptance Scenarios**:

1. **Given** a working day with at least one approved time entry,
   **Then** it does NOT count toward `daysWithoutReport`.

2. **Given** a working day with a full-day absence filed,
   **Then** it does NOT count toward `daysWithoutReport`.

3. **Given** a working day with a partial absence filed but zero work hours logged,
   **Then** it DOES count toward `daysWithoutReport` (partial absence alone is not sufficient).

4. **Given** a Saturday or Friday (non-working day),
   **Then** it is never included in `daysWithoutReport`.

5. **Given** a holiday (national or company),
   **Then** it is never included in `daysWithoutReport`.

---

### Story 4 — Absence hours this month (Priority: P2)

The side panel shows total hours lost to user-reported absences (vacation, sick, reserve duty, other).
Holidays are NOT included here — they are accounted for in `quotaHours` but not surfaced as absence hours.

**Acceptance Scenarios**:

1. **Given** 1 full-day absence (vacation) → `absenceHours += 9`.
2. **Given** 1 partial absence → `absenceHours += 4.5`.
3. **Given** 1 national holiday → `absenceHours` unchanged (holiday reduces quota but is not an absence).

---

### Story 5 — Hours breakdown by project (Priority: P2)

The side panel shows how many hours the employee has reported against each project this month, sorted
by hours descending.

**Acceptance Scenarios**:

1. **Given** entries for projects A (55h), B (35h), C (8h),
   **When** `GET /monthly-summary` is called,
   **Then** `projectBreakdown = [{projectId, projectName, hours: 55}, {…35}, {…8}]`.

2. **Given** a project with 0 hours this month,
   **Then** it is NOT included in `projectBreakdown`.

---

### Story 6 — Per-day status for the calendar grid (Priority: P1)

Each calendar cell needs a status label: **מלא** (full), **חסר** (missing), **חריג** (irregular), or
**day_off**. The backend computes this for every day in the requested month.

**Acceptance Scenarios**:

1. Working day, reported = standard hours → `status: "full"` (מלא).
2. Working day, 0 < reported < standard → `status: "missing"` (חסר).
3. Working day, reported = 0, no absence → `status: "missing"` (חסר).
4. Working day, reported > standard → `status: "irregular"` (חריג).
5. Friday or Saturday → `status: "day_off"`.
6. Holiday (national / company) → `status: "day_off"`.
7. Full-day absence → `status: "day_off"`.
8. Partial absence day with enough work hours to hit standard → `status: "full"`.

---

## Edge Cases

- User with `employment_percentage = 0` → `quotaHours = 0`, `missingHoursToDate = 0`, all days are effectively `day_off`.
- Month requested is entirely in the future → `reportedHours = 0`, `missingHoursToDate = 0`, all working days show `status: "missing"` (not yet reported).
- Cross-midnight entries (e.g., 22:00–02:00) belong to the start date; their duration is included in that day's totals.
- Admin requesting another user's summary → allowed (no 403).
- Regular user requesting another user's summary → 403 Forbidden.
- Invalid `year` or `month` params → 400 Bad Request.

---

## API Contract

### `GET /monthly-summary`

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `userId` | integer | No (defaults to caller) | Target user. Admin only for other users. |
| `year` | integer | Yes | 4-digit year |
| `month` | integer | Yes | 1–12 |

**Auth**: Bearer JWT (`authenticate` middleware)  
**Permission**: User sees own data only; Admin can query any `userId`.

#### Response `200 OK`

```json
{
  "year": 2026,
  "month": 1,
  "quotaHours": 181,
  "reportedHours": 141,
  "completionPercentage": 78,
  "missingHoursToDate": 36,
  "absenceHours": 9,
  "daysWithoutReport": 4,
  "projectBreakdown": [
    { "projectId": 1, "projectName": "El Al Cargo", "hours": 55 },
    { "projectId": 2, "projectName": "Project B",   "hours": 35.2 }
  ],
  "dayStatuses": {
    "2026-01-01": { "status": "day_off",   "reportedHours": 0,   "standardHours": 0 },
    "2026-01-04": { "status": "full",      "reportedHours": 9,   "standardHours": 9 },
    "2026-01-05": { "status": "missing",   "reportedHours": 4.5, "standardHours": 9 },
    "2026-01-06": { "status": "irregular", "reportedHours": 10,  "standardHours": 9 }
  }
}
```

#### Error responses

| Status | Condition |
|--------|-----------|
| 400 | `year` or `month` missing / invalid |
| 403 | Regular user requesting another user's data |
| 401 | Missing or invalid JWT |

---

## Calculation Rules

### `quotaHours`

```
dailyStandard  = (user.daily_hours_override ?? 9) × (user.employment_percentage / 100)
workingDays    = days in month where day_of_week NOT IN (Fri=5, Sat=6)
                 AND date NOT IN holiday_calendar (national or company type)
quotaHours     = workingDays × dailyStandard
               − (count of full-day absences × dailyStandard)
               − (count of partial absences × dailyStandard / 2)
```

> Admin exceptions (±h) are out of scope for this spec — see Epic 5.

### `missingHoursToDate`

```
cutoffDate         = min(today, last day of requested month)
elapsedWorkingDays = working days from month start up to cutoffDate (inclusive)
                     − holidays up to cutoffDate
                     − full-day absences up to cutoffDate
                     − partial absences up to cutoffDate (each = 0.5 day)
expectedByToday    = elapsedWorkingDays × dailyStandard
missingHoursToDate = max(0, expectedByToday − reportedHours)
```

### `daysWithoutReport`

A working day (non-weekend, non-holiday) counts as "without report" if:
- No time entries exist for that day (non-deleted), **AND**
- No **full-day** absence covers that day.

A partial absence with 0 work hours still counts as "without report."

### `dayStatuses` per-day logic

```
For each day D in the month:
  if D is Fri/Sat OR D is in holiday_calendar → status = "day_off", standardHours = 0
  else if full-day absence covers D          → status = "day_off", standardHours = 0
  else:
    reportedMinutes = SUM(duration_minutes) for time entries on D
    standardMinutes = dailyStandard × 60
    absenceMinutes  = partial absence on D ? dailyStandard × 60 / 2 : 0
    effectiveStd    = standardMinutes − absenceMinutes
    if reportedMinutes == effectiveStd → "full"
    if reportedMinutes >  effectiveStd → "irregular"
    else                               → "missing"
```

---

## Requirements

### Functional Requirements

- **FR-001**: `GET /monthly-summary` MUST return all fields defined in the API contract.
- **FR-002**: `quotaHours` MUST scale by `employment_percentage`.
- **FR-003**: `missingHoursToDate` MUST be date-relative (vs. today) and never negative.
- **FR-004**: `daysWithoutReport` MUST exclude weekends, holidays, and full-day absence days.
- **FR-005**: A partial absence day with 0 work hours MUST count toward `daysWithoutReport`.
- **FR-006**: `absenceHours` MUST include only user-reported absences, NOT holidays.
- **FR-007**: `projectBreakdown` MUST exclude projects with 0 hours and be sorted descending.
- **FR-008**: `dayStatuses` MUST cover every calendar day in the requested month.
- **FR-009**: A regular user requesting another user's summary MUST receive 403.
- **FR-011**: An admin MUST be able to request any user's summary.
- **FR-012**: `GET /time-entries` MUST accept separate `year` (integer) and `month` (integer) query params in addition to the existing `?month=YYYY-MM` format.

### Key Entities

- **MonthlySummary** (computed, not persisted): quotaHours, reportedHours, completionPercentage, missingHoursToDate, absenceHours, daysWithoutReport, projectBreakdown[], dayStatuses{}
- **DayStatus** (computed per day): status (`full` | `missing` | `irregular` | `day_off`), reportedHours, standardHours

---

## Success Criteria

- **SC-001**: All 10 Jira subtasks (KAN-417 – KAN-426) pass.
- **SC-002**: `quotaHours` matches manual calculation for a seeded month with holidays and absences.
- **SC-003**: `missingHoursToDate` correctly reflects mid-month gap in integration tests.
- **SC-004**: Permission boundary enforced: regular user gets 403 on other-user query.
- **SC-005**: `dayStatuses` covers all calendar days with correct status labels.

---

## Assumptions

- The server clock is used for "today" — no client-side date is accepted.
- `employment_percentage` is always 1–100 (never 0 in practice, but edge case handled).
- Admin exceptions to quota (Epic 5) are out of scope — `quotaHours` ignores them for now.
- Cross-midnight entries belong to their start date for all calculations.
- `GET /time-entries` month filter with separate `year`+`month` integers is additive — the existing `?month=YYYY-MM` format continues to work.
