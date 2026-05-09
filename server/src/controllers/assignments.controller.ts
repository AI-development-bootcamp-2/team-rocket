import { Request, Response } from 'express';
import { AppError } from '../middleware/error.middleware';
import { writeAuditLog } from '../services/auth.service';
import {
  assertTaskOpen,
  assertUserActive,
  createAssignment,
  getAssignFlag,
  getAssignmentById,
  listAssignments,
  toggleAssignment,
  type AssignmentRow,
} from '../services/assignments.service';

function toAssignmentResponse(row: AssignmentRow) {
  return {
    id: row.id,
    userId: row.user_id,
    taskId: row.task_id,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    user: {
      firstName: row.user_first_name,
      lastName: row.user_last_name,
      email: row.user_email,
    },
    task: {
      name: row.task_name,
      status: row.task_status,
    },
    projectId: row.project_id,
    projectName: row.project_name,
    clientId: row.client_id,
    clientName: row.client_name,
  };
}

/** Resolves the caller's access level and optional scoped project IDs. */
async function resolveCallerScope(
  callerId: number,
  role: 'admin' | 'user',
): Promise<{ scopedProjectIds?: number[] }> {
  if (role === 'admin') return {};
  const flag = await getAssignFlag(callerId);
  if (!flag) return {};
  return { scopedProjectIds: flag.scoped_project_ids ?? [] };
}

export async function getAssignmentsHandler(req: Request, res: Response): Promise<void> {
  const caller = req.user!;

  // Optional query-string filters
  let projectId: number | undefined;
  if (req.query.project_id != null && req.query.project_id !== '') {
    const parsed = Number(req.query.project_id);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      throw new AppError('project_id must be a positive integer', 400);
    }
    projectId = parsed;
  }

  let userId: number | undefined;
  if (req.query.user_id != null && req.query.user_id !== '') {
    const parsed = Number(req.query.user_id);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      throw new AppError('user_id must be a positive integer', 400);
    }
    // Regular users without flag may only query their own assignments
    if (caller.role === 'user' && parsed !== caller.id) {
      const flag = await getAssignFlag(caller.id);
      if (!flag) throw new AppError('Forbidden', 403);
    }
    userId = parsed;
  }

  const { scopedProjectIds } = await resolveCallerScope(caller.id, caller.role);

  const rows = await listAssignments({
    role: caller.role,
    callerId: caller.id,
    scopedProjectIds,
    projectId,
    userId,
  });

  res.json({ data: rows.map(toAssignmentResponse) });
}

export async function getAssignmentByIdHandler(req: Request, res: Response): Promise<void> {
  const caller = req.user!;
  const id = parseInt(req.params.id, 10);
  if (!Number.isInteger(id) || id <= 0) {
    throw new AppError('Invalid assignment id', 400);
  }

  const { scopedProjectIds } = await resolveCallerScope(caller.id, caller.role);

  const row = await getAssignmentById(id, {
    role: caller.role,
    callerId: caller.id,
    scopedProjectIds,
  });

  if (!row) throw new AppError('Assignment not found', 404);

  res.json({ data: toAssignmentResponse(row) });
}

