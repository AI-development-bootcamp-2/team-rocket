import { Request, Response } from 'express';
import { AppError } from '../middleware/error.middleware';
import {
  listTimeEntries,
  getTimeEntryById,
  createTimeEntry,
  updateTimeEntry,
  deleteTimeEntry,
  deriveEndTime,
  formatDateOnly,
  getDailySummary,
  timeToMinutes,
  getDropdownData,
  checkQuotaWarning,
} from '../services/time-entries.service';

function serializeTimeEntry<T extends { date: string | Date }>(entry: T): T & { date: string } {
  return {
    ...entry,
    date: formatDateOnly(entry.date),
  };
}

export async function getTimeEntriesHandler(req: Request, res: Response): Promise<void> {
  const caller = req.user!;

  // --- user_id filter ---
  let userId: number | undefined;
  if (req.query.user_id != null && req.query.user_id !== '') {
    const parsed = Number(req.query.user_id);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      throw new AppError('user_id must be a positive integer', 400);
    }
    // Regular users may only query their own entries
    if (caller.role === 'user' && parsed !== caller.id) {
      throw new AppError('Forbidden', 403);
    }
    userId = parsed;
  }

  // --- date filter (YYYY-MM-DD) ---
  let date: string | undefined;
  if (req.query.date != null && req.query.date !== '') {
    const val = String(req.query.date);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(val)) {
      throw new AppError('date must be in YYYY-MM-DD format', 400);
    }
    date = val;
  }

  // --- week filter (YYYY-WNN) ---
  let week: string | undefined;
  if (req.query.week != null && req.query.week !== '') {
    const val = String(req.query.week);
    if (!/^\d{4}-W\d{1,2}$/.test(val)) {
      throw new AppError('week must be in YYYY-WNN format (e.g. 2026-W19)', 400);
    }
    week = val;
  }

  // --- month filter: YYYY-MM string OR year+month integers ---
  let month: string | undefined;
  if (req.query.month != null && req.query.month !== '') {
    const val = String(req.query.month);
    if (/^\d{4}-\d{2}$/.test(val)) {
      month = val;
    } else {
      const monthInt = Number(val);
      if (!Number.isInteger(monthInt) || monthInt < 1 || monthInt > 12) {
        throw new AppError('month must be in YYYY-MM format or an integer between 1 and 12', 400);
      }
      const yearInt = Number(String(req.query.year ?? ''));
      if (!Number.isInteger(yearInt) || yearInt < 1000 || yearInt > 9999) {
        throw new AppError('year must be a 4-digit integer when month is provided as an integer', 400);
      }
      month = `${yearInt}-${String(monthInt).padStart(2, '0')}`;
    }
  }

  const entries = await listTimeEntries({
    role: caller.role,
    callerId: caller.id,
    userId,
    date,
    week,
    month,
  });

  res.json(entries.map(serializeTimeEntry));
}

// ── GET /time-entries/:id ─────────────────────────────────────────────────────

export async function getTimeEntryByIdHandler(req: Request, res: Response): Promise<void> {
  const caller = req.user!;
  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id <= 0) {
    throw new AppError('id must be a positive integer', 400);
  }

  const entry = await getTimeEntryById(id, caller);
  if (!entry) {
    throw new AppError('Time entry not found', 404);
  }

  res.json(serializeTimeEntry(entry));
}

// ── POST /time-entries ────────────────────────────────────────────────────────

const VALID_LOCATIONS = ['office', 'home', 'client'] as const;
const TIME_RE = /^\d{2}:\d{2}(:\d{2})?$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function createTimeEntryHandler(req: Request, res: Response): Promise<void> {
  const caller = req.user!;
  const { date, start_time, client_id, project_id, task_id, location, description } = req.body;
  let { end_time } = req.body;
  const { duration_override_minutes } = req.body;

  // If end_time is absent but duration_override_minutes is provided, derive end_time.
  // If both are present, end_time wins and duration_override_minutes is ignored.
  if ((end_time == null || end_time === '') && duration_override_minutes != null) {
    const overrideNum = Number(duration_override_minutes);
    if (!Number.isInteger(overrideNum) || overrideNum <= 0) {
      throw new AppError('duration_override_minutes must be a positive integer', 400);
    }
    if (start_time == null || start_time === '') {
      throw new AppError('start_time is required when using duration_override_minutes', 400);
    }
    end_time = deriveEndTime(String(start_time), overrideNum);
  }

  // Required fields (end_time now resolved above if override was used)
  const missing = ['date', 'start_time', 'end_time', 'client_id', 'project_id', 'task_id', 'location'].filter(
    (f) => (f === 'end_time' ? end_time == null || end_time === '' : req.body[f] == null || req.body[f] === ''),
  );
  if (missing.length > 0) {
    throw new AppError(`Missing required fields: ${missing.join(', ')}`, 400);
  }

  if (!DATE_RE.test(date)) {
    throw new AppError('date must be in YYYY-MM-DD format', 400);
  }

  if (!TIME_RE.test(start_time) || !TIME_RE.test(end_time)) {
    throw new AppError('start_time and end_time must be in HH:MM or HH:MM:SS format', 400);
  }

  // Cross-midnight is allowed (end < start), but end === start means zero duration.
  if (timeToMinutes(String(end_time)) === timeToMinutes(String(start_time))) {
    throw new AppError('end_time must differ from start_time', 422);
  }

  if (!(VALID_LOCATIONS as readonly string[]).includes(location)) {
    throw new AppError('location must be one of: office, home, client', 400);
  }

  const clientIdNum = Number(client_id);
  const projectIdNum = Number(project_id);
  const taskIdNum = Number(task_id);

  if (!Number.isInteger(clientIdNum) || clientIdNum <= 0) {
    throw new AppError('client_id must be a positive integer', 400);
  }
  if (!Number.isInteger(projectIdNum) || projectIdNum <= 0) {
    throw new AppError('project_id must be a positive integer', 400);
  }
  if (!Number.isInteger(taskIdNum) || taskIdNum <= 0) {
    throw new AppError('task_id must be a positive integer', 400);
  }

  const entry = await createTimeEntry({
    userId: caller.id,
    date,
    startTime: start_time,
    endTime: end_time,
    clientId: clientIdNum,
    projectId: projectIdNum,
    taskId: taskIdNum,
    location: location as 'office' | 'home' | 'client',
    description: description ?? undefined,
  });

  const warning = await checkQuotaWarning(caller.id, date);

  res.status(201).json({ ...serializeTimeEntry(entry), warning });
}

