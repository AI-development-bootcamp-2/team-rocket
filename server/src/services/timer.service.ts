import type { Knex } from 'knex';
import { AppError } from '../middleware/error.middleware';
import {
  validateTimeEntryInputs,
  hasOverlap,
  calculateDurationMinutes,
  timeToMinutes,
} from './time-entries.service';
import { writeAuditLog } from './auth.service';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const db = require('../database/connection') as Knex;

interface TimerRow {
  id: number;
  user_id: number;
  date: Date | string;  // pg returns DATE columns as Date objects
  start_time: string;
}

export type TimerStatus =
  | { running: false }
  | { running: true; timeEntryId: number; startTime: Date; elapsedSeconds: number };

// Extracts a YYYY-MM-DD string from a TimerRow's date field, which pg may
// return as a Date object (midnight local time) or a plain string.
// Uses local date methods so Israel-timezone dates are not shifted by UTC offset.
function rowDateStr(row: TimerRow): string {
  if (row.date instanceof Date) {
    const d = row.date;
    const y = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${mo}-${day}`;
  }
  return row.date;
}

export function rowToStartDate(row: TimerRow): Date {
  return new Date(`${rowDateStr(row)}T${row.start_time}`);
}

// Use local date so the day boundary matches Israel timezone, not UTC.
export function today(): string {
  const d = new Date();
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${mo}-${day}`;
}

export async function startTimer(userId: number): Promise<{ timeEntryId: number; startTime: Date }> {
  const todayStr = today();

  // App-layer check: only block if an open row already exists for today.
  const existing = await db<TimerRow>('time_entries')
    .where({ user_id: userId, date: todayStr })
    .whereNull('end_time')
    .whereNull('deleted_at')
    .first();
  if (existing) {
    throw new AppError('Timer already running', 409);
  }

  const startTimeStr = new Date().toTimeString().slice(0, 8);

  let row: TimerRow;
  try {
    [row] = await db('time_entries')
      .insert({ user_id: userId, date: todayStr, start_time: startTimeStr })
      .returning(['id', 'date', 'start_time']);
  } catch (err: unknown) {
    // Two concurrent requests can both pass the SELECT check above and race to INSERT.
    // The partial unique index rejects the second with a unique-violation (23505);
    // surface it as 409 instead of letting it bubble up as a 500.
    const pgErr = err as { code?: string };
    if (pgErr.code === '23505') {
      throw new AppError('Timer already running', 409);
    }
    throw err;
  }

  return { timeEntryId: row.id, startTime: rowToStartDate(row) };
}

export async function quickStop(userId: number): Promise<{
  timeEntryId: number;
  startTime: Date;
  stopTime: Date;
  durationMinutes: number;
  version: number;
}> {
  const row = await db<TimerRow>('time_entries')
    .where({ user_id: userId, date: today() })
    .whereNull('end_time')
    .whereNull('deleted_at')
    .first();
  if (!row) throw new AppError('No active timer', 404);

  const dateStr = rowDateStr(row);
  const [yearStr, monthStr] = dateStr.split('-');
  const lock = await db('month_locks')
    .where({ year: Number(yearStr), month: Number(monthStr), is_locked: true })
    .first();
  if (lock) throw new AppError('Month is locked', 423);

  const stopTime = new Date();
  const endTimeStr = stopTime.toTimeString().slice(0, 8);
  const durationMinutes =
    timeToMinutes(row.start_time) === timeToMinutes(endTimeStr)
      ? 0
      : calculateDurationMinutes(row.start_time, endTimeStr);

  await db('time_entries').where({ id: row.id }).update({
    end_time: endTimeStr,
    duration_minutes: durationMinutes,
  });

  const updated = await db<{ version: number }>('time_entries')
    .where({ id: row.id })
    .select('version')
    .first();

  return {
    timeEntryId: row.id,
    startTime: rowToStartDate(row),
    stopTime,
    durationMinutes,
    version: updated?.version ?? 0,
  };
}

export async function stopTimer(
  userId: number,
  details: {
    clientId: number;
    projectId: number;
    taskId: number;
    location: 'office' | 'home' | 'client';
    description: string;
  },
): Promise<{ timeEntryId: number; startTime: Date; stopTime: Date; durationMinutes: number }> {
  const row = await db<TimerRow>('time_entries')
    .where({ user_id: userId, date: today() })
    .whereNull('end_time')
    .whereNull('deleted_at')
    .first();
  if (!row) {
    throw new AppError('No active timer', 404);
  }

  const dateStr = rowDateStr(row);

  // Month-lock guard — mirrors the check in updateTimeEntry
  const [yearStr, monthStr] = dateStr.split('-');
  const lock = await db('month_locks')
    .where({ year: Number(yearStr), month: Number(monthStr), is_locked: true })
    .first();
  if (lock) {
    throw new AppError('Month is locked', 423);
  }

  // Business-rule validation: assignment, active client/project, open task, FK hierarchy
  await validateTimeEntryInputs({
    userId,
    date: dateStr,
    clientId: details.clientId,
    projectId: details.projectId,
    taskId: details.taskId,
  });

  const stopTime = new Date();
  const endTimeStr = stopTime.toTimeString().slice(0, 8);

  // Overlap check — exclude the partial row itself (end_time IS NULL) from the query
  const overlaps = await hasOverlap({
    userId,
    date: dateStr,
    startTime: row.start_time,
    endTime: endTimeStr,
    excludeId: row.id,
  });
  if (overlaps) {
    throw new AppError('Time entry overlaps with an existing entry for this day', 409);
  }

  // Use the same string-based minute arithmetic as createTimeEntry so duration is
  // consistent regardless of sub-second timing jitter in the server clock.
  // Guard: calculateDurationMinutes returns 1440 when both times share the same
  // HH:MM (equal minutes → cross-midnight branch fires). A sub-minute timer is 0.
  const durationMinutes =
    timeToMinutes(row.start_time) === timeToMinutes(endTimeStr)
      ? 0
      : calculateDurationMinutes(row.start_time, endTimeStr);

  await db('time_entries').where({ id: row.id }).update({
    end_time: endTimeStr,
    duration_minutes: durationMinutes,
    client_id: details.clientId,
    project_id: details.projectId,
    task_id: details.taskId,
    location: details.location,
    description: details.description,
  });

  writeAuditLog({
    actorUserId: userId,
    entityType: 'TIMER',
    entityId: row.id,
    action: 'CREATE',
    newValue: {
      id: row.id,
      user_id: userId,
      date: dateStr,
      start_time: row.start_time,
      end_time: endTimeStr,
      duration_minutes: durationMinutes,
      client_id: details.clientId,
      project_id: details.projectId,
      task_id: details.taskId,
      location: details.location,
      description: details.description,
    } as Record<string, unknown>,
  }).catch((err: unknown) => console.error('[audit] timer stop:', err));

  const startTime = rowToStartDate(row);
  return { timeEntryId: row.id, startTime, stopTime, durationMinutes };
}

export async function getTimerStatus(userId: number): Promise<TimerStatus> {
  const row = await db<TimerRow>('time_entries')
    .where({ user_id: userId, date: today() })
    .whereNull('end_time')
    .whereNull('deleted_at')
    .first();
  if (!row) return { running: false };

  const startTime = rowToStartDate(row);
  const elapsedSeconds = Math.floor((Date.now() - startTime.getTime()) / 1_000);
  return { running: true, timeEntryId: row.id, startTime, elapsedSeconds };
}
