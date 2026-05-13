import { Request, Response } from 'express';
import { AppError } from '../middleware/error.middleware';
import { listAuditLogs, type ListAuditLogsFilters } from '../services/audit-logs.service';
import type { AuditEntityType, AuditAction } from '../services/auth.service';

// ── Valid enum values (must match migration 011 exactly) ──────────────────────

const VALID_ENTITY_TYPES = new Set<AuditEntityType>([
  'USER', 'CLIENT', 'PROJECT', 'TASK', 'ASSIGNMENT',
  'TIME_ENTRY', 'ABSENCE', 'WEEKLY_SUBMISSION',
  'MONTH_LOCK', 'SETTING', 'HOLIDAY', 'TIMER',
]);

const VALID_ACTIONS = new Set<AuditAction>([
  'LOGIN', 'CREATE', 'UPDATE', 'DELETE', 'SUBMIT',
  'APPROVE', 'REJECT', 'LOCK', 'UNLOCK', 'ADMIN_EDIT',
  'WEEK_RESUBMITTED', 'EXPORT', 'PASSWORD_RESET',
  'DEACTIVATE', 'ENTRY_CORRECTED',
]);

// ── Constants ─────────────────────────────────────────────────────────────────

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

// ── GET /audit-logs ───────────────────────────────────────────────────────────

export async function getAuditLogsHandler(req: Request, res: Response): Promise<void> {
  const q = req.query as Record<string, string | undefined>;

  const filters: ListAuditLogsFilters = {};

  if (q.entity_type !== undefined) {
    if (!VALID_ENTITY_TYPES.has(q.entity_type as AuditEntityType)) {
      throw new AppError(`Invalid entity_type: ${q.entity_type}`, 400);
    }
    filters.entity_type = q.entity_type as AuditEntityType;
  }

  if (q.action !== undefined) {
    if (!VALID_ACTIONS.has(q.action as AuditAction)) {
      throw new AppError(`Invalid action: ${q.action}`, 400);
    }
    filters.action = q.action as AuditAction;
  }

  if (q.entity_id !== undefined) {
    const parsed = parseInt(q.entity_id, 10);
    if (isNaN(parsed) || parsed <= 0) {
      throw new AppError('entity_id must be a positive integer', 400);
    }
    filters.entity_id = parsed;
  }

  if (q.user_id !== undefined) {
    const parsed = parseInt(q.user_id, 10);
    if (isNaN(parsed) || parsed <= 0) {
      throw new AppError('user_id must be a positive integer', 400);
    }
    filters.user_id = parsed;
  }

  if (q.date_from !== undefined) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(q.date_from)) {
      throw new AppError('date_from must be in YYYY-MM-DD format', 400);
    }
    filters.date_from = q.date_from;
  }

  if (q.date_to !== undefined) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(q.date_to)) {
      throw new AppError('date_to must be in YYYY-MM-DD format', 400);
    }
    filters.date_to = q.date_to;
  }

  const page = Math.max(1, parseInt(q.page ?? '1', 10) || 1);
  const limit = Math.min(
    MAX_LIMIT,
    Math.max(1, parseInt(q.limit ?? String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT),
  );

  const result = await listAuditLogs(filters, { page, limit });
  res.json(result);
}
