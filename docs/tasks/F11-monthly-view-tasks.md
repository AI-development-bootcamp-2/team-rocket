# Tasks: F11 — Monthly View Backend

**Spec**: [F11-monthly-view.md](../specs/F11-monthly-view.md)  
**Jira Story**: KAN-416  
**Branch**: `feature/f11-monthly-view`  
**Created**: 2026-05-11  
**Approach**: TDD — tests are written and confirmed FAILING before any implementation task begins

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no shared dependencies)
- **[Story]**: User story this task belongs to
- **⚠️ RED first**: Every test task must fail before the implementation task that follows it

---

## Phase 1: Foundational (Route + Skeleton)

**Purpose**: Wire up the new endpoint and param validation before any story work begins.  
**⚠️ CRITICAL**: All story phases depend on this being complete first.

- [ ] T001 Add `GET /monthly-summary` route (before `/:id`) in `server/src/routes/time-entries.routes.ts`, wired to a placeholder handler that returns `501 Not Implemented`
- [ ] T002 Create `getMonthlySummaryHandler` skeleton in `server/src/controllers/time-entries.controller.ts` — validate `year` (4-digit integer) and `month` (1–12) query params, return 400 on invalid input
- [ ] T003 Create `getMonthlySummary` service function skeleton in `server/src/services/time-entries.service.ts` — accepts `{ userId, year, month, caller }`, returns empty object for now
- [ ] T004 Add `MonthlySummaryResponse` TypeScript interface in `server/src/services/time-entries.service.ts` with all fields from the API contract (quotaHours, reportedHours, completionPercentage, missingHoursToDate, absenceHours, daysWithoutReport, projectBreakdown, dayStatuses)

**Checkpoint**: `GET /monthly-summary?year=2026&month=5` returns 501 (or 400 for bad params). Route is live.

---

## Phase 2: US1 — Monthly Progress (quotaHours, reportedHours, completionPercentage)

**Goal**: Return correct quota and reported hours for a month.  
**Independent Test**: `GET /monthly-summary` returns correct `quotaHours`, `reportedHours`, `completionPercentage` for a seeded month.

### ⚠️ Write tests FIRST — confirm they FAIL before Phase 2 implementation

- [ ] T005 [P] [US1] Write failing integration test: `GET /monthly-summary` returns correct `quotaHours` for standard month (no holidays, no absences) — in `server/tests/integration/monthly-summary.test.ts`
- [ ] T006 [P] [US1] Write failing integration test: `GET /monthly-summary` correctly deducts 1 national holiday and 1 full-day absence from `quotaHours` — in `server/tests/integration/monthly-summary.test.ts`
- [ ] T007 [P] [US1] Write failing integration test: `quotaHours` scales with `employment_percentage` (50% user = half quota) — in `server/tests/integration/monthly-summary.test.ts`
- [ ] T008 [P] [US1] Write failing integration test: `reportedHours` equals sum of all non-deleted time entries in the month — in `server/tests/integration/monthly-summary.test.ts`
- [ ] T009 [P] [US1] Write failing integration test: `completionPercentage = floor(reportedHours / quotaHours × 100)` — in `server/tests/integration/monthly-summary.test.ts`

### Implementation for US1

- [ ] T010 [US1] Implement `computeDailyStandard(user)` helper in `server/src/services/time-entries.service.ts` — `(daily_hours_override ?? 9) × (employment_percentage / 100)`
- [ ] T011 [US1] Implement `computeQuotaHours(userId, year, month, dailyStandard)` in service — count working days (Sun–Thu), deduct holidays from `holiday_calendar`, deduct full-day absences × dailyStandard and partial absences × dailyStandard/2
- [ ] T012 [US1] Implement `reportedHours` query in `getMonthlySummary` — `SUM(duration_minutes)/60` from `time_entries` for the month (non-deleted)
- [ ] T013 [US1] Wire `quotaHours`, `reportedHours`, `completionPercentage` into `getMonthlySummary` response and connect handler to return 200

**Checkpoint**: T005–T009 all pass. `GET /monthly-summary` returns correct progress fields.

