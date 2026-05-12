import type { Knex } from 'knex';
import { writeAuditLog } from './auth.service';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const db = require('../database/connection') as Knex;

export interface TimeEntryRow {
  id: number;
  user_id: number;
  date: string;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  client_id: number;
  project_id: number;
  task_id: number;
  location: 'office' | 'home' | 'client';
  description: string | null;
  status: 'draft' | 'submitted' | 'approved' | 'rejected';
  version: number;
  last_modified_by: number | null;
  last_modified_by_role: string | null;
  rejection_reason: string | null;
  approved_by: number | null;
  approved_at: Date | null;
  deleted_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface ListTimeEntriesFilters {
  role: 'admin' | 'user';
  callerId: number;
  /** Filter to a specific user (admin only — regular users are always scoped to themselves) */
  userId?: number;
  /** Filter to an exact date (YYYY-MM-DD) */
  date?: string;
  /** Filter to an ISO week (YYYY-WNN, e.g. "2026-W19") */
  week?: string;
  /** Filter to a month (YYYY-MM, e.g. "2026-05") */
  month?: string;
}

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

function getLocalDateParts(value: string | Date): { year: number; month: number; day: number } {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-').map(Number);
    return { year, month, day };
  }

  const date = value instanceof Date ? value : new Date(value);
  return {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
  };
}

