import { Request, Response } from 'express';
import { AppError } from '../middleware/error.middleware';
import {
  lock,
  unlock,
  getStatus,
  listMonths,
} from '../services/month-locks.service';

// ── Shared param parser ───────────────────────────────────────────────────────

function parseYearMonth(params: Request['params']): { year: number; month: number } {
  const year = Number(params.year);
  const month = Number(params.month);

  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    throw new AppError('year must be an integer between 2000 and 2100', 400);
  }
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new AppError('month must be an integer between 1 and 12', 400);
  }

  return { year, month };
}

// ── POST /admin/months/:year/:month/lock ──────────────────────────────────────

export async function lockMonthHandler(req: Request, res: Response): Promise<void> {
  const caller = req.user!;
  const { year, month } = parseYearMonth(req.params);

  const row = await lock(year, month, caller.id);

  res.json(row);
}

// ── POST /admin/months/:year/:month/unlock ────────────────────────────────────

export async function unlockMonthHandler(req: Request, res: Response): Promise<void> {
  const caller = req.user!;
  const { year, month } = parseYearMonth(req.params);

  const reason = req.body?.reason;
  if (!reason || typeof reason !== 'string' || !reason.trim()) {
    throw new AppError('reason is required', 422);
  }

  const row = await unlock(year, month, caller.id, reason);

  res.json(row);
}

// ── GET /admin/months/:year/:month/status ─────────────────────────────────────

export async function getMonthStatusHandler(req: Request, res: Response): Promise<void> {
  const { year, month } = parseYearMonth(req.params);

  const status = await getStatus(year, month);

  res.json(status);
}

// ── GET /admin/months ─────────────────────────────────────────────────────────

export async function listMonthsHandler(_req: Request, res: Response): Promise<void> {
  const months = await listMonths();

  res.json(months);
}
