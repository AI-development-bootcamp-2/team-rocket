import type { Knex } from 'knex';
import { AppError } from '../middleware/error.middleware';
import { writeAuditLog } from './auth.service';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const db = require('../database/connection') as Knex;

export interface MonthLockRow {
  id: number;
  year: number;
  month: number;
  is_locked: boolean;
  locked_by: number;
  locked_at: Date;
  unlocked_by: number | null;
  unlocked_at: Date | null;
  unlock_reason: string | null;
}

export interface MonthStatusResult {
  year: number;
  month: number;
  is_locked: boolean;
  locked_by: number | null;
  locked_at: Date | null;
  unapproved_week_count: number;
}

// ── Shared helper (used by time-entries and absences guards) ──────────────────

export async function isMonthLocked(year: number, month: number): Promise<boolean> {
  const row = await db('month_locks')
    .where({ year, month, is_locked: true })
    .first() as { id: number } | undefined;
  return row != null;
}

// ── lock ──────────────────────────────────────────────────────────────────────

export async function lock(year: number, month: number, adminId: number): Promise<MonthLockRow> {
  // Upsert: insert on first lock, update on re-lock after unlock
  const result = await db.raw<{ rows: MonthLockRow[] }>(
    `INSERT INTO month_locks (year, month, is_locked, locked_by, locked_at, unlocked_by, unlocked_at, unlock_reason)
     VALUES (:year, :month, true, :adminId, NOW(), NULL, NULL, NULL)
     ON CONFLICT (year, month) DO UPDATE SET
       is_locked     = true,
       locked_by     = :adminId,
       locked_at     = NOW(),
       unlocked_by   = NULL,
       unlocked_at   = NULL,
       unlock_reason = NULL
     RETURNING *`,
    { year, month, adminId },
  );
  const row = result.rows[0];

  writeAuditLog({
    actorUserId: adminId,
    entityType: 'MONTH_LOCK',
    entityId: row.id,
    action: 'LOCK',
    newValue: { year, month },
  }).catch((err: unknown) => console.error('[audit] month lock:', err));

  // Background fan-out — must not block the HTTP response
  fanOutLockedMonthNotifications(year, month).catch(
    (err: unknown) => console.error('[notifications] month lock fan-out:', err),
  );

  return row;
}

// ── unlock ────────────────────────────────────────────────────────────────────

export async function unlock(
  year: number,
  month: number,
  adminId: number,
  reason: string,
): Promise<MonthLockRow> {
  if (!reason || !reason.trim()) {
    throw new AppError('Unlock reason is required', 422);
  }

  const rows = await db<MonthLockRow>('month_locks')
    .where({ year, month, is_locked: true })
    .update({
      is_locked: false,
      unlocked_by: adminId,
      unlocked_at: db.fn.now(),
      unlock_reason: reason.trim(),
    })
    .returning('*') as MonthLockRow[];

  if (rows.length === 0) {
    throw new AppError('Month is not currently locked', 422);
  }

  const [row] = rows;

  // Store reason in audit_logs.reason per spec
  writeAuditLog({
    actorUserId: adminId,
    entityType: 'MONTH_LOCK',
    entityId: row.id,
    action: 'UNLOCK',
    newValue: { year, month },
    reason: reason.trim(),
  }).catch((err: unknown) => console.error('[audit] month unlock:', err));

  return row;
}

// ── getStatus ─────────────────────────────────────────────────────────────────

export async function getStatus(year: number, month: number): Promise<MonthStatusResult> {
  const lockRow = await db<MonthLockRow>('month_locks')
    .where({ year, month })
    .first();

  // Count distinct weeks in the month that have at least one non-approved submission
  const [{ count }] = await db('weekly_submissions')
    .whereRaw(
      'EXTRACT(YEAR FROM week_start_date) = ? AND EXTRACT(MONTH FROM week_start_date) = ?',
      [year, month],
    )
    .whereNot('status', 'approved')
    .countDistinct('week_start_date as count') as [{ count: string }];

  return {
    year,
    month,
    is_locked: lockRow?.is_locked ?? false,
    locked_by: lockRow?.locked_by ?? null,
    locked_at: lockRow?.locked_at ?? null,
    unapproved_week_count: Number(count),
  };
}

// ── listMonths ────────────────────────────────────────────────────────────────

export async function listMonths(): Promise<MonthLockRow[]> {
  return db<MonthLockRow>('month_locks')
    .orderBy('year', 'desc')
    .orderBy('month', 'desc');
}

// ── notification fan-out (private) ────────────────────────────────────────────

async function fanOutLockedMonthNotifications(year: number, month: number): Promise<void> {
  const monthLabel = `${String(month).padStart(2, '0')}/${year}`;
  // Single INSERT ... SELECT to avoid N+1 queries; ON CONFLICT DO NOTHING is
  // a safety net in case of duplicate lock calls.
  await db.raw(
    `INSERT INTO notifications (user_id, type, title, body, related_entity_type, related_entity_id)
     SELECT id, 'LOCKED_MONTH', ?, ?, 'MONTH_LOCK', ?
     FROM users
     WHERE is_active = true
     ON CONFLICT DO NOTHING`,
    [
      'החודש ננעל',
      `חודש ${monthLabel} ננעל על ידי מנהל המערכת`,
      year * 100 + month,
    ],
  );
}
