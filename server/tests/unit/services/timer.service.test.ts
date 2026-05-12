/// <reference types="jest" />
/**
 * Unit tests — timer.service (F10)
 *
 * Covers three categories:
 *
 * 1. Pure helpers (no DB):
 *      rowToStartDate(row) — string date field (existing cases)
 *      rowToStartDate(row) — Date-object date field (pg driver returns DATE as Date)
 *      today()             — YYYY-MM-DD format, UTC vs local boundary
 *
 * 2. Service functions (DB mocked):
 *      startTimer  — 409 on duplicate, success path, Date-object date field from pg
 *      stopTimer   — 404 when no timer, duration at the minute boundary, month-lock 423,
 *                    overlap rejection passthrough
 *      getTimerStatus — running:false, correct elapsedSeconds (including zero at start)
 *
 * No real DB connection is opened.
 * The clock is frozen where needed via jest.useFakeTimers().
 * Timezone: process.env.TZ = 'Asia/Jerusalem' matches production.
 */

process.env.TZ = 'Asia/Jerusalem';

// ── DB mock ───────────────────────────────────────────────────────────────────
//
// Table-aware: each db('tableName') call returns a builder whose first() resolves
// to firstResultByTable[tableName].  Tests configure behaviour by setting entries
// in that map before calling the service under test.

