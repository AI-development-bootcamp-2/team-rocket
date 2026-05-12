import fs from 'fs/promises';
import type { Knex } from 'knex';
import { AppError } from '../middleware/error.middleware';
import { writeAuditLog } from './auth.service';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const db = require('../database/connection') as Knex;

export interface AbsenceRow {
  id: number;
  user_id: number;
  type: 'sick' | 'vacation_full' | 'vacation_half' | 'reserve';
  start_date: string | Date;
  end_date: string | Date;
  is_partial: boolean;
  notes: string | null;
  status: 'draft' | 'submitted';
  version: number;
  deleted_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface AttachmentRow {
  id: number;
  absence_id: number;
  file_name: string;
  file_path: string;
  mime_type: string;
  size_bytes: number;
  uploaded_by: number;
  created_at: Date;
}

export interface AbsenceWithAttachments extends AbsenceRow {
  attachments: AttachmentRow[];
}

export interface ListAbsencesFilters {
  caller: { id: number; role: 'admin' | 'user' };
  userId?: number;
  month?: string;
  type?: AbsenceRow['type'];
  dateFrom?: string;
  dateTo?: string;
}

export interface AbsenceWriteInput {
  type: AbsenceRow['type'];
  startDate: string;
  endDate: string;
  isPartial: boolean;
  notes?: string | null;
}

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

function getLocalDateParts(value: string | Date): { year: number; month: number; day: number } {
  if (typeof value === 'string') {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!match) {
      throw new AppError('date must be in YYYY-MM-DD format', 400);
    }
    return {
      year: Number(match[1]),
      month: Number(match[2]),
      day: Number(match[3]),
    };
  }

  return {
    year: value.getFullYear(),
    month: value.getMonth() + 1,
    day: value.getDate(),
  };
}

function parseDateOnly(value: string | Date): Date {
  const { year, month, day } = getLocalDateParts(value);
  return new Date(Date.UTC(year, month - 1, day));
}

