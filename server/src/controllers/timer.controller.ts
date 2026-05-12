import { Request, Response } from 'express';
import { startTimer, getTimerStatus, quickStop } from '../services/timer.service';
import { AppError } from '../middleware/error.middleware';

export async function startTimerHandler(req: Request, res: Response): Promise<void> {
  if (!req.user) throw new AppError('Authentication required', 401);
  const result = await startTimer(req.user.id);
  res.status(201).json(result);
}

export async function stopTimerHandler(req: Request, res: Response): Promise<void> {
  if (!req.user) throw new AppError('Authentication required', 401);
  const result = await quickStop(req.user.id);
  res.json(result);
}

export async function getTimerStatusHandler(req: Request, res: Response): Promise<void> {
  if (!req.user) throw new AppError('Authentication required', 401);
  const status = await getTimerStatus(req.user.id);
  res.json(status);
}