---

## Phase 3: US2 — Missing Hours by Today (missingHoursToDate)

**Goal**: Return how many hours the user is behind relative to today's expected pace.  
**Independent Test**: Mid-month scenario — user should have logged 90h by today but only logged 54h → `missingHoursToDate = 36`.

### ⚠️ Write tests FIRST — confirm they FAIL before Phase 3 implementation

- [ ] T014 [US2] Write failing integration test: `missingHoursToDate` equals gap between expected-by-today and reported (mid-month scenario) — in `server/tests/integration/monthly-summary.test.ts`
- [ ] T015 [US2] Write failing integration test: `missingHoursToDate = 0` when user is fully caught up (reported ≥ expected by today) — in `server/tests/integration/monthly-summary.test.ts`
- [ ] T016 [US2] Write failing integration test: `missingHoursToDate = 0` for a future month (no elapsed days) — in `server/tests/integration/monthly-summary.test.ts`
- [ ] T017 [US2] Write failing integration test: past month — `missingHoursToDate = max(0, quotaHours − reportedHours)` — in `server/tests/integration/monthly-summary.test.ts`

### Implementation for US2

- [ ] T018 [US2] Implement `computeMissingHoursToDate(year, month, dailyStandard, absences, holidays, reportedHours)` in `server/src/services/time-entries.service.ts` — cutoffDate = min(today, last day of month), count elapsed working days, subtract elapsed absences/holidays, return max(0, expected − reported)
- [ ] T019 [US2] Add `missingHoursToDate` to `getMonthlySummary` response

**Checkpoint**: T014–T017 all pass. Mid-month gap correctly reflected.

---

## Phase 4: US3 + US4 — Days Without Report & Absence Hours

**Goal**: Count unreported working days and sum user absence hours.  
**Independent Test**: 3 days with entries, 1 full-day absence, 2 empty → `daysWithoutReport = 2`. 1 full-day + 1 partial absence → `absenceHours = 13.5`.

### ⚠️ Write tests FIRST — confirm they FAIL before Phase 4 implementation

- [ ] T020 [P] [US3] Write failing integration test: `daysWithoutReport` excludes days with time entries — in `server/tests/integration/monthly-summary.test.ts`
- [ ] T021 [P] [US3] Write failing integration test: `daysWithoutReport` excludes days covered by full-day absence — in `server/tests/integration/monthly-summary.test.ts`
- [ ] T022 [P] [US3] Write failing integration test: `daysWithoutReport` includes days with partial absence but zero work hours — in `server/tests/integration/monthly-summary.test.ts`
- [ ] T023 [P] [US3] Write failing integration test: `daysWithoutReport` excludes weekends (Fri/Sat) and holidays — in `server/tests/integration/monthly-summary.test.ts`
- [ ] T024 [P] [US4] Write failing integration test: `absenceHours` = 9 for 1 full-day absence + 4.5 for 1 partial absence — in `server/tests/integration/monthly-summary.test.ts`
- [ ] T025 [P] [US4] Write failing integration test: `absenceHours` unchanged when only a national holiday exists (holidays do NOT count) — in `server/tests/integration/monthly-summary.test.ts`

### Implementation for US3 + US4

- [ ] T026 [US3] Implement `computeDaysWithoutReport(userId, year, month)` in service — iterate working days (Sun–Thu, non-holiday), count days with no time entries AND no full-day absence
- [ ] T027 [US4] Implement `computeAbsenceHours(userId, year, month, dailyStandard)` in service — SUM from `absences` table: full-day × dailyStandard, partial × dailyStandard/2; holidays excluded
- [ ] T028 [US3] [US4] Add `daysWithoutReport` and `absenceHours` to `getMonthlySummary` response

**Checkpoint**: T020–T025 all pass.

---

## Phase 5: US5 — Project Breakdown

**Goal**: Return hours per project for the month, sorted descending, excluding 0-hour projects.  
**Independent Test**: Entries across 3 projects → `projectBreakdown` sorted desc, 0-hour project excluded.