function formatDateOnly(value: string | Date): string {
  const { year, month, day } = getLocalDateParts(value);
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

function enumerateDatesInclusive(startDate: string | Date, endDate: string | Date): string[] {
  const start = parseDateOnly(startDate);
  const end = parseDateOnly(endDate);
  const dates: string[] = [];

  for (let current = new Date(start); current <= end; current.setUTCDate(current.getUTCDate() + 1)) {
    dates.push(formatDateOnly(current));
  }

  return dates;
}

function isFridayOrSaturday(date: string | Date): boolean {
  const day = parseDateOnly(date).getUTCDay();
  return day === 5 || day === 6;
}

function countWorkingDays(startDate: string | Date, endDate: string | Date): number {
  return enumerateDatesInclusive(startDate, endDate).filter((date) => !isFridayOrSaturday(date)).length;
}

function getMonthBounds(month: string): { start: string; end: string } {
  const match = /^(\d{4})-(\d{2})$/.exec(month);
  if (!match) {
    throw new AppError('month must be in YYYY-MM format', 400);
  }
  const year = Number(match[1]);
  const monthNum = Number(match[2]);
  const first = new Date(Date.UTC(year, monthNum - 1, 1));
  const last = new Date(Date.UTC(year, monthNum, 0));
  return { start: formatDateOnly(first), end: formatDateOnly(last) };
}

function getOverlappingWorkingDays(
  startDate: string | Date,
  endDate: string | Date,
  rangeStart: string,
  rangeEnd: string,
): number {
  const normalizedStartDate = formatDateOnly(startDate);
  const normalizedEndDate = formatDateOnly(endDate);
  const start = normalizedStartDate > rangeStart ? normalizedStartDate : rangeStart;
  const end = normalizedEndDate < rangeEnd ? normalizedEndDate : rangeEnd;
  if (start > end) return 0;
  return countWorkingDays(start, end);
}

function getWeekStartDate(value: string | Date): string {
  const date = parseDateOnly(value);
  const dayOfWeek = date.getUTCDay();
  const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  date.setUTCDate(date.getUTCDate() + daysToMonday);
  return formatDateOnly(date);
}

function requiresDocument(type: AbsenceRow['type']): boolean {
  return type === 'sick' || type === 'reserve';
}

function getWarningMessage(type: AbsenceRow['type'], attachmentCount: number): string | undefined {
  if (requiresDocument(type) && attachmentCount === 0) {
    return 'חובה לצרף מסמך עד להגשה';
  }
  return undefined;
}

function calculateQuotaImpactMinutes(startDate: string | Date, endDate: string | Date, isPartial: boolean): number {
  const workingDays = countWorkingDays(startDate, endDate);
  return workingDays * (isPartial ? 270 : 540);
}

function normalizeAbsenceType(
  type: AbsenceRow['type'],
  isPartial: boolean,
): { type: AbsenceRow['type']; isPartial: boolean } {
  if (type === 'vacation_half') {
    return { type: 'vacation_half', isPartial: true };
  }

  if (type === 'vacation_full' && isPartial) {
    return { type: 'vacation_half', isPartial: true };
  }

  return { type, isPartial };
}

async function loadAttachments(absenceIds: number[]): Promise<Map<number, AttachmentRow[]>> {
  const byAbsenceId = new Map<number, AttachmentRow[]>();
  if (absenceIds.length === 0) return byAbsenceId;

  const rows = await db<AttachmentRow>('attachments')
    .whereIn('absence_id', absenceIds)
    .orderBy('created_at', 'asc')
    .select('*');

  for (const row of rows) {
    const existing = byAbsenceId.get(row.absence_id) ?? [];
    existing.push(row);
    byAbsenceId.set(row.absence_id, existing);
  }

  return byAbsenceId;
}

function withAttachments(rows: AbsenceRow[], attachmentsByAbsenceId: Map<number, AttachmentRow[]>): AbsenceWithAttachments[] {
  return rows.map((row) => ({
    ...row,
    attachments: attachmentsByAbsenceId.get(row.id) ?? [],
  }));
}

async function findAbsenceVisibleToCaller(
  absenceId: number,
  caller: { id: number; role: 'admin' | 'user' },
): Promise<AbsenceRow | undefined> {
  const query = db<AbsenceRow>('absence_entries')
    .where('id', absenceId)
    .whereNull('deleted_at');

  if (caller.role !== 'admin') {
    query.where('user_id', caller.id);
  }

  return query.first();
}

async function assertWeeksEditable(absence: Pick<AbsenceRow, 'user_id' | 'start_date' | 'end_date'>): Promise<void> {
  const weekStarts = Array.from(
    new Set(enumerateDatesInclusive(absence.start_date, absence.end_date).map(getWeekStartDate)),
  );

  if (weekStarts.length === 0) return;

  const rows = await db('weekly_submissions')
    .where('user_id', absence.user_id)
    .whereIn('week_start_date', weekStarts)
    .select('status') as Array<{ status: string }>;

  if (rows.some((row) => row.status !== 'draft' && row.status !== 'rejected')) {
    throw new AppError('Week has already been submitted', 422);
  }
}

async function assertPartialCoverage(
  userId: number,
  startDate: string | Date,
  endDate: string | Date,
  isPartial: boolean,
): Promise<void> {
  if (!isPartial) return;
  const normalizedStartDate = formatDateOnly(startDate);
  const normalizedEndDate = formatDateOnly(endDate);

  if (normalizedStartDate !== normalizedEndDate) {
    throw new AppError('Partial absence must be a single day', 422);
  }

  const today = formatDateOnly(new Date());
  if (normalizedStartDate > today) {
    return;
  }

  const [{ total }] = await db('time_entries')
    .where({ user_id: userId, date: normalizedStartDate })
    .whereNull('deleted_at')
    .sum('duration_minutes as total') as Array<{ total: string | null }>;

  const workedMinutes = Number(total ?? 0);
  if (workedMinutes < 270) {
    throw new AppError('Partial absence requires at least 4.5 work hours on the same day', 422, {
      missing_minutes: 270 - workedMinutes,
    });
  }
}

function getImpactedMonths(startDate: string, endDate: string): string[] {
  const start = parseDateOnly(startDate);
  const end = parseDateOnly(endDate);
  const months: string[] = [];
  const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
  const last = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1));

  while (cursor <= last) {
    months.push(`${cursor.getUTCFullYear()}-${pad2(cursor.getUTCMonth() + 1)}`);
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }

  return months;
}

