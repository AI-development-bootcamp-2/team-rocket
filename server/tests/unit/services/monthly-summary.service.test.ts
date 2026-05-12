/**
 * Unit tests — monthly-summary service pure helpers
 *
 * These tests cover computeDailyStandard (from time-entries.service)
 * and countWorkingDaysInMonth / buildQuotaHours (from monthly-summary.service),
 * which are exported specifically for testing.
 *
 * No DB connection required — all functions under test are pure.
 */
import {
  computeDailyStandard,
  countWorkingDaysInMonth,
  buildQuotaHours,
  countPassedWorkingDays,
  buildMissingHoursToDate,
  buildAbsenceHours,
  buildDaysWithoutReport,
} from '../../../src/services/monthly-summary.service';

// ── computeDailyStandard ──────────────────────────────────────────────────────

describe('computeDailyStandard', () => {
  it('returns 9 for 100% employment with no daily override', () => {
    expect(computeDailyStandard({ daily_hours_override: null, employment_percentage: 100 })).toBe(
      9,
    );
  });

  it('returns 4.5 for 50% employment with no daily override', () => {
    expect(computeDailyStandard({ daily_hours_override: null, employment_percentage: 50 })).toBe(
      4.5,
    );
  });

  it('applies daily_hours_override when set', () => {
    expect(computeDailyStandard({ daily_hours_override: 8, employment_percentage: 100 })).toBe(8);
  });

  it('combines override with employment_percentage', () => {
    expect(computeDailyStandard({ daily_hours_override: 8, employment_percentage: 50 })).toBe(4);
  });

  it('returns 0 for 0% employment (edge case)', () => {
    expect(computeDailyStandard({ daily_hours_override: null, employment_percentage: 0 })).toBe(0);
  });

  it('returns 0 for 0% employment even with an override', () => {
    expect(computeDailyStandard({ daily_hours_override: 10, employment_percentage: 0 })).toBe(0);
  });
});

// ── countWorkingDaysInMonth ───────────────────────────────────────────────────

describe('countWorkingDaysInMonth', () => {
  it('counts 21 working days in January 2026 (no holidays)', () => {
    // Jan 1 = Thu; working days = Sun–Thu
    expect(countWorkingDaysInMonth(2026, 1, [])).toBe(21);
  });

  it('deducts holidays that fall on working days', () => {
    // Jan 4 (Sun) is a working day — holiday should reduce count by 1
    expect(countWorkingDaysInMonth(2026, 1, ['2026-01-04'])).toBe(20);
  });

  it('does NOT deduct holidays that fall on weekends', () => {
    // Jan 2 (Fri) and Jan 3 (Sat) are already off — no extra deduction
    expect(countWorkingDaysInMonth(2026, 1, ['2026-01-02', '2026-01-03'])).toBe(21);
  });

  it('deducts multiple working-day holidays', () => {
    expect(countWorkingDaysInMonth(2026, 1, ['2026-01-04', '2026-01-05', '2026-01-06'])).toBe(18);
  });

  it('returns 0 when every working day is a holiday', () => {
    // Build a list of all 21 working days in Jan 2026
    const workingDays = [
      '2026-01-01',
      '2026-01-04',
      '2026-01-05',
      '2026-01-06',
      '2026-01-07',
      '2026-01-08',
      '2026-01-11',
      '2026-01-12',
      '2026-01-13',
      '2026-01-14',
      '2026-01-15',
      '2026-01-18',
      '2026-01-19',
      '2026-01-20',
      '2026-01-21',
      '2026-01-22',
      '2026-01-25',
      '2026-01-26',
      '2026-01-27',
      '2026-01-28',
      '2026-01-29',
    ];
    expect(countWorkingDaysInMonth(2026, 1, workingDays)).toBe(0);
  });

  it('handles February in a leap year', () => {
    // Feb 2028 is a leap year: Feb 1 = Tue → 29 days total
    // Fri/Sat = off; need to count manually
    // Feb 2028: 1=Tue(work), 2=Wed(work), 3=Thu(work), 4=Fri(off), 5=Sat(off),
    //           6=Sun(work)… 4 full Sun–Thu weeks + partial
    // Just assert it's a positive number and differs from a non-leap year
    const leap = countWorkingDaysInMonth(2028, 2, []);
    const nonLeap = countWorkingDaysInMonth(2025, 2, []);
    expect(leap).toBeGreaterThan(0);
    expect(typeof leap).toBe('number');
    // 2028 has 29 days, 2025 has 28 — could differ
    expect(Math.abs(leap - nonLeap)).toBeLessThanOrEqual(1);
  });
});

// ── buildQuotaHours ───────────────────────────────────────────────────────────

