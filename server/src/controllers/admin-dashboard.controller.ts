import { Request, Response } from 'express';
import { AppError } from '../middleware/error.middleware';
import { getAdminDashboard } from '../services/admin-dashboard.service';

function getCurrentIsraelMonth(): { year: number; month: number } {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jerusalem',
    year: 'numeric',
    month: '2-digit',
  });
  const parts = formatter.formatToParts(new Date());
  const year = Number(parts.find((part) => part.type === 'year')?.value);
  const month = Number(parts.find((part) => part.type === 'month')?.value);
  return { year, month };
}

function parseYear(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 2000 || parsed > 2100) {
    throw new AppError('year must be an integer between 2000 and 2100', 400);
  }
  return parsed;
}

function parseMonth(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 12) {
    throw new AppError('month must be an integer between 1 and 12', 400);
  }
  return parsed;
}

export async function getAdminDashboardHandler(req: Request, res: Response): Promise<void> {
  const hasYear = req.query.year != null && req.query.year !== '';
  const hasMonth = req.query.month != null && req.query.month !== '';

  if (hasYear !== hasMonth) {
    throw new AppError('year and month must be provided together', 400);
  }

  const fallback = getCurrentIsraelMonth();
  const year = hasYear ? parseYear(req.query.year) : fallback.year;
  const month = hasMonth ? parseMonth(req.query.month) : fallback.month;

  const payload = await getAdminDashboard(year, month);
  res.json(payload);
}