async function assertMonthsNotLocked(startDate: string | Date, endDate: string | Date): Promise<void> {
  const pairs = getImpactedMonths(formatDateOnly(startDate), formatDateOnly(endDate))
    .map((m) => m.split('-').map(Number) as [number, number]);

  const lock = await db('month_locks')
    .where('is_locked', true)
    .where(function () {
      for (const [year, month] of pairs) {
        this.orWhere({ year, month });
      }
    })
    .first() as { id: number } | undefined;

  if (lock) {
    throw new AppError('Month is locked', 423);
  }
}

async function assertMonthlyQuotaWithinBounds(
  userId: number,
  startDate: string | Date,
  endDate: string | Date,
  isPartial: boolean,
  excludeAbsenceId?: number,
): Promise<void> {
  const normalizedStartDate = formatDateOnly(startDate);
  const normalizedEndDate = formatDateOnly(endDate);
  const impactedMonths = getImpactedMonths(normalizedStartDate, normalizedEndDate);

  for (const month of impactedMonths) {
    const { start, end } = getMonthBounds(month);
    const monthCapacityMinutes = countWorkingDays(start, end) * 540;
    const nextImpact = getOverlappingWorkingDays(normalizedStartDate, normalizedEndDate, start, end) * (isPartial ? 270 : 540);

    const query = db<AbsenceRow>('absence_entries')
      .where('user_id', userId)
      .whereNull('deleted_at')
      .whereRaw('start_date <= ? AND end_date >= ?', [end, start])
      .select('*');

    if (excludeAbsenceId != null) {
      query.whereNot('id', excludeAbsenceId);
    }

    const existing = await query;
    const existingImpact = existing.reduce(
      (sum, row) => sum + getOverlappingWorkingDays(row.start_date, row.end_date, start, end) * (row.is_partial ? 270 : 540),
      0,
    );

    if (existingImpact + nextImpact > monthCapacityMinutes) {
      throw new AppError('Absence exceeds the remaining monthly quota for this month', 422, { month });
    }
  }
}

export function serializeAbsence(absence: AbsenceWithAttachments) {
  return {
    id: absence.id,
    user_id: absence.user_id,
    type: absence.type,
    start_date: formatDateOnly(absence.start_date),
    end_date: formatDateOnly(absence.end_date),
    is_partial: absence.is_partial,
    notes: absence.notes,
    status: absence.status,
    version: absence.version,
    created_at: absence.created_at,
    updated_at: absence.updated_at,
    working_days_count: countWorkingDays(absence.start_date, absence.end_date),
    quota_minutes_impact: calculateQuotaImpactMinutes(absence.start_date, absence.end_date, absence.is_partial),
    quota_hours_impact: calculateQuotaImpactMinutes(absence.start_date, absence.end_date, absence.is_partial) / 60,
    attachments: absence.attachments.map((attachment) => ({
      id: attachment.id,
      file_name: attachment.file_name,
      mime_type: attachment.mime_type,
      size_bytes: attachment.size_bytes,
      created_at: attachment.created_at,
    })),
  };
}

export async function listAbsences(filters: ListAbsencesFilters): Promise<AbsenceWithAttachments[]> {
  const query = db<AbsenceRow>('absence_entries')
    .whereNull('deleted_at')
    .orderBy('start_date', 'desc')
    .orderBy('id', 'desc');

  if (filters.caller.role === 'admin') {
    if (filters.userId != null) {
      query.where('user_id', filters.userId);
    }
  } else {
    query.where('user_id', filters.caller.id);
  }

  if (filters.type != null) {
    query.where('type', filters.type);
  }

  if (filters.month != null) {
    const { start, end } = getMonthBounds(filters.month);
    query.whereRaw('start_date <= ? AND end_date >= ?', [end, start]);
  }

  if (filters.dateFrom != null || filters.dateTo != null) {
    const start = filters.dateFrom ?? '0001-01-01';
    const end = filters.dateTo ?? '9999-12-31';
    query.whereRaw('start_date <= ? AND end_date >= ?', [end, start]);
  }

  const rows = await query.select('*');
  const attachmentsByAbsenceId = await loadAttachments(rows.map((row) => row.id));
  return withAttachments(rows, attachmentsByAbsenceId);
}