export function formatDateOnly(value: string | Date): string {
  const { year, month, day } = getLocalDateParts(value);
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

function getWeekStartDate(value: string | Date): string {
  const { year, month, day } = getLocalDateParts(value);
  const date = new Date(Date.UTC(year, month - 1, day));
  const dayOfWeek = date.getUTCDay(); // 0=Sun
  const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

  date.setUTCDate(date.getUTCDate() + daysToMonday);
  return date.toISOString().slice(0, 10);
}

export async function listTimeEntries(
  filters: ListTimeEntriesFilters,
): Promise<TimeEntryRow[]> {
  const query = db<TimeEntryRow>('time_entries')
    .whereNull('deleted_at')
    .orderBy('date', 'asc')
    .orderBy('start_time', 'asc');

  // Scope to user — admins may query any user, regular users only see their own
  if (filters.role === 'admin') {
    if (filters.userId != null) {
      query.where('user_id', filters.userId);
    }
  } else {
    query.where('user_id', filters.callerId);
  }

  // Date filter
  if (filters.date != null) {
    query.where('date', filters.date);
  }

  // Week filter — ISO 8601 format "YYYY-WNN"
  if (filters.week != null) {
    const match = /^(\d{4})-W(\d{1,2})$/.exec(filters.week);
    if (match) {
      const isoYear = Number(match[1]);
      const isoWeek = Number(match[2]);
      query.whereRaw(
        'EXTRACT(ISOYEAR FROM date) = ? AND EXTRACT(WEEK FROM date) = ?',
        [isoYear, isoWeek],
      );
    }
  }

  // Month filter — "YYYY-MM"
  if (filters.month != null) {
    const match = /^(\d{4})-(\d{2})$/.exec(filters.month);
    if (match) {
      const year = Number(match[1]);
      const month = Number(match[2]);
      query.whereRaw(
        'EXTRACT(YEAR FROM date) = ? AND EXTRACT(MONTH FROM date) = ?',
        [year, month],
      );
    }
  }

  return query.select('*');
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Parse "HH:MM" or "HH:MM:SS" into total minutes from midnight. */
export function timeToMinutes(time: string): number {
  const parts = time.split(':').map(Number);
  return parts[0] * 60 + parts[1];
}

/** Duration in minutes; handles cross-midnight (end < start adds 24h). */
export function calculateDurationMinutes(startTime: string, endTime: string): number {
  const start = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);
  return end > start ? end - start : 24 * 60 - start + end;
}

/**
 * Derives end_time by adding overrideMinutes to startTime.
 * Result wraps around midnight (e.g. 23:00 + 120 min → "01:00").
 */
export function deriveEndTime(startTime: string, overrideMinutes: number): string {
  const totalMinutes = (timeToMinutes(startTime) + overrideMinutes) % (24 * 60);
  const hours = Math.floor(totalMinutes / 60);
  const mins  = totalMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

function normalizedInterval(startTime: string, endTime: string): [number, number] {
  const start = timeToMinutes(startTime);
  let end = timeToMinutes(endTime);

  if (end <= start) {
    end += 24 * 60;
  }

  return [start, end];
}

function intervalVariants([start, end]: [number, number]): Array<[number, number]> {
  return [
    [start - 24 * 60, end - 24 * 60],
    [start, end],
    [start + 24 * 60, end + 24 * 60],
  ];
}

function intervalsOverlap(a: [number, number], b: [number, number]): boolean {
  return a[0] < b[1] && b[0] < a[1];
}

// ── Overlap detection ─────────────────────────────────────────────────────────

/**
 * Returns true if [newStart, newEnd) overlaps any existing entry for the same
 * user+date (across all projects). Adjacent entries (e.g. 12:00–15:00 and
 * 15:00–18:00) are allowed — strict inequality is used.
 *
 * Cross-midnight entries: if newEnd <= newStart the new entry spans midnight.
 * The overlap check is done in pure-minutes space using the same convention
 * as calculateDurationMinutes.
 *
 * @param excludeId  Exclude this entry ID from the check (used on PUT so the
 *                   entry doesn't overlap with itself).
 */
export async function hasOverlap(params: {
  userId: number;
  date: string;
  startTime: string;
  endTime: string;
  excludeId?: number;
}): Promise<boolean> {
  const newInterval = normalizedInterval(params.startTime, params.endTime);

  // Fetch all non-deleted entries for the same user+date (excluding self on update)
  const query = db<TimeEntryRow>('time_entries')
    .where({ user_id: params.userId, date: params.date })
    .whereNull('deleted_at')
    .select('start_time', 'end_time');

  if (params.excludeId != null) {
    query.whereNot('id', params.excludeId);
  }

  const existing = await query as { start_time: string; end_time: string }[];

  for (const e of existing) {
    const existingInterval = normalizedInterval(e.start_time, e.end_time);

    if (
      intervalVariants(newInterval).some((candidate) =>
        intervalVariants(existingInterval).some((existingCandidate) =>
          intervalsOverlap(candidate, existingCandidate),
        ))
    ) {
      return true;
    }
  }

  return false;
}

// ── GET by id ─────────────────────────────────────────────────────────────────

export async function getTimeEntryById(
  id: number,
  caller: { id: number; role: 'admin' | 'user' },
): Promise<TimeEntryRow | null> {
  const query = db<TimeEntryRow>('time_entries')
    .where('id', id)
    .whereNull('deleted_at');

  // Regular users may only access their own entries
  if (caller.role !== 'admin') {
    query.where('user_id', caller.id);
  }

  const row = await query.first();
  return row ?? null;
}

// ── POST (create) ─────────────────────────────────────────────────────────────

export interface CreateTimeEntryParams {
  userId: number;
  date: string;
  startTime: string;
  endTime: string;
  clientId: number;
  projectId: number;
  taskId: number;
  location: 'office' | 'home' | 'client';
  description?: string;
}

// ── Business-rule validation ───────────────────────────────────────────────────

/**
 * Validates the business rules that apply whenever a time entry is created or
 * updated with a new task / project / client. Throws AppError on any violation.
 *
 * Rules:
 *  1. date must not be in the future
 *  2. client must exist and be active
 *  3. project must exist, be active, and belong to the client
 *  4. task must exist and belong to the project
 *  5. task.status must be 'open' → 422 { error: 'Task is closed' }
 *  6. user must have an active assignment for the task
 */
export async function validateTimeEntryInputs(params: {
  userId: number;
  date: string;
  clientId: number;
  projectId: number;
  taskId: number;
}): Promise<void> {
  const { AppError } = await import('../middleware/error.middleware');

  // 1. No future dates
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const entryDate = new Date(params.date);
  entryDate.setHours(0, 0, 0, 0);
  if (entryDate > today) {
    throw new AppError('Date cannot be in the future', 422);
  }

  // 2. Client active
  const client = await db('clients')
    .where('id', params.clientId)
    .select('id', 'is_active')
    .first() as { id: number; is_active: boolean } | undefined;
  if (!client) {
    throw new AppError('Client not found', 422);
  }
  if (!client.is_active) {
    throw new AppError('Client is not active', 422);
  }

  // 3. Project active and belongs to client
  const project = await db('projects')
    .where('id', params.projectId)
    .select('id', 'client_id', 'is_active')
    .first() as { id: number; client_id: number; is_active: boolean } | undefined;
  if (!project) {
    throw new AppError('Project not found', 422);
  }
  if (!project.is_active) {
    throw new AppError('Project is not active', 422);
  }
  if (project.client_id !== params.clientId) {
    throw new AppError('Project does not belong to the specified client', 422);
  }

  // 4 & 5. Task belongs to project and is open
  const task = await db('tasks')
    .where('id', params.taskId)
    .select('id', 'project_id', 'status')
    .first() as { id: number; project_id: number; status: string } | undefined;
  if (!task) {
    throw new AppError('Task not found', 422);
  }
  if (task.project_id !== params.projectId) {
    throw new AppError('Task does not belong to the specified project', 422);
  }
  if (task.status !== 'open') {
    throw new AppError('Task is closed', 422);
  }

  // 6. User has an active assignment for this task
  const assignment = await db('user_task_assignments')
    .where({ user_id: params.userId, task_id: params.taskId, is_active: true })
    .select('id')
    .first() as { id: number } | undefined;
  if (!assignment) {
    throw new AppError('User is not assigned to this task', 422);
  }
}

export async function createTimeEntry(
  params: CreateTimeEntryParams,
): Promise<TimeEntryRow> {
  const { AppError } = await import('../middleware/error.middleware');

  // Month lock guard
  const { year, month } = getLocalDateParts(params.date);
  const lock = await db('month_locks')
    .where({ year, month, is_locked: true })
    .first() as { id: number } | undefined;
  if (lock) {
    throw new AppError('Month is locked', 423);
  }

  // Business-rule validations
  await validateTimeEntryInputs({
    userId: params.userId,
    date: params.date,
    clientId: params.clientId,
    projectId: params.projectId,
    taskId: params.taskId,
  });

  // Overlap check
  const overlaps = await hasOverlap({
    userId: params.userId,
    date: params.date,
    startTime: params.startTime,
    endTime: params.endTime,
  });
  if (overlaps) {
    throw new AppError('Time entry overlaps with an existing entry for this day', 409);
  }

  const durationMinutes = calculateDurationMinutes(params.startTime, params.endTime);

  const [row] = await db<TimeEntryRow>('time_entries')
    .insert({
      user_id: params.userId,
      date: params.date,
      start_time: params.startTime,
      end_time: params.endTime,
      duration_minutes: durationMinutes,
      client_id: params.clientId,
      project_id: params.projectId,
      task_id: params.taskId,
      location: params.location,
      description: params.description ?? null,
    })
    .returning('*');

  writeAuditLog({
    actorUserId: params.userId,
    entityType: 'TIME_ENTRY',
    entityId: row.id,
    action: 'CREATE',
    newValue: row as unknown as Record<string, unknown>,
  }).catch((err: unknown) => console.error('[audit] time entry create:', err));

  return row;
}

// ── PUT (update) ──────────────────────────────────────────────────────────────

export interface UpdateTimeEntryParams {
  startTime?: string;
  endTime?: string;
  clientId?: number;
  projectId?: number;
  taskId?: number;
  location?: 'office' | 'home' | 'client';
  description?: string | null;
  /** Caller info — used to set last_modified_by / last_modified_by_role */
  modifiedBy: number;
  modifiedByRole: 'admin' | 'user';
}

/**
 * Updates a time entry.
 *
 * Guards enforced (in order):
 *  1. Entry exists and is visible to caller (not soft-deleted, ownership for users)
 *  2. status must be 'draft' or 'rejected'
 *  3. Month must not be locked
 *  4. Week submission status must be 'draft' or 'rejected' (or no submission row)
 *  5. Optimistic lock: body.version must match DB version → else 409
 *
 * Side effects on success:
 *  - version incremented by 1
 *  - if entry was 'rejected' → status reset to 'draft', rejection_reason cleared
 *  - last_modified_by / last_modified_by_role stamped
 */
export async function updateTimeEntry(
  id: number,
  caller: { id: number; role: 'admin' | 'user' },
  bodyVersion: number,
  params: UpdateTimeEntryParams,
): Promise<TimeEntryRow> {
  // 1. Fetch the entry (admins can edit any; users only their own)
  const entryQuery = db<TimeEntryRow>('time_entries')
    .where('id', id)
    .whereNull('deleted_at');
  if (caller.role !== 'admin') {
    entryQuery.where('user_id', caller.id);
  }
  const entry = await entryQuery.first() as TimeEntryRow | undefined;
  if (!entry) {
    const { AppError } = await import('../middleware/error.middleware');
    throw new AppError('Time entry not found', 404);
  }

  const { AppError } = await import('../middleware/error.middleware');

  // 2. Status guard
  if (entry.status !== 'draft' && entry.status !== 'rejected') {
    throw new AppError('Entry cannot be edited in its current status', 422);
  }

  // 3. Month lock guard
  const { year, month } = getLocalDateParts(entry.date);
  const lock = await db('month_locks')
    .where({ year, month, is_locked: true })
    .first() as { id: number } | undefined;
  if (lock) {
    throw new AppError('Month is locked', 423);
  }

  // 4. Weekly submission guard — week_start_date is the Monday of the entry's week
  const weekStartStr = getWeekStartDate(entry.date);

  const weekSub = await db('weekly_submissions')
    .where({ user_id: entry.user_id, week_start_date: weekStartStr })
    .select('status')
    .first() as { status: string } | undefined;

  if (weekSub && weekSub.status !== 'draft' && weekSub.status !== 'rejected') {
    throw new AppError('Week has already been submitted', 422);
  }

  // 5. Optimistic lock
  if (entry.version !== bodyVersion) {
    throw new AppError('CONFLICT', 409, {
      message: 'Entry was modified by someone else. Please reload and try again.',
    });
  }

  // 6. Business-rule validations (only when relevant fields change)
  const effectiveClientId  = params.clientId  ?? entry.client_id;
  const effectiveProjectId = params.projectId ?? entry.project_id;
  const effectiveTaskId    = params.taskId    ?? entry.task_id;
  if (
    params.clientId  != null ||
    params.projectId != null ||
    params.taskId    != null
  ) {
    await validateTimeEntryInputs({
      userId: entry.user_id,
      date: entry.date,
      clientId: effectiveClientId,
      projectId: effectiveProjectId,
      taskId: effectiveTaskId,
    });
  }

  // Build update payload
  const wasRejected = entry.status === 'rejected';
  const updatePayload: Record<string, unknown> = {
    version: entry.version + 1,
    last_modified_by: params.modifiedBy,
    last_modified_by_role: params.modifiedByRole,
  };

  if (wasRejected) {
    updatePayload.status = 'draft';
    updatePayload.rejection_reason = null;
  }

  if (params.startTime != null) updatePayload.start_time = params.startTime;
  if (params.endTime != null) updatePayload.end_time = params.endTime;
  if (params.clientId != null) updatePayload.client_id = params.clientId;
  if (params.projectId != null) updatePayload.project_id = params.projectId;
  if (params.taskId != null) updatePayload.task_id = params.taskId;
  if (params.location != null) updatePayload.location = params.location;
  if ('description' in params) updatePayload.description = params.description;

  // Recalculate duration if times changed
  const newStart = (params.startTime ?? entry.start_time) as string;
  const newEnd = (params.endTime ?? entry.end_time) as string;

  // Overlap check (exclude this entry from its own overlap test)
  const overlaps = await hasOverlap({
    userId: entry.user_id,
    date: entry.date,
    startTime: newStart,
    endTime: newEnd,
    excludeId: id,
  });
  if (overlaps) {
    throw new AppError('Time entry overlaps with an existing entry for this day', 409);
  }

  updatePayload.duration_minutes = calculateDurationMinutes(newStart, newEnd);

  // Atomic optimistic-lock: include WHERE version = bodyVersion so a concurrent
  // writer that already incremented the version causes 0 rows returned → 409.
  const rows = await db<TimeEntryRow>('time_entries')
    .where('id', id)
    .where('version', bodyVersion)
    .update(updatePayload)
    .returning('*');

  if (rows.length === 0) {
    throw new AppError('CONFLICT', 409, {
      message: 'Entry was modified by someone else. Please reload and try again.',
    });
  }
  const [updated] = rows;

  const auditAction =
    caller.role === 'admin'
      ? ('ADMIN_EDIT' as const)
      : wasRejected
        ? ('ENTRY_CORRECTED' as const)
        : ('UPDATE' as const);

  writeAuditLog({
    actorUserId: caller.id,
    entityType: 'TIME_ENTRY',
    entityId: id,
    action: auditAction,
    oldValue: entry as unknown as Record<string, unknown>,
    newValue: updated as unknown as Record<string, unknown>,
  }).catch((err: unknown) => console.error('[audit] time entry update:', err));

  return updated;
}

// ── DELETE (soft delete) ──────────────────────────────────────────────────────

/**
 * Soft-deletes a time entry by setting deleted_at = NOW().
 *
 * Guards:
 *  1. Entry exists and is visible to caller
 *  2. status must be 'draft' or 'rejected'
 *  3. Month must not be locked
 */
export async function deleteTimeEntry(
  id: number,
  caller: { id: number; role: 'admin' | 'user' },
): Promise<void> {
  const { AppError } = await import('../middleware/error.middleware');

  // 1. Fetch entry
  const entryQuery = db<TimeEntryRow>('time_entries')
    .where('id', id)
    .whereNull('deleted_at');
  if (caller.role !== 'admin') {
    entryQuery.where('user_id', caller.id);
  }
  const entry = await entryQuery.first() as TimeEntryRow | undefined;
  if (!entry) {
    throw new AppError('Time entry not found', 404);
  }

  // 2. Status guard
  if (entry.status !== 'draft' && entry.status !== 'rejected') {
    throw new AppError('Entry cannot be deleted in its current status', 422);
  }

  // 3. Month lock guard
  const { year, month } = getLocalDateParts(entry.date);
  const lock = await db('month_locks')
    .where({ year, month, is_locked: true })
    .first() as { id: number } | undefined;
  if (lock) {
    throw new AppError('Month is locked', 423);
  }

  await db('time_entries')
    .where('id', id)
    .update({ deleted_at: db.fn.now() });

  writeAuditLog({
    actorUserId: caller.id,
    entityType: 'TIME_ENTRY',
    entityId: id,
    action: 'DELETE',
    oldValue: entry as unknown as Record<string, unknown>,
  }).catch((err: unknown) => console.error('[audit] time entry delete:', err));
}

// ── Dropdown data ─────────────────────────────────────────────────────────────

export interface DropdownTask {
  id: number;
  name: string;
}

export interface DropdownProject {
  id: number;
  name: string;
  tasks: DropdownTask[];
}

export interface DropdownClient {
  id: number;
  name: string;
  projects: DropdownProject[];
}

export interface DropdownData {
  clients: DropdownClient[];
  sort_prefs: Record<string, unknown> | null;
}

function toFrequencyMap(raw: unknown): Map<number, number> {
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) {
    return new Map();
  }

  const freq = new Map<number, number>();
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const id = Number(key);
    const count = Number(value);
    if (Number.isInteger(id) && id > 0 && Number.isFinite(count) && count > 0) {
      freq.set(id, count);
    }
  }
  return freq;
}