export async function createAssignmentHandler(req: Request, res: Response): Promise<void> {
  const caller = req.user!;

  // Only admin or user with canAssignProjectTasks flag may create assignments
  if (caller.role !== 'admin') {
    const flag = await getAssignFlag(caller.id);
    if (!flag) throw new AppError('Forbidden', 403);

    // Scope check: the task must belong to one of the caller's allowed projects
    const userId = Number((req.body as Record<string, unknown>).user_id);
    const taskId = Number((req.body as Record<string, unknown>).task_id);
    if (!Number.isInteger(taskId) || taskId <= 0) throw new AppError('task_id is required', 400);

    const task = await assertTaskOpen(taskId);
    const scopedIds = flag.scoped_project_ids ?? [];
    if (!scopedIds.includes(task.project_id)) {
      throw new AppError('Task is outside your allowed projects', 403);
    }

    if (!Number.isInteger(userId) || userId <= 0) throw new AppError('user_id is required', 400);
    await assertUserActive(userId);

    const assignment = await createAssignment({ userId, taskId });
    await writeAuditLog({
      actorUserId: caller.id,
      entityType: 'ASSIGNMENT',
      entityId: assignment.id,
      action: 'CREATE',
      newValue: toAssignmentResponse(assignment) as unknown as Record<string, unknown>,
      ipAddress: req.ip ?? '',
    });
    res.status(201).json({ data: toAssignmentResponse(assignment) });
    return;
  }

  // Admin path
  const body = req.body as Record<string, unknown>;
  const userId = Number(body.user_id);
  const taskId = Number(body.task_id);
  if (!Number.isInteger(userId) || userId <= 0) throw new AppError('user_id is required', 400);
  if (!Number.isInteger(taskId) || taskId <= 0) throw new AppError('task_id is required', 400);

  await assertUserActive(userId);
  await assertTaskOpen(taskId);

  const assignment = await createAssignment({ userId, taskId });
  await writeAuditLog({
    actorUserId: caller.id,
    entityType: 'ASSIGNMENT',
    entityId: assignment.id,
    action: 'CREATE',
    newValue: toAssignmentResponse(assignment) as unknown as Record<string, unknown>,
    ipAddress: req.ip ?? '',
  });
  res.status(201).json({ data: toAssignmentResponse(assignment) });
}

export async function deleteAssignmentHandler(req: Request, res: Response): Promise<void> {
  const caller = req.user!;
  const id = parseInt(req.params.id, 10);
  if (!Number.isInteger(id) || id <= 0) throw new AppError('Invalid assignment id', 400);

  // Non-admin must have canAssignProjectTasks flag and target must be in scope
  if (caller.role !== 'admin') {
    const flag = await getAssignFlag(caller.id);
    if (!flag) throw new AppError('Forbidden', 403);

    const existing = await getAssignmentById(id, {
      role: 'user',
      callerId: caller.id,
      scopedProjectIds: flag.scoped_project_ids ?? [],
    });
    if (!existing) throw new AppError('Assignment not found', 404);
  }

  const before = await getAssignmentById(id, { role: 'admin', callerId: 0 });
  if (!before) throw new AppError('Assignment not found', 404);

  const updated = await toggleAssignment(id, false);
  if (!updated) throw new AppError('Assignment not found', 404);

  await writeAuditLog({
    actorUserId: caller.id,
    entityType: 'ASSIGNMENT',
    entityId: id,
    action: 'DELETE',
    oldValue: toAssignmentResponse(before) as unknown as Record<string, unknown>,
    newValue: toAssignmentResponse(updated) as unknown as Record<string, unknown>,
    ipAddress: req.ip ?? '',
  });

  res.json({ data: toAssignmentResponse(updated) });
}

export async function toggleAssignmentHandler(req: Request, res: Response): Promise<void> {
  const caller = req.user!;
  const id = parseInt(req.params.id, 10);
  if (!Number.isInteger(id) || id <= 0) throw new AppError('Invalid assignment id', 400);

  const body = req.body as Record<string, unknown>;
  if (typeof body.is_active !== 'boolean') {
    throw new AppError('is_active must be a boolean', 400);
  }

  // Fetch first to enforce scope for non-admins
  if (caller.role !== 'admin') {
    const flag = await getAssignFlag(caller.id);
    if (!flag) throw new AppError('Forbidden', 403);

    const { scopedProjectIds } = { scopedProjectIds: flag.scoped_project_ids ?? [] };
    const existing = await getAssignmentById(id, {
      role: 'user',
      callerId: caller.id,
      scopedProjectIds,
    });
    if (!existing) throw new AppError('Assignment not found', 404);
  }

  const before = await getAssignmentById(id, { role: 'admin', callerId: 0 });
  if (!before) throw new AppError('Assignment not found', 404);

  const updated = await toggleAssignment(id, body.is_active);
  if (!updated) throw new AppError('Assignment not found', 404);

  await writeAuditLog({
    actorUserId: caller.id,
    entityType: 'ASSIGNMENT',
    entityId: id,
    action: 'UPDATE',
    oldValue: toAssignmentResponse(before) as unknown as Record<string, unknown>,
    newValue: toAssignmentResponse(updated) as unknown as Record<string, unknown>,
    ipAddress: req.ip ?? '',
  });

  res.json({ data: toAssignmentResponse(updated) });
}