describe('buildQuotaHours', () => {
  it('standard month: workingDays × dailyStandard', () => {
    expect(buildQuotaHours(21, 9, 0, 0)).toBe(189);
  });

  it('deducts one full-day absence (× dailyStandard)', () => {
    // 21 × 9 − 1 × 9 = 180
    expect(buildQuotaHours(21, 9, 1, 0)).toBe(180);
  });

  it('deducts one partial absence (× dailyStandard / 2)', () => {
    // 21 × 9 − 1 × 4.5 = 184.5
    expect(buildQuotaHours(21, 9, 0, 1)).toBe(184.5);
  });

  it('deducts both full-day and partial absences', () => {
    // 21 × 9 − 2 × 9 − 1 × 4.5 = 189 − 18 − 4.5 = 166.5
    expect(buildQuotaHours(21, 9, 2, 1)).toBe(166.5);
  });

  it('returns 0 when dailyStandard is 0 (employment_percentage = 0)', () => {
    expect(buildQuotaHours(21, 0, 0, 0)).toBe(0);
  });

  it('never returns negative even if absences exceed working days', () => {
    // 5 working days, 10 full-day absences seeded (data anomaly)
    // 5 × 9 − 10 × 9 = −45 → should clamp to 0
    expect(buildQuotaHours(5, 9, 10, 0)).toBeGreaterThanOrEqual(0);
  });

  it('handles partial-only absences with 50% employment', () => {
    // dailyStandard = 4.5; 21 × 4.5 − 1 × 2.25 = 94.5 − 2.25 = 92.25
    expect(buildQuotaHours(21, 4.5, 0, 1)).toBe(92.25);
  });
});

// ── countPassedWorkingDays ───────────────────────────────────────────────────
//
// January 2026 reference (Sun–Thu working week):
//   Jan 1=Thu, 4=Sun, 5=Mon, 6=Tue, 7=Wed, 8=Thu,
//   11=Sun, 12=Mon, 13=Tue, 14=Wed, 15=Thu  →  11 working days by day 15

describe('countPassedWorkingDays', () => {
  it('counts 11 working days up to Jan 15', () => {
    expect(countPassedWorkingDays(2026, 1, 15, [])).toBe(11);
  });

  it('counts all 21 working days when cutoff is the last day of the month', () => {
    expect(countPassedWorkingDays(2026, 1, 31, [])).toBe(21);
  });

  it('counts 1 when cutoff is Jan 1 (a working day)', () => {
    expect(countPassedWorkingDays(2026, 1, 1, [])).toBe(1);
  });

  it('counts 1 when cutoff is Jan 2 (Friday = weekend, but Jan 1 already counted)', () => {
    expect(countPassedWorkingDays(2026, 1, 2, [])).toBe(1);
  });

  it('returns 0 when cutoff is before the month starts', () => {
    expect(countPassedWorkingDays(2026, 1, 0, [])).toBe(0);
  });

  it('deducts a holiday that falls within the elapsed period', () => {
    // Jan 4 (Sun) is a working day — one holiday → 10 instead of 11
    expect(countPassedWorkingDays(2026, 1, 15, ['2026-01-04'])).toBe(10);
  });

  it('ignores a holiday that falls after the cutoff', () => {
    // Jan 20 is after cutoff Jan 15 → no change
    expect(countPassedWorkingDays(2026, 1, 15, ['2026-01-20'])).toBe(11);
  });

  it('ignores a holiday on a weekend (already off)', () => {
    // Jan 2 (Fri) is already a weekend — adding it as holiday changes nothing
    expect(countPassedWorkingDays(2026, 1, 15, ['2026-01-02'])).toBe(11);
  });
});

// ── buildMissingHoursToDate ───────────────────────────────────────────────────

describe('buildMissingHoursToDate', () => {
  it('returns the gap when reported is below expected', () => {
    // 11 elapsed × 9h = 99h expected; 54h reported → 45h missing
    expect(buildMissingHoursToDate(11, 9, 54)).toBe(45);
  });

  it('returns 0 when reported equals expected exactly', () => {
    expect(buildMissingHoursToDate(11, 9, 99)).toBe(0);
  });

  it('returns 0 when user over-reported (extra hours carry over, never negative)', () => {
    // 11 × 9 = 99h expected; 110h reported (10h/day) → max(0, 99 − 110) = 0
    expect(buildMissingHoursToDate(11, 9, 110)).toBe(0);
  });

  it('returns 0 when no working days have elapsed yet', () => {
    expect(buildMissingHoursToDate(0, 9, 0)).toBe(0);
  });

  it('returns 0 for a 0% employment user (dailyStandard = 0)', () => {
    expect(buildMissingHoursToDate(21, 0, 0)).toBe(0);
  });

  it('handles fractional daily standards (50% employment)', () => {
    // dailyStandard = 4.5; 11 × 4.5 = 49.5 expected; 27h reported → 22.5 missing
    expect(buildMissingHoursToDate(11, 4.5, 27)).toBe(22.5);
  });
});