/**
 * Returns the cascading client→project→task tree for the user's active
 * assignments, sorted by the user's stored sort_prefs frequency maps
 * (most-used first), then alphabetically as a tiebreaker.
 */
export async function getDropdownData(userId: number): Promise<DropdownData> {
  const { AppError } = await import('../middleware/error.middleware');

  const user = await db('users')
    .where('id', userId)
    .select('sort_prefs')
    .first() as { sort_prefs: Record<string, unknown> | null } | undefined;
  if (!user) {
    throw new AppError('User not found', 404);
  }

  const sortPrefs = user.sort_prefs ?? null;
  const prefs = (sortPrefs != null && typeof sortPrefs === 'object' && !Array.isArray(sortPrefs))
    ? sortPrefs as Record<string, unknown>
    : {};
  const clientFreq = toFrequencyMap(prefs.client_id);
  const projectFreq = toFrequencyMap(prefs.project_id);
  const taskFreq = toFrequencyMap(prefs.task_id);

  // All active assignments with the joined names we need
  const assignments = await db('user_task_assignments as uta')
    .join('tasks as t', 'uta.task_id', 't.id')
    .join('projects as p', 't.project_id', 'p.id')
    .join('clients as c', 'p.client_id', 'c.id')
    .where('uta.user_id', userId)
    .where('uta.is_active', true)
    .where('t.status', 'open')
    .where('p.is_active', true)
    .where('c.is_active', true)
    .select(
      'c.id as client_id',
      'c.name as client_name',
      'p.id as project_id',
      'p.name as project_name',
      't.id as task_id',
      't.name as task_name',
    ) as Array<{
      client_id: number;
      client_name: string;
      project_id: number;
      project_name: string;
      task_id: number;
      task_name: string;
    }>;

  // Build a Map-based tree to de-duplicate rows
  type TaskMap    = Map<number, { id: number; name: string }>;
  type ProjectMap = Map<number, { id: number; name: string; tasks: TaskMap }>;
  type ClientMap  = Map<number, { id: number; name: string; projects: ProjectMap }>;

  const clientMap: ClientMap = new Map();
  for (const row of assignments) {
    if (!clientMap.has(row.client_id)) {
      clientMap.set(row.client_id, { id: row.client_id, name: row.client_name, projects: new Map() });
    }
    const clientEntry = clientMap.get(row.client_id)!;
    if (!clientEntry.projects.has(row.project_id)) {
      clientEntry.projects.set(row.project_id, {
        id: row.project_id,
        name: row.project_name,
        tasks: new Map(),
      });
    }
    clientEntry.projects.get(row.project_id)!.tasks.set(row.task_id, {
      id: row.task_id,
      name: row.task_name,
    });
  }

  const byFreqThenName = <T extends { id: number; name: string }>(
    items: T[],
    freqMap: Map<number, number>,
  ): T[] =>
    items.sort(
      (a, b) =>
        (freqMap.get(b.id) ?? 0) - (freqMap.get(a.id) ?? 0) ||
        a.name.localeCompare(b.name),
    );

  const clients: DropdownClient[] = byFreqThenName(
    [...clientMap.values()],
    clientFreq,
  ).map((c) => ({
    id: c.id,
    name: c.name,
    projects: byFreqThenName([...c.projects.values()], projectFreq).map((p) => ({
      id: p.id,
      name: p.name,
      tasks: byFreqThenName([...p.tasks.values()], taskFreq),
    })),
  }));

  return { clients, sort_prefs: sortPrefs };
}