export async function createAbsence(
  caller: { id: number; role: 'admin' | 'user' },
  input: AbsenceWriteInput,
  ipAddress?: string,
): Promise<{ absence: AbsenceWithAttachments; warning?: string }> {
  if (input.startDate > input.endDate) {
    throw new AppError('start_date must be before or equal to end_date', 400);
  }

  const normalized = normalizeAbsenceType(input.type, input.isPartial);

  await assertMonthsNotLocked(input.startDate, input.endDate);
  await assertPartialCoverage(caller.id, input.startDate, input.endDate, normalized.isPartial);
  await assertMonthlyQuotaWithinBounds(caller.id, input.startDate, input.endDate, normalized.isPartial);

  const [row] = await db<AbsenceRow>('absence_entries')
    .insert({
      user_id: caller.id,
      type: normalized.type,
      start_date: input.startDate,
      end_date: input.endDate,
      is_partial: normalized.isPartial,
      notes: input.notes ?? null,
      status: 'draft',
    })
    .returning('*');

  await writeAuditLog({
    actorUserId: caller.id,
    entityType: 'ABSENCE',
    entityId: row.id,
    action: 'CREATE',
    newValue: row as unknown as Record<string, unknown>,
    ipAddress,
  });

  const absence: AbsenceWithAttachments = { ...row, attachments: [] };
  return { absence, warning: getWarningMessage(absence.type, 0) };
}

export async function updateAbsence(
  absenceId: number,
  caller: { id: number; role: 'admin' | 'user' },
  version: number,
  input: Partial<AbsenceWriteInput>,
  ipAddress?: string,
): Promise<{ absence: AbsenceWithAttachments; warning?: string }> {
  const existing = await db<AbsenceRow>('absence_entries')
    .where({ id: absenceId, user_id: caller.id })
    .whereNull('deleted_at')
    .first();

  if (!existing) {
    throw new AppError('Absence not found', 404);
  }

  await assertMonthsNotLocked(existing.start_date, existing.end_date);
  await assertWeeksEditable(existing);

  if (existing.version !== version) {
    throw new AppError('CONFLICT', 409, {
      message: 'Absence was modified by someone else. Please reload and try again.',
    });
  }

  const normalized = normalizeAbsenceType(input.type ?? existing.type, input.isPartial ?? existing.is_partial);
  const nextStartDate = input.startDate ?? existing.start_date;
  const nextEndDate = input.endDate ?? existing.end_date;

  if (nextStartDate > nextEndDate) {
    throw new AppError('start_date must be before or equal to end_date', 400);
  }

  await assertMonthsNotLocked(nextStartDate, nextEndDate);
  await assertPartialCoverage(caller.id, nextStartDate, nextEndDate, normalized.isPartial);
  await assertMonthlyQuotaWithinBounds(caller.id, nextStartDate, nextEndDate, normalized.isPartial, absenceId);

  const updatePayload: Record<string, unknown> = {
    version: existing.version + 1,
    type: normalized.type,
    start_date: nextStartDate,
    end_date: nextEndDate,
    is_partial: normalized.isPartial,
  };

  if ('notes' in input) {
    updatePayload.notes = input.notes ?? null;
  }

  const rows = await db<AbsenceRow>('absence_entries')
    .where({ id: absenceId, user_id: caller.id, version })
    .update(updatePayload)
    .returning('*');

  if (rows.length === 0) {
    throw new AppError('CONFLICT', 409, {
      message: 'Absence was modified by someone else. Please reload and try again.',
    });
  }

  const [updated] = rows;
  const attachmentsByAbsenceId = await loadAttachments([updated.id]);
  const absence = withAttachments([updated], attachmentsByAbsenceId)[0];

  await writeAuditLog({
    actorUserId: caller.id,
    entityType: 'ABSENCE',
    entityId: updated.id,
    action: 'UPDATE',
    oldValue: existing as unknown as Record<string, unknown>,
    newValue: updated as unknown as Record<string, unknown>,
    ipAddress,
  });

  return {
    absence,
    warning: getWarningMessage(absence.type, absence.attachments.length),
  };
}