// ── PUT /time-entries/:id ─────────────────────────────────────────────────────

export async function updateTimeEntryHandler(req: Request, res: Response): Promise<void> {
  const caller = req.user!;
  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id <= 0) {
    throw new AppError('id must be a positive integer', 400);
  }

  // version is required for optimistic lock
  if (req.body.version == null) {
    throw new AppError('version is required', 400);
  }
  const version = Number(req.body.version);
  if (!Number.isInteger(version) || version < 0) {
    throw new AppError('version must be a non-negative integer', 400);
  }

  const { start_time, client_id, project_id, task_id, location, description } = req.body;
  let { end_time } = req.body;
  const { duration_override_minutes } = req.body;

  // If end_time is absent but duration_override_minutes is provided, derive end_time.
  // If both are present, end_time wins and duration_override_minutes is ignored.
  if ((end_time == null || end_time === '') && duration_override_minutes != null) {
    const overrideNum = Number(duration_override_minutes);
    if (!Number.isInteger(overrideNum) || overrideNum <= 0) {
      throw new AppError('duration_override_minutes must be a positive integer', 400);
    }
    // start_time for derivation: prefer body value, will fall back to DB value inside service
    if (start_time == null || start_time === '') {
      throw new AppError('start_time is required when using duration_override_minutes on update', 400);
    }
    end_time = deriveEndTime(String(start_time), overrideNum);
  }

  // Validate optional fields if provided
  if (start_time != null && !TIME_RE.test(start_time)) {
    throw new AppError('start_time must be in HH:MM or HH:MM:SS format', 400);
  }
  if (end_time != null && !TIME_RE.test(end_time)) {
    throw new AppError('end_time must be in HH:MM or HH:MM:SS format', 400);
  }

  // When both times are present in this request, reject zero-duration.
  if (start_time != null && end_time != null) {
    if (timeToMinutes(String(end_time)) === timeToMinutes(String(start_time))) {
      throw new AppError('end_time must differ from start_time', 422);
    }
  }

  if (location != null && !(VALID_LOCATIONS as readonly string[]).includes(location)) {
    throw new AppError('location must be one of: office, home, client', 400);
  }
  if (client_id != null && (!Number.isInteger(Number(client_id)) || Number(client_id) <= 0)) {
    throw new AppError('client_id must be a positive integer', 400);
  }
  if (project_id != null && (!Number.isInteger(Number(project_id)) || Number(project_id) <= 0)) {
    throw new AppError('project_id must be a positive integer', 400);
  }
  if (task_id != null && (!Number.isInteger(Number(task_id)) || Number(task_id) <= 0)) {
    throw new AppError('task_id must be a positive integer', 400);
  }

  const updated = await updateTimeEntry(id, caller, version, {
    startTime: start_time ?? undefined,
    endTime: end_time ?? undefined,
    clientId: client_id != null ? Number(client_id) : undefined,
    projectId: project_id != null ? Number(project_id) : undefined,
    taskId: task_id != null ? Number(task_id) : undefined,
    location: location ?? undefined,
    ...('description' in req.body ? { description: description ?? null } : {}),
    modifiedBy: caller.id,
    modifiedByRole: caller.role,
  });

  const warning = await checkQuotaWarning(updated.user_id, formatDateOnly(updated.date));

  res.json({ ...serializeTimeEntry(updated), warning });
}

// ── DELETE /time-entries/:id ──────────────────────────────────────────────────

export async function deleteTimeEntryHandler(req: Request, res: Response): Promise<void> {
  const caller = req.user!;
  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id <= 0) {
    throw new AppError('id must be a positive integer', 400);
  }

  await deleteTimeEntry(id, caller);

  res.status(204).send();
}

// ── GET /time-entries/dropdown-data ─────────────────────────────────────────

export async function getDropdownDataHandler(req: Request, res: Response): Promise<void> {
  const caller = req.user!;
  if (caller.role !== 'user') {
    throw new AppError('Forbidden', 403);
  }
  const data = await getDropdownData(caller.id);
  res.json(data);
}

// ── GET /time-entries/daily-summary?date=&user_id= ────────────────────────────

export async function getDailySummaryHandler(req: Request, res: Response): Promise<void> {
  const caller = req.user!;

  const dateParam = req.query.date;
  if (dateParam == null || dateParam === '') {
    throw new AppError('date query parameter is required', 400);
  }
  const date = String(dateParam);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new AppError('date must be in YYYY-MM-DD format', 400);
  }

  let userId: number | undefined;
  if (req.query.user_id != null && req.query.user_id !== '') {
    const parsed = Number(req.query.user_id);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      throw new AppError('user_id must be a positive integer', 400);
    }
    userId = parsed;
  }

  const summary = await getDailySummary(date, caller, userId);
  res.json(summary);
}