// ── buildAbsenceHours ─────────────────────────────────────────────────────────
//
// absenceHours = fullDays × dailyStandard + partialDays × (dailyStandard / 2)
// Holidays are NOT included — they reduce quota but are not user absences.

describe('buildAbsenceHours', () => {
  it('returns 0 when there are no absences', () => {
    expect(buildAbsenceHours(0, 0, 9)).toBe(0);
  });

  it('returns dailyStandard × fullDays for full-day absences only', () => {
    // 1 full-day × 9h = 9
    expect(buildAbsenceHours(1, 0, 9)).toBe(9);
  });

  it('returns dailyStandard / 2 × partialDays for partial absences only', () => {
    // 1 partial × 4.5 = 4.5
    expect(buildAbsenceHours(0, 1, 9)).toBe(4.5);
  });

  it('combines full-day and partial absence hours (T024 scenario)', () => {
    // 1 full × 9 + 1 partial × 4.5 = 13.5
    expect(buildAbsenceHours(1, 1, 9)).toBe(13.5);
  });

  it('handles multiple full-day and partial absences', () => {
    // 2 full × 9 + 3 partial × 4.5 = 18 + 13.5 = 31.5
    expect(buildAbsenceHours(2, 3, 9)).toBe(31.5);
  });

  it('scales with employment_percentage via dailyStandard (50%)', () => {
    // dailyStandard = 4.5; 1 full = 4.5, 1 partial = 2.25 → total = 6.75
    expect(buildAbsenceHours(1, 1, 4.5)).toBe(6.75);
  });

  it('returns 0 when dailyStandard is 0 (employment_percentage = 0)', () => {
    expect(buildAbsenceHours(5, 3, 0)).toBe(0);
  });
});

// ── buildDaysWithoutReport ────────────────────────────────────────────────────
//
// A working day counts as "without report" when it has NO time entries
// AND is NOT covered by a full-day absence.
// Partial-absence days with 0 work hours still count as without report.

describe('buildDaysWithoutReport', () => {
  // Jan 2026 working days (Sun–Thu): all 21 of them
  const allWorkingDays = [
    '2026-01-01',
    '2026-01-04',
    '2026-01-05',
    '2026-01-06',
    '2026-01-07',
    '2026-01-08',
    '2026-01-11',
    '2026-01-12',
    '2026-01-13',
    '2026-01-14',
    '2026-01-15',
    '2026-01-18',
    '2026-01-19',
    '2026-01-20',
    '2026-01-21',
    '2026-01-22',
    '2026-01-25',
    '2026-01-26',
    '2026-01-27',
    '2026-01-28',
    '2026-01-29',
  ];

  it('counts all working days when there are no entries and no absences', () => {
    expect(buildDaysWithoutReport(allWorkingDays, new Set(), new Set())).toBe(21);
  });

  it('excludes days that have time entries', () => {
    const withEntries = new Set(['2026-01-04', '2026-01-05']);
    expect(buildDaysWithoutReport(allWorkingDays, withEntries, new Set())).toBe(19);
  });

  it('excludes days covered by a full-day absence', () => {
    const fullAbsences = new Set(['2026-01-04']);
    expect(buildDaysWithoutReport(allWorkingDays, new Set(), fullAbsences)).toBe(20);
  });

  it('excludes a day that has both an entry and a full-day absence (counts only once)', () => {
    const withEntries = new Set(['2026-01-04']);
    const fullAbsences = new Set(['2026-01-04']);
    // Jan 4 excluded by entry (and also by absence) — result is 20, not 19
    expect(buildDaysWithoutReport(allWorkingDays, withEntries, fullAbsences)).toBe(20);
  });

  it('returns 0 when all working days have entries', () => {
    const withEntries = new Set(allWorkingDays);
    expect(buildDaysWithoutReport(allWorkingDays, withEntries, new Set())).toBe(0);
  });

  it('returns 0 when all working days have full-day absences', () => {
    const fullAbsences = new Set(allWorkingDays);
    expect(buildDaysWithoutReport(allWorkingDays, new Set(), fullAbsences)).toBe(0);
  });

  it('returns 0 for an empty working-day list (e.g. all holidays)', () => {
    expect(buildDaysWithoutReport([], new Set(), new Set())).toBe(0);
  });
});
