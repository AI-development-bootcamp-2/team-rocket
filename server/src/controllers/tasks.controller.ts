import { Request, Response } from 'express';
import { AppError } from '../middleware/error.middleware';
import { writeAuditLog } from '../services/auth.service';
import {
  createTask,
  closeTask,
  getTaskById,
  listTasks,
  updateTask,
  type TaskRow,
} from '../services/tasks.service';

function toTaskResponse(task: TaskRow) {
  const normalizeDate = (value: string | Date | null) => {
    if (value == null) return null;
    if (value instanceof Date) {
      return value.toISOString().slice(0, 10);
    }
    return value.includes('T') ? value.slice(0, 10) : value;
  };

  return {
    id: task.id,
    projectId: task.project_id,
    clientId: task.client_id,
    name: task.name,
    status: task.status,
    startDate: normalizeDate(task.start_date),
    endDate: normalizeDate(task.end_date),
    description: task.description,
    projectName: task.project_name,
    clientName: task.client_name,
    assignedUsersCount: Number(task.assigned_users_count ?? 0),
    createdAt: task.created_at,
    updatedAt: task.updated_at,
  };
}

function extractIp(req: Request): string {
  return req.ip ?? '';
}

function parseRequiredName(rawValue: unknown): string {
  const name = typeof rawValue === 'string' ? rawValue.trim() : '';
  if (!name) {
    throw new AppError('name is required', 400);
  }
  return name;
}

function parseOptionalName(rawValue: unknown): string {
  const name = typeof rawValue === 'string' ? rawValue.trim() : '';
  if (!name) {
    throw new AppError('name cannot be empty', 400);
  }
  return name;
}

function parseOptionalDate(rawValue: unknown, fieldName: string): string | null {
  if (rawValue == null) return null;
  if (typeof rawValue !== 'string') {
    throw new AppError(`${fieldName} must be a string or null`, 400);
  }
  const trimmed = rawValue.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parseOptionalDescription(rawValue: unknown): string | null {
  if (rawValue == null) return null;
  if (typeof rawValue !== 'string') {
    throw new AppError('description must be a string or null', 400);
  }
  const trimmed = rawValue.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export async function getTasks(req: Request, res: Response): Promise<void> {
  const caller = req.user!;

  let projectId: number | undefined;
  if (req.query.project_id != null && req.query.project_id !== '') {
    const parsed = Number(req.query.project_id);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      throw new AppError('project_id must be a positive integer', 400);
    }
    projectId = parsed;
  }

  let status: 'open' | 'closed' | undefined;
  if (req.query.status != null && req.query.status !== '') {
    if (req.query.status !== 'open' && req.query.status !== 'closed') {
      throw new AppError('status must be open or closed', 400);
    }
    status = req.query.status;
  }

  const tasks = await listTasks({
    projectId,
    status,
    userId: caller.role === 'user' ? caller.id : undefined,
  });

  res.json({ data: tasks.map(toTaskResponse) });
}

export async function getTaskDetail(req: Request, res: Response): Promise<void> {
  const caller = req.user!;
  const taskId = parseInt(req.params.id, 10);

  if (!Number.isInteger(taskId) || taskId <= 0) {
    throw new AppError('Invalid task id', 400);
  }

  const task = await getTaskById(
    taskId,
    caller.role === 'user' ? caller.id : undefined,
  );

  if (!task) {
    throw new AppError('Task not found', 404);
  }

  res.json({ data: toTaskResponse(task) });
}

export async function createTaskHandler(req: Request, res: Response): Promise<void> {
  const actor = req.user!;
  const body = req.body as Record<string, unknown>;

  const projectId = Number(body.project_id);
  if (!Number.isInteger(projectId) || projectId <= 0) {
    throw new AppError('project_id is required and must be a positive integer', 400);
  }

  const task = await createTask({
    projectId,
    name: parseRequiredName(body.name),
    startDate: 'start_date' in body ? parseOptionalDate(body.start_date, 'start_date') : undefined,
    endDate: 'end_date' in body ? parseOptionalDate(body.end_date, 'end_date') : undefined,
    description: 'description' in body ? parseOptionalDescription(body.description) : undefined,
  });

  await writeAuditLog({
    actorUserId: actor.id,
    entityType: 'TASK',
    entityId: task.id,
    action: 'CREATE',
    newValue: toTaskResponse(task) as unknown as Record<string, unknown>,
    ipAddress: extractIp(req),
  });

  res.status(201).json({ data: toTaskResponse(task) });
}

export async function updateTaskHandler(req: Request, res: Response): Promise<void> {
  const actor = req.user!;
  const taskId = parseInt(req.params.id, 10);
  if (!Number.isInteger(taskId) || taskId <= 0) {
    throw new AppError('Invalid task id', 400);
  }

  const body = req.body as Record<string, unknown>;
  const input: Parameters<typeof updateTask>[1] = {};

  if (body.name !== undefined) {
    input.name = parseOptionalName(body.name);
  }
  if (body.status !== undefined) {
    if (body.status !== 'open' && body.status !== 'closed') {
      throw new AppError('status must be open or closed', 400);
    }
    input.status = body.status;
  }
  if ('start_date' in body) {
    input.startDate = parseOptionalDate(body.start_date, 'start_date');
  }
  if ('end_date' in body) {
    input.endDate = parseOptionalDate(body.end_date, 'end_date');
  }
  if ('description' in body) {
    input.description = parseOptionalDescription(body.description);
  }

  const result = await updateTask(taskId, input);
  if (!result) {
    throw new AppError('Task not found', 404);
  }

  await writeAuditLog({
    actorUserId: actor.id,
    entityType: 'TASK',
    entityId: taskId,
    action: 'UPDATE',
    oldValue: toTaskResponse(result.before) as unknown as Record<string, unknown>,
    newValue: toTaskResponse(result.after) as unknown as Record<string, unknown>,
    ipAddress: extractIp(req),
  });

  res.json({ data: toTaskResponse(result.after) });
}

export async function closeTaskHandler(req: Request, res: Response): Promise<void> {
  const actor = req.user!;
  const taskId = parseInt(req.params.id, 10);
  if (!Number.isInteger(taskId) || taskId <= 0) {
    throw new AppError('Invalid task id', 400);
  }

  const result = await closeTask(taskId);
  if (!result) {
    throw new AppError('Task not found', 404);
  }

  await writeAuditLog({
    actorUserId: actor.id,
    entityType: 'TASK',
    entityId: taskId,
    action: 'DELETE',
    oldValue: toTaskResponse(result.before) as unknown as Record<string, unknown>,
    newValue: toTaskResponse(result.after) as unknown as Record<string, unknown>,
    ipAddress: extractIp(req),
  });

  res.json({ data: toTaskResponse(result.after) });
}
