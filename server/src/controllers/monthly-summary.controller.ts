import { Request, Response } from 'express';
import { AppError } from '../middleware/error.middleware';
import { getMonthlySummary } from '../services/monthly-summary.service';

export async function getMonthlySummaryHandler(req: Request, res: Response): Promise<void> {
  const caller = req.user!;

  const yearParam = req.query.year;
  const monthParam = req.query.month;

  if (yearParam == null || yearParam === '') {
    throw new AppError('year query parameter is required', 400);
  }
  if (monthParam == null || monthParam === '') {
    throw new AppError('month query parameter is required', 400);
  }

  const year = Number(yearParam);
  const month = Number(monthParam);

  if (!Number.isInteger(year) || year < 1000 || year > 9999) {
    throw new AppError('year must be a 4-digit integer', 400);
  }
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new AppError('month must be an integer between 1 and 12', 400);
  }

  let userId = caller.id;
  if (req.query.userId != null && req.query.userId !== '') {
    const parsed = Number(req.query.userId);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      throw new AppError('userId must be a positive integer', 400);
    }
    if (caller.role === 'user' && parsed !== caller.id) {
      throw new AppError('Forbidden', 403);
    }
    userId = parsed;
  }

  const summary = await getMonthlySummary({ userId, year, month, caller });

  res.status(200).json(summary);
}