// ── Quota warning ──────────────────────────────────────────────────────────────

/**
 * Returns true if the user has reached ≥90 % of their monthly hours quota.
 * As a side-effect, creates a QUOTA_WARNING notification the first time the
 * threshold is crossed for a given month.
 *
 * Never throws — runs as fire-and-forget so failures are only logged.
 */
export async function checkQuotaWarning(userId: number, date: string): Promise<boolean> {
  try {
    const { year, month } = getLocalDateParts(date);

    const user = await db('users')
      .where('id', userId)
      .select('daily_hours_override', 'employment_percentage')
      .first() as
      | { daily_hours_override: number | null; employment_percentage: number }
      | undefined;
    if (!user) return false;

    // Working days in the month: Israel work week = Sun(0)–Thu(4); Fri(5)+Sat(6) off
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    let workingDays = 0;
    for (let d = 1; d <= daysInMonth; d++) {
      const dow = new Date(Date.UTC(year, month - 1, d)).getUTCDay();
      if (dow !== 5 && dow !== 6) workingDays++;
    }

    const dailyHours = user.daily_hours_override ?? 9;
    const monthlyQuotaHours = dailyHours * workingDays * (user.employment_percentage / 100);
    if (monthlyQuotaHours <= 0) return false;

    // Sum logged hours for the month
    const [{ total }] = await db('time_entries')
      .where('user_id', userId)
      .whereNull('deleted_at')
      .whereRaw('EXTRACT(YEAR FROM date) = ? AND EXTRACT(MONTH FROM date) = ?', [year, month])
      .sum('duration_minutes as total') as [{ total: string | null }];

    const totalHours = Number(total ?? 0) / 60;
    if (totalHours / monthlyQuotaHours < 0.9) return false;

    // Atomic deduplication via the partial unique index on
    // (user_id, related_entity_type, related_entity_id) WHERE type='QUOTA_WARNING'.
    // Concurrent callers that both cross the threshold at the same time will both
    // attempt the INSERT; only one wins and the other is silently discarded.
    const monthKey = year * 100 + month;
    await db.raw(
      `INSERT INTO notifications (user_id, type, title, body, related_entity_type, related_entity_id)
       VALUES (?, 'QUOTA_WARNING', ?, ?, 'MONTH', ?)
       ON CONFLICT DO NOTHING`,
      [
        userId,
        'אזהרת מכסת שעות',
        `הגעת ל-90% ממכסת שעות החודש (${pad2(month)}/${year})`,
        monthKey,
      ],
    );

    return true;
  } catch (err) {
    console.error('[quota-warning]', err);
    return false;
  }
}