### ⚠️ Write tests FIRST — confirm they FAIL before Phase 5 implementation

- [ ] T029 [US5] Write failing integration test: `projectBreakdown` sorted by hours descending — in `server/tests/integration/monthly-summary.test.ts`
- [ ] T030 [US5] Write failing integration test: `projectBreakdown` excludes projects with 0 hours this month — in `server/tests/integration/monthly-summary.test.ts`
- [ ] T031 [US5] Write failing integration test: `projectBreakdown` includes `projectId`, `projectName`, `hours` (rounded to 2 decimal places) — in `server/tests/integration/monthly-summary.test.ts`

### Implementation for US5

- [ ] T032 [US5] Implement `computeProjectBreakdown(userId, year, month)` in service — `GROUP BY project_id`, JOIN `projects` for name, `SUM(duration_minutes)/60`, filter > 0, ORDER BY hours DESC
- [ ] T033 [US5] Add `projectBreakdown` to `getMonthlySummary` response

**Checkpoint**: T029–T031 all pass. Project hours correctly aggregated.

---

## Phase 6: US6 — Per-Day Statuses (dayStatuses)

**Goal**: Classify every calendar day in the month as `full`, `missing`, `irregular`, or `day_off`.  
**Independent Test**: Seeded month with one full day, one missing day, one irregular day, one holiday → correct statuses for each.

### ⚠️ Write tests FIRST — confirm they FAIL before Phase 6 implementation

- [ ] T034 [P] [US6] Write failing integration test: working day with reported = standard → `status: "full"` — in `server/tests/integration/monthly-summary.test.ts`
- [ ] T035 [P] [US6] Write failing integration test: working day with 0 < reported < standard → `status: "missing"` — in `server/tests/integration/monthly-summary.test.ts`
- [ ] T036 [P] [US6] Write failing integration test: working day with reported = 0, no absence → `status: "missing"` — in `server/tests/integration/monthly-summary.test.ts`
- [ ] T037 [P] [US6] Write failing integration test: working day with reported > standard → `status: "irregular"` — in `server/tests/integration/monthly-summary.test.ts`
- [ ] T038 [P] [US6] Write failing integration test: Friday and Saturday → `status: "day_off"` — in `server/tests/integration/monthly-summary.test.ts`
- [ ] T039 [P] [US6] Write failing integration test: national holiday → `status: "day_off"` — in `server/tests/integration/monthly-summary.test.ts`
- [ ] T040 [P] [US6] Write failing integration test: full-day absence → `status: "day_off"` — in `server/tests/integration/monthly-summary.test.ts`
- [ ] T041 [P] [US6] Write failing integration test: partial absence + enough work hours = effective standard → `status: "full"` — in `server/tests/integration/monthly-summary.test.ts`

### Implementation for US6

- [ ] T042 [US6] Implement `computeDayStatuses(userId, year, month, dailyStandard, absences, holidays)` in `server/src/services/time-entries.service.ts` — iterate every day in the month, apply classification logic from spec
- [ ] T043 [US6] Add `dayStatuses` to `getMonthlySummary` response

**Checkpoint**: T034–T041 all pass. Calendar grid has correct status for every day type.

---

## Phase 7: Permissions (FR-009, FR-011)

**Goal**: Regular users see only their own data; admins can see any user.  
**Independent Test**: Regular user querying another user's summary → 403. Admin querying any user → 200.

### ⚠️ Write tests FIRST — confirm they FAIL before Phase 7 implementation

- [ ] T044 [P] Write failing permission test: regular user requesting another user's summary receives 403 — in `server/tests/integration/monthly-summary.test.ts` (KAN-425)
- [ ] T045 [P] Write failing permission test: admin can request any user's summary, receives 200 — in `server/tests/integration/monthly-summary.test.ts` (KAN-426)
- [ ] T046 Write failing permission test: unauthenticated request receives 401 — in `server/tests/integration/monthly-summary.test.ts`

### Implementation for Permissions