export async function deleteAbsence(
  absenceId: number,
  caller: { id: number; role: 'admin' | 'user' },
  ipAddress?: string,
): Promise<void> {
  const existing = await db<AbsenceRow>('absence_entries')
    .where({ id: absenceId, user_id: caller.id })
    .whereNull('deleted_at')
    .first();

  if (!existing) {
    throw new AppError('Absence not found', 404);
  }

  await assertMonthsNotLocked(existing.start_date, existing.end_date);
  await assertWeeksEditable(existing);

  await db<AbsenceRow>('absence_entries')
    .where({ id: absenceId, user_id: caller.id })
    .update({ deleted_at: db.fn.now() });

  await writeAuditLog({
    actorUserId: caller.id,
    entityType: 'ABSENCE',
    entityId: absenceId,
    action: 'DELETE',
    oldValue: existing as unknown as Record<string, unknown>,
    ipAddress,
  });
}

export async function uploadAbsenceDocument(
  absenceId: number,
  caller: { id: number; role: 'admin' | 'user' },
  file: {
    originalname: string;
    path: string;
    size: number;
    detectedMime?: string;
    mimetype?: string;
  },
  ipAddress?: string,
): Promise<AttachmentRow> {
  const absence = await findAbsenceVisibleToCaller(absenceId, caller);
  if (!absence) {
    throw new AppError('Absence not found', 404);
  }

  const [attachment] = await db<AttachmentRow>('attachments')
    .insert({
      absence_id: absenceId,
      file_name: file.originalname,
      file_path: file.path,
      mime_type: file.detectedMime ?? file.mimetype ?? 'application/octet-stream',
      size_bytes: file.size,
      uploaded_by: caller.id,
    })
    .returning('*');

  await writeAuditLog({
    actorUserId: caller.id,
    entityType: 'ABSENCE',
    entityId: absenceId,
    action: 'UPDATE',
    newValue: {
      document_action: 'upload',
      attachment_id: attachment.id,
      file_name: attachment.file_name,
      mime_type: attachment.mime_type,
      size_bytes: attachment.size_bytes,
    },
    ipAddress,
  });

  return attachment;
}

export async function deleteAbsenceDocument(
  absenceId: number,
  attachmentId: number,
  caller: { id: number; role: 'admin' | 'user' },
  ipAddress?: string,
): Promise<void> {
  const absence = await findAbsenceVisibleToCaller(absenceId, caller);
  if (!absence) {
    throw new AppError('Absence not found', 404);
  }

  const attachment = await db<AttachmentRow>('attachments')
    .where({ id: attachmentId, absence_id: absenceId })
    .first();

  if (!attachment) {
    throw new AppError('Attachment not found', 404);
  }

  await db<AttachmentRow>('attachments')
    .where({ id: attachmentId, absence_id: absenceId })
    .del();

  try {
    await fs.unlink(attachment.file_path);
  } catch (err: unknown) {
    if (!(err instanceof Error) || !('code' in err) || (err as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw err;
    }
  }

  await writeAuditLog({
    actorUserId: caller.id,
    entityType: 'ABSENCE',
    entityId: absenceId,
    action: 'UPDATE',
    oldValue: {
      document_action: 'delete',
      attachment_id: attachment.id,
      file_name: attachment.file_name,
      mime_type: attachment.mime_type,
      size_bytes: attachment.size_bytes,
    },
    ipAddress,
  });
}