// ── Daily summary ──────────────────────────────────────────────────────────────

const DAILY_STANDARD_MINUTES = 9 * 60; // 9 hours default

export interface DailySummary {
  date: string;
  total_hours: number;
  standard_hours: number;
  remaining_hours: number;
  entry_count: number;
  status: 'full' | 'partial' | 'missing' | 'day_off';
}

export async function getDailySummary(
  date: string,
  caller: { id: number; role: string },
  userId?: number,
): Promise<DailySummary> {
  const { AppError } = await import('../middleware/error.middleware');

  // Determine target user (admins may specify any user, regular users only themselves)
  const targetUserId = userId ?? caller.id;
  if (caller.role !== 'admin' && targetUserId !== caller.id) {
    throw new AppError('Forbidden', 403);
  }

  // Fetch user for daily_hours_override
  const user = await db('users').where('id', targetUserId).first() as
    | { daily_hours_override: number | null }
    | undefined;
  if (!user) {
    throw new AppError('User not found', 404);
  }

  // Determine standard minutes from user override or default
  let standardMinutes = user.daily_hours_override != null
    ? user.daily_hours_override * 60
    : DAILY_STANDARD_MINUTES;

  // Check if it's a weekend (Israel: Friday=5, Saturday=6)
  const jsDate = new Date(date);
  const dayOfWeek = jsDate.getUTCDay(); // 0=Sun…6=Sat
  const isWeekend = dayOfWeek === 5 || dayOfWeek === 6; // Fri or Sat

  // Check holiday calendar
  const holiday = await db('holiday_calendar').where('date', date).first() as
    | { type: 'national' | 'company' | 'partial_day' }
    | undefined;

  if (isWeekend || holiday?.type === 'national' || holiday?.type === 'company') {
    standardMinutes = 0;
  } else if (holiday?.type === 'partial_day') {
    standardMinutes = Math.floor(standardMinutes / 2);
  }

  // Sum entries for the target user on this date (non-deleted only)
  const rows = await db('time_entries')
    .where({ user_id: targetUserId, date })
    .whereNull('deleted_at')
    .select('duration_minutes') as Array<{ duration_minutes: number }>;

  const totalMinutes = rows.reduce((sum, r) => sum + (r.duration_minutes ?? 0), 0);
  const entryCount = rows.length;

  const totalHours = Math.round((totalMinutes / 60) * 100) / 100;
  const standardHours = Math.round((standardMinutes / 60) * 100) / 100;
  const remainingHours = Math.max(0, Math.round(((standardMinutes - totalMinutes) / 60) * 100) / 100);

  let status: DailySummary['status'];
  if (standardMinutes === 0) {
    status = 'day_off';
  } else if (totalMinutes === 0) {
    status = 'missing';
  } else if (totalMinutes < standardMinutes) {
    status = 'partial';
  } else {
    status = 'full';
  }

  return { date, total_hours: totalHours, standard_hours: standardHours, remaining_hours: remainingHours, entry_count: entryCount, status };
}