- [ ] T047 Add ownership check in `getMonthlySummary` service: if `caller.role !== 'admin'` and `targetUserId !== caller.id` → throw `AppError('Forbidden', 403)`
- [ ] T048 Default `targetUserId` to `caller.id` when no `userId` param is provided in `getMonthlySummaryHandler`

**Checkpoint**: T044–T046 all pass. Permission boundary enforced.

---

## Phase 8: FR-012 — GET /time-entries Year+Month Filter

**Goal**: Extend `GET /time-entries` to accept separate `?year=2026&month=5` integer params.  
**Independent Test**: `GET /time-entries?year=2026&month=5` returns only May entries. `?year=2026` alone → 400.

### ⚠️ Write tests FIRST — confirm they FAIL before Phase 8 implementation

- [ ] T049 [P] Write failing integration test: `GET /time-entries?year=2026&month=5` returns only entries in May 2026 — in `server/tests/integration/time-entries.test.ts` (KAN-417)
- [ ] T050 [P] Write failing integration test: `GET /time-entries?year=2026` without month returns 400 — in `server/tests/integration/time-entries.test.ts`

### Implementation for FR-012

- [ ] T051 Extend `getTimeEntriesHandler` in `server/src/controllers/time-entries.controller.ts` — when `month` is a numeric 1–12 value, require `year` param and combine into `YYYY-MM` format before passing to `listTimeEntries`; when only `year` provided without `month` → 400

**Checkpoint**: T049–T050 all pass. Existing `?month=YYYY-MM` format still works.

---

## Phase 9: Polish & Edge Cases

- [ ] T052 [P] Handle edge case: `employment_percentage = 0` → `quotaHours = 0`, `missingHoursToDate = 0`, all working days `day_off` — verify with a targeted test in `server/tests/integration/monthly-summary.test.ts`
- [ ] T053 [P] Handle edge case: future month → `reportedHours = 0`, `missingHoursToDate = 0`, no crash — verify with a targeted test
- [ ] T054 [P] Handle edge case: cross-midnight entries (e.g., 22:00–02:00) correctly counted on start date — verify `reportedHours` includes their duration
- [ ] T055 Ensure all numeric fields in response are rounded to max 2 decimal places (no floating-point noise)
- [ ] T056 [P] Add `401` test: missing JWT → `authenticate` middleware rejects before handler runs

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Foundational)**: No dependencies — start immediately
- **Phase 2–8 (Stories)**: All depend on Phase 1 completion
- **Phase 2 (US1)**: Must complete before Phase 3 (US2 reuses `quotaHours` / `dailyStandard`)
- **Phase 3 (US2)**: Depends on Phase 2
- **Phase 4–6 (US3–US6)**: Can start after Phase 1; independent of each other
- **Phase 7 (Permissions)**: Can start after Phase 1; independent of story phases
- **Phase 8 (FR-012)**: Fully independent — separate file/handler
- **Phase 9 (Polish)**: After all story phases complete

### Parallel Opportunities

Once Phase 1 is done, these can run in parallel across team members:
- Phase 4 (US3+US4) ‖ Phase 5 (US5) ‖ Phase 6 (US6) ‖ Phase 7 (Permissions) ‖ Phase 8 (FR-012)

Within each phase, all `[P]`-marked test tasks can be written simultaneously.

---

## Implementation Strategy

### MVP (Phase 1 + Phase 2 only)

1. Complete Phase 1 — route live, returns 501
2. Complete Phase 2 — `quotaHours`, `reportedHours`, `completionPercentage` working
3. **STOP and VALIDATE**: Confirm T005–T009 green, demo to team

### Full Delivery

Complete phases in order: 1 → 2 → 3 → (4‖5‖6‖7‖8) → 9

---

## Notes

- All tests live in `server/tests/integration/monthly-summary.test.ts` (new file)
- FR-012 tests go in the existing `server/tests/integration/time-entries.test.ts`
- Use existing seed helpers (`seedUser`, `seedTimeEntry`, `seedHoliday`, `seedMonthLock`) from `time-entries.test.ts`
- Add an `seedAbsence` helper if one doesn't exist yet
- Never commit a phase with red tests — each phase ends green
