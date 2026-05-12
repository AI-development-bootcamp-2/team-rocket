import { Request, Response } from 'express';
import { startTimer, stopTimer, getTimerStatus } from '../services/timer.service';
import { AppError } from '../middleware/error.middleware';

const VALID_LOCATIONS = new Set<string>(['office', 'home', 'client']);

export async function startTimerHandler(req: Request, res: Response): Promise<void> {
  if (!req.user) throw new AppError('Authentication required', 401);
  const result = await startTimer(req.user.id);
  res.status(201).json(result);
}

export async function stopTimerHandler(req: Request, res: Response): Promise<void> {
  if (!req.user) throw new AppError('Authentication required', 401);

  const { clientId, projectId, taskId, location, description } = req.body as Record<string, unknown>;

  if (!Number.isInteger(clientId) || (clientId as number) <= 0) {
    throw new AppError('clientId must be a positive integer', 400);
  }
  if (!Number.isInteger(projectId) || (projectId as number) <= 0) {
    throw new AppError('projectId must be a positive integer', 400);
  }
  if (!Number.isInteger(taskId) || (taskId as number) <= 0) {
    throw new AppError('taskId must be a positive integer', 400);
  }
  if (typeof location !== 'string' || !VALID_LOCATIONS.has(location)) {
    throw new AppError('location must be one of: office, home, client', 400);
  }
  if (typeof description !== 'string' || description.trim().length === 0) {
    throw new AppError('description is required', 400);
  }
  if (description.length > 2000) {
    throw new AppError('description must be 2000 characters or fewer', 400);
  }

  const result = await stopTimer(req.user.id, {
    clientId: clientId as number,
    projectId: projectId as number,
    taskId: taskId as number,
    location: location as 'office' | 'home' | 'client',
    description: description.trim(),
  });
  res.json(result);
}

export async function getTimerStatusHandler(req: Request, res: Response): Promise<void> {
  if (!req.user) throw new AppError('Authentication required', 401);
  const status = await getTimerStatus(req.user.id);
  res.json(status);
}