jest.mock('../../../src/database/connection', () => {
  const state: {
    firstResultByTable: Record<string, unknown>;
    returningResult: unknown[];
  } = {
    firstResultByTable: {},
    returningResult: [],
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mockDb: any = jest.fn().mockImplementation((tableName: string) => ({
    where: jest.fn().mockReturnThis(),
    whereNull: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    first: jest.fn().mockImplementation(() =>
      Promise.resolve(state.firstResultByTable[tableName]),
    ),
    returning: jest.fn().mockImplementation(() => Promise.resolve(state.returningResult)),
    update: jest.fn().mockResolvedValue(1),
  }));

  mockDb.__state = state;
  return mockDb;
});

// Mock stopTimer's imported service helpers so the unit tests don't need a
// full DB setup for client/project/task/assignment validation queries.
jest.mock('../../../src/services/time-entries.service', () => ({
  ...jest.requireActual('../../../src/services/time-entries.service'),
  validateTimeEntryInputs: jest.fn().mockResolvedValue(undefined),
  hasOverlap: jest.fn().mockResolvedValue(false),
}));

// Silence the fire-and-forget audit log writes.
jest.mock('../../../src/services/auth.service', () => ({
  writeAuditLog: jest.fn().mockResolvedValue(undefined),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const mockDb = require('../../../src/database/connection') as {
  __state: {
    firstResultByTable: Record<string, unknown>;
    returningResult: unknown[];
  };
};

import {
  rowToStartDate,
  today,
  startTimer,
  stopTimer,
  getTimerStatus,
} from '../../../src/services/timer.service';

import { validateTimeEntryInputs, hasOverlap } from '../../../src/services/time-entries.service';

beforeEach(() => {
  mockDb.__state.firstResultByTable = {};
  mockDb.__state.returningResult = [];
  jest.useRealTimers();
  (validateTimeEntryInputs as jest.Mock).mockResolvedValue(undefined);
  (hasOverlap as jest.Mock).mockResolvedValue(false);
});

// ── rowToStartDate (string date field) ───────────────────────────────────────

describe('rowToStartDate', () => {
  it('should_return_correct_Date_when_given_ISO_date_string_and_HH_MM_SS_start_time', () => {
    const result = rowToStartDate({ id: 1, user_id: 1, date: '2026-05-12', start_time: '09:30:00' });

    expect(result).toBeInstanceOf(Date);
    expect(result.toISOString()).toBe(new Date('2026-05-12T09:30:00').toISOString());
  });

  it('should_return_correct_Date_when_start_time_is_midnight', () => {
    const result = rowToStartDate({ id: 1, user_id: 1, date: '2026-01-01', start_time: '00:00:00' });

    expect(result).toBeInstanceOf(Date);
    expect(result.toISOString()).toBe(new Date('2026-01-01T00:00:00').toISOString());
  });

  it('should_return_correct_Date_when_start_time_is_end_of_day', () => {
    const result = rowToStartDate({ id: 1, user_id: 1, date: '2026-06-15', start_time: '23:59:59' });

    expect(result).toBeInstanceOf(Date);
    expect(result.toISOString()).toBe(new Date('2026-06-15T23:59:59').toISOString());
  });

  it('should_produce_a_date_whose_elapsed_seconds_calculation_yields_non_negative_result_when_row_is_from_today', () => {
    const nowIso = new Date().toISOString();
    const dateStr = nowIso.slice(0, 10);
    const timeStr = nowIso.slice(11, 19);

    const result = rowToStartDate({ id: 1, user_id: 1, date: dateStr, start_time: timeStr });
    const elapsed = Math.floor((Date.now() - result.getTime()) / 1_000);

    expect(Number.isNaN(elapsed)).toBe(false);
    expect(elapsed).toBeGreaterThanOrEqual(0);
  });
});

// ── rowToStartDate (Date-object date field — pg driver format) ────────────────
//
// The pg driver returns DATE columns as JavaScript Date objects (midnight local),
// not strings.  The service handles this with an `instanceof Date` branch that
// extracts the local calendar date using getFullYear/getMonth/getDate.
// These tests exercise that branch and guard against a latent UTC-shift bug:
// in Israel (UTC+3) a Date at local midnight corresponds to the *previous* UTC
// date — so using UTC date methods would silently return the wrong day.

describe('rowToStartDate — Date-object date field (pg driver format)', () => {
  it('should_correctly_construct_a_Date_when_date_field_is_a_Date_object', () => {
    const dateObj = new Date('2026-05-12T00:00:00');
    const result = rowToStartDate({ id: 1, user_id: 1, date: dateObj, start_time: '09:30:00' });

    expect(result).toBeInstanceOf(Date);
    expect(result.toISOString()).toBe(new Date('2026-05-12T09:30:00').toISOString());
  });

  it('should_use_local_date_not_UTC_date_when_Date_object_spans_the_UTC_midnight_boundary', () => {
    // In Israel (UTC+3), 2026-05-13T00:00:00 local = 2026-05-12T21:00:00Z UTC.
    // Using UTC date methods would yield '2026-05-12' (wrong).
    const dateObj = new Date('2026-05-13T00:00:00');
    const result = rowToStartDate({ id: 1, user_id: 1, date: dateObj, start_time: '06:00:00' });

    expect(result.toISOString()).toBe(new Date('2026-05-13T06:00:00').toISOString());
  });

  it('should_produce_the_same_result_for_a_Date_object_and_its_equivalent_string', () => {
    const dateStr = '2026-06-01';
    const dateObj = new Date('2026-06-01T00:00:00');
    const startTime = '14:00:00';

    const fromString = rowToStartDate({ id: 1, user_id: 1, date: dateStr, start_time: startTime });
    const fromObject = rowToStartDate({ id: 1, user_id: 1, date: dateObj, start_time: startTime });

    expect(fromString.getTime()).toBe(fromObject.getTime());
  });

  it('should_handle_a_year_boundary_Date_object_correctly', () => {
    const dateObj = new Date('2026-01-01T00:00:00');
    const result = rowToStartDate({ id: 1, user_id: 1, date: dateObj, start_time: '00:00:01' });

    expect(result.toISOString()).toBe(new Date('2026-01-01T00:00:01').toISOString());
  });
});

// ── today ─────────────────────────────────────────────────────────────────────

describe('today', () => {
  it('should_return_a_string_matching_YYYY_MM_DD_format', () => {
    const result = today();

    expect(typeof result).toBe('string');
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('should_return_the_current_local_date_when_clock_is_frozen_at_UTC_midday', () => {
    jest.useFakeTimers({ now: new Date('2026-05-12T14:00:00.000Z').getTime() });

    const result = today();

    expect(result).toBe('2026-05-12');
  });

  it('should_return_next_local_day_when_clock_is_past_local_midnight', () => {
    // 23:59:59 UTC = 02:59:59 local (Israel, UTC+3) on 2026-05-13.
    jest.useFakeTimers({ now: new Date('2026-05-12T23:59:59.000Z').getTime() });

    const result = today();

    expect(result).toBe('2026-05-13');
  });
});

// ── startTimer ────────────────────────────────────────────────────────────────

describe('startTimer', () => {
  it('should_throw_AppError_409_when_an_open_row_already_exists_for_today', async () => {
    mockDb.__state.firstResultByTable['time_entries'] = {
      id: 1, user_id: 42, date: '2026-05-12', start_time: '09:00:00',
    };

    await expect(startTimer(42)).rejects.toMatchObject({ statusCode: 409 });
  });

  it('should_return_timeEntryId_and_startTime_when_no_existing_row_for_today', async () => {
    mockDb.__state.returningResult = [{ id: 7, date: '2026-05-12', start_time: '10:00:00' }];

    const result = await startTimer(42);

    expect(result.timeEntryId).toBe(7);
    expect(result.startTime).toBeInstanceOf(Date);
    expect(Number.isNaN(result.startTime.getTime())).toBe(false);
  });

  it('should_return_a_valid_startTime_when_db_returns_date_as_a_Date_object', async () => {
    mockDb.__state.returningResult = [
      { id: 5, date: new Date('2026-05-12T00:00:00'), start_time: '08:30:00' },
    ];

    const result = await startTimer(99);

    expect(Number.isNaN(result.startTime.getTime())).toBe(false);
    expect(result.startTime.toISOString()).toBe(new Date('2026-05-12T08:30:00').toISOString());
  });
});

// ── stopTimer ─────────────────────────────────────────────────────────────────

describe('stopTimer', () => {
  const details = {
    clientId: 1,
    projectId: 2,
    taskId: 3,
    location: 'office' as const,
    description: 'work done',
  };

  it('should_throw_AppError_404_when_no_open_row_exists_for_today', async () => {
    await expect(stopTimer(42, details)).rejects.toMatchObject({ statusCode: 404 });
  });

  it('should_throw_AppError_423_when_the_month_is_locked', async () => {
    mockDb.__state.firstResultByTable['time_entries'] = {
      id: 3, user_id: 42, date: '2026-05-12', start_time: '10:00:00',
    };
    mockDb.__state.firstResultByTable['month_locks'] = { id: 1 };

    await expect(stopTimer(42, details)).rejects.toMatchObject({ statusCode: 423 });
  });

  it('should_throw_AppError_422_when_validateTimeEntryInputs_rejects', async () => {
    mockDb.__state.firstResultByTable['time_entries'] = {
      id: 3, user_id: 42, date: '2026-05-12', start_time: '10:00:00',
    };
    const { AppError } = await import('../../../src/middleware/error.middleware');
    (validateTimeEntryInputs as jest.Mock).mockRejectedValueOnce(
      new AppError('User is not assigned to this task', 422),
    );

    await expect(stopTimer(42, details)).rejects.toMatchObject({ statusCode: 422 });
  });

  it('should_throw_AppError_409_when_hasOverlap_returns_true', async () => {
    mockDb.__state.firstResultByTable['time_entries'] = {
      id: 3, user_id: 42, date: '2026-05-12', start_time: '10:00:00',
    };
    (hasOverlap as jest.Mock).mockResolvedValueOnce(true);

    await expect(stopTimer(42, details)).rejects.toMatchObject({ statusCode: 409 });
  });

  it('should_return_durationMinutes_0_for_a_timer_stopped_before_the_next_whole_minute', async () => {
    // calculateDurationMinutes uses minute-precision (HH:MM only) — 59 seconds
    // into the first minute still yields 0.
    const startMs = new Date('2026-05-12T10:00:00').getTime();
    const stopMs = startMs + 59_000; // 10:00:59

    mockDb.__state.firstResultByTable['time_entries'] = {
      id: 3, user_id: 42, date: '2026-05-12', start_time: '10:00:00',
    };
    jest.useFakeTimers({ now: stopMs });

    const result = await stopTimer(42, details);

    expect(result.durationMinutes).toBe(0);
  });

  it('should_return_durationMinutes_1_when_the_timer_crosses_one_full_minute', async () => {
    // Exactly 60 seconds = 10:01:00 — the minute hand advances, yielding 1 minute.
    const startMs = new Date('2026-05-12T10:00:00').getTime();
    const stopMs = startMs + 60_000; // 10:01:00

    mockDb.__state.firstResultByTable['time_entries'] = {
      id: 3, user_id: 42, date: '2026-05-12', start_time: '10:00:00',
    };
    jest.useFakeTimers({ now: stopMs });

    const result = await stopTimer(42, details);

    expect(result.durationMinutes).toBe(1);
  });

  it('should_return_durationMinutes_60_for_an_exact_one_hour_timer', async () => {
    const startMs = new Date('2026-05-12T09:00:00').getTime();
    const stopMs = startMs + 3_600_000; // 10:00:00

    mockDb.__state.firstResultByTable['time_entries'] = {
      id: 3, user_id: 42, date: '2026-05-12', start_time: '09:00:00',
    };
    jest.useFakeTimers({ now: stopMs });

    const result = await stopTimer(42, details);

    expect(result.durationMinutes).toBe(60);
  });

  it('should_include_timeEntryId_startTime_and_stopTime_in_the_return_value', async () => {
    const startMs = new Date('2026-05-12T08:00:00').getTime();
    const stopMs = startMs + 120_000; // 2 minutes

    mockDb.__state.firstResultByTable['time_entries'] = {
      id: 9, user_id: 42, date: '2026-05-12', start_time: '08:00:00',
    };
    jest.useFakeTimers({ now: stopMs });

    const result = await stopTimer(42, details);

    expect(result.timeEntryId).toBe(9);
    expect(result.startTime).toBeInstanceOf(Date);
    expect(result.stopTime).toBeInstanceOf(Date);
    expect(result.stopTime.getTime()).toBe(stopMs);
  });
});

// ── getTimerStatus ────────────────────────────────────────────────────────────

describe('getTimerStatus', () => {
  it('should_return_running_false_when_no_open_row_exists_for_today', async () => {
    const result = await getTimerStatus(42);

    expect(result).toEqual({ running: false });
  });

  it('should_return_running_true_with_correct_elapsedSeconds_for_an_active_timer', async () => {
    const startMs = new Date('2026-05-12T09:00:00').getTime();
    const nowMs = startMs + 300_000; // 5 minutes = 300 s elapsed

    mockDb.__state.firstResultByTable['time_entries'] = {
      id: 2, user_id: 42, date: '2026-05-12', start_time: '09:00:00',
    };
    jest.useFakeTimers({ now: nowMs });

    const result = await getTimerStatus(42);

    expect(result.running).toBe(true);
    if (result.running) {
      expect(result.timeEntryId).toBe(2);
      expect(result.elapsedSeconds).toBe(300);
      expect(result.startTime).toBeInstanceOf(Date);
    }
  });

  it('should_return_elapsedSeconds_0_when_the_timer_row_was_just_created', async () => {
    const nowMs = new Date('2026-05-12T10:00:00').getTime();

    mockDb.__state.firstResultByTable['time_entries'] = {
      id: 4, user_id: 42, date: '2026-05-12', start_time: '10:00:00',
    };
    jest.useFakeTimers({ now: nowMs });

    const result = await getTimerStatus(42);

    expect(result.running).toBe(true);
    if (result.running) {
      expect(result.elapsedSeconds).toBe(0);
    }
  });

  it('should_return_running_true_with_timeEntryId_matching_the_db_row', async () => {
    const nowMs = new Date('2026-05-12T11:00:00').getTime();

    mockDb.__state.firstResultByTable['time_entries'] = {
      id: 77, user_id: 42, date: '2026-05-12', start_time: '10:00:00',
    };
    jest.useFakeTimers({ now: nowMs });

    const result = await getTimerStatus(42);

    expect(result.running).toBe(true);
    if (result.running) {
      expect(result.timeEntryId).toBe(77);
      expect(result.elapsedSeconds).toBe(3600);
    }
  });
});
