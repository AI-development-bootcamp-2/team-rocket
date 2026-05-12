import { Request, Response } from 'express';
import { AppError } from '../middleware/error.middleware';
import type { AuthenticatedUser } from '../middleware/auth.middleware';
import {
  createAbsence,
  deleteAbsence,
  deleteAbsenceDocument,
  listAbsences,
  serializeAbsence,
  updateAbsence,
  uploadAbsenceDocument,
  type AbsenceRow,
} from '../services/absences.service';

function getAuthUser(req: Request): AuthenticatedUser {
  if (!req.user) {
    throw new AppError('Authentication required', 401);
  }
  return req.user;
}

function extractIp(req: Request): string {
  return req.ip ?? '';
}

function parsePositiveInt(value: string, fieldName: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new AppError(`${fieldName} must be a positive integer`, 400);
  }
  return parsed;
}

function parseNonNegativeInt(value: unknown, fieldName: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new AppError(`${fieldName} must be a non-negative integer`, 400);
  }
  return parsed;
}

function parseDateOnly(value: unknown, fieldName: string): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new AppError(`${fieldName} must be in YYYY-MM-DD format`, 400);
  }
  return value;
}

function parseType(value: unknown): AbsenceRow['type'] {
  if (value !== 'sick' && value !== 'vacation_full' && value !== 'vacation_half' && value !== 'reserve') {
    throw new AppError('type must be one of: sick, vacation_full, vacation_half, reserve', 400);
  }
  return value;
}

function parseOptionalBoolean(value: unknown, fieldName: string): boolean | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'boolean') {
    throw new AppError(`${fieldName} must be a boolean`, 400);
  }
  return value;
}

function parseOptionalString(value: unknown, fieldName: string): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== 'string') {
    throw new AppError(`${fieldName} must be a string`, 400);
  }
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

export async function getAbsencesHandler(req: Request, res: Response): Promise<void> {
  const caller = getAuthUser(req);

  let userId: number | undefined;
  if (req.query.user_id != null && req.query.user_id !== '') {
    userId = parsePositiveInt(String(req.query.user_id), 'user_id');
    if (caller.role !== 'admin' && userId !== caller.id) {
      throw new AppError('Forbidden', 403);
    }
  }

  const month = req.query.month != null && req.query.month !== ''
    ? String(req.query.month)
    : undefined;
  if (month != null && !/^\d{4}-\d{2}$/.test(month)) {
    throw new AppError('month must be in YYYY-MM format', 400);
  }

  const dateFrom = req.query.date_from != null && req.query.date_from !== ''
    ? parseDateOnly(String(req.query.date_from), 'date_from')
    : undefined;
  const dateTo = req.query.date_to != null && req.query.date_to !== ''
    ? parseDateOnly(String(req.query.date_to), 'date_to')
    : undefined;

  if (dateFrom != null && dateTo != null && dateFrom > dateTo) {
    throw new AppError('date_from must be before or equal to date_to', 400);
  }

  const type = req.query.type != null && req.query.type !== ''
    ? parseType(String(req.query.type))
    : undefined;

  const rows = await listAbsences({ caller, userId, month, dateFrom, dateTo, type });
  res.json(rows.map(serializeAbsence));
}

export async function createAbsenceHandler(req: Request, res: Response): Promise<void> {
  const caller = getAuthUser(req);
  const body = req.body as Record<string, unknown>;

  const type = parseType(body.type);
  const startDate = parseDateOnly(body.start_date, 'start_date');
  const endDate = parseDateOnly(body.end_date, 'end_date');
  if (startDate > endDate) {
    throw new AppError('start_date must be before or equal to end_date', 400);
  }

  const result = await createAbsence(
    caller,
    {
      type,
      startDate,
      endDate,
      isPartial: parseOptionalBoolean(body.is_partial, 'is_partial') ?? false,
      notes: parseOptionalString(body.notes, 'notes'),
    },
    extractIp(req),
  );

  const serialized = serializeAbsence(result.absence);
  if (result.warning) {
    res.status(201).json({ data: serialized, warning: result.warning });
    return;
  }
  res.status(201).json(serialized);
}

export async function updateAbsenceHandler(req: Request, res: Response): Promise<void> {
  const caller = getAuthUser(req);
  const absenceId = parsePositiveInt(req.params.id, 'id');
  const body = req.body as Record<string, unknown>;

  if (body.version == null) {
    throw new AppError('version is required', 400);
  }
  const version = parseNonNegativeInt(body.version, 'version');

  const result = await updateAbsence(
    absenceId,
    caller,
    version,
    {
      ...(body.type !== undefined ? { type: parseType(body.type) } : {}),
      ...(body.start_date !== undefined ? { startDate: parseDateOnly(body.start_date, 'start_date') } : {}),
      ...(body.end_date !== undefined ? { endDate: parseDateOnly(body.end_date, 'end_date') } : {}),
      ...(body.is_partial !== undefined ? { isPartial: parseOptionalBoolean(body.is_partial, 'is_partial') } : {}),
      ...(body.notes !== undefined ? { notes: parseOptionalString(body.notes, 'notes') } : {}),
    },
    extractIp(req),
  );

  const serialized = serializeAbsence(result.absence);
  if (result.warning) {
    res.json({ data: serialized, warning: result.warning });
    return;
  }
  res.json(serialized);
}

export async function deleteAbsenceHandler(req: Request, res: Response): Promise<void> {
  const caller = getAuthUser(req);
  const absenceId = parsePositiveInt(req.params.id, 'id');
  await deleteAbsence(absenceId, caller, extractIp(req));
  res.status(204).send();
}

export async function uploadAbsenceDocumentHandler(req: Request, res: Response): Promise<void> {
  const caller = getAuthUser(req);
  const absenceId = parsePositiveInt(req.params.id, 'id');
  const file = (req as Request & {
    file?: {
      originalname: string;
      path: string;
      size: number;
      detectedMime?: string;
      mimetype?: string;
    };
  }).file;

  if (!file) {
    throw new AppError('file is required', 400);
  }

  const attachment = await uploadAbsenceDocument(absenceId, caller, file, extractIp(req));
  res.status(201).json({
    id: attachment.id,
    file_name: attachment.file_name,
    mime_type: attachment.mime_type,
    size_bytes: attachment.size_bytes,
    created_at: attachment.created_at,
  });
}

export async function deleteAbsenceDocumentHandler(req: Request, res: Response): Promise<void> {
  const caller = getAuthUser(req);
  const absenceId = parsePositiveInt(req.params.id, 'id');
  const attachmentId = parsePositiveInt(req.params.docId, 'docId');
  await deleteAbsenceDocument(absenceId, attachmentId, caller, extractIp(req));
  res.status(204).send();
}
