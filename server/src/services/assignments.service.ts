import type { Knex } from 'knex';
import { AppError } from '../middleware/error.middleware';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const db = require('../database/connection') as Knex;

export interface AssignmentRow {
  id: number;
  user_id: number;
  task_id: number;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
  // joined fields
  user_first_name: string;
  user_last_name: string;
  user_email: string;
  task_name: string;
  task_status: string;
  project_id: number;
  project_name: string;
  client_id: number;
  client_name: string;
}

function baseAssignmentQuery() {
  return db<AssignmentRow>('user_task_assignments as uta')
    .join('users as u', 'u.id', 'uta.user_id')
    .join('tasks as t', 't.id', 'uta.task_id')
    .join('projects as p', 'p.id', 't.project_id')
    .join('clients as c', 'c.id', 'p.client_id')
    .select(
      'uta.id',
      'uta.user_id',
      'uta.task_id',
      'uta.is_active',
      'uta.created_at',
      'uta.updated_at',
      'u.first_name as user_first_name',
      'u.last_name as user_last_name',
      'u.email as user_email',
      't.name as task_name',
      't.status as task_status',
      'p.id as project_id',
      'p.name as project_name',
      'c.id as client_id',
      'c.name as client_name',
    )
    .orderBy('uta.id', 'asc');
}

export interface ListAssignmentsFilters {
  /** Admin: no restriction. User+flag: scoped project IDs. User: own user_id only. */
  role: 'admin' | 'user';
  callerId: number;
  /** Set when caller is a user with canAssignProjectTasks flag — list of allowed project IDs */
  scopedProjectIds?: number[];
  // optional query filters
  projectId?: number;
  userId?: number;
}

export async function listAssignments(filters: ListAssignmentsFilters): Promise<AssignmentRow[]> {
  const query = baseAssignmentQuery();

  if (filters.role === 'admin') {
    // Admin sees all — apply optional filters only
  } else if (filters.scopedProjectIds != null) {
    // User with canAssignProjectTasks flag — restrict to their scoped projects
    query.whereIn('p.id', filters.scopedProjectIds);
  } else {
    // Regular user — own assignments only
    query.where('uta.user_id', filters.callerId);
  }

  // Optional query-string filters
  if (filters.projectId != null) {
    query.where('p.id', filters.projectId);
  }
  if (filters.userId != null) {
    query.where('uta.user_id', filters.userId);
  }

  return query;
}

export async function getAssignmentById(
  id: number,
  filters: { role: 'admin' | 'user'; callerId: number; scopedProjectIds?: number[] },
): Promise<AssignmentRow | null> {
  const query = baseAssignmentQuery().where('uta.id', id);

  if (filters.role !== 'admin') {
    if (filters.scopedProjectIds != null) {
      query.whereIn('p.id', filters.scopedProjectIds);
    } else {
      query.where('uta.user_id', filters.callerId);
    }
  }

  const row = await query.first();
  return row ?? null;
}

/** Fetches the canAssignProjectTasks permission flag for a user. Returns null if not granted. */
export async function getAssignFlag(
  userId: number,
): Promise<{ scoped_project_ids: number[] | null } | null> {
  const flag = await db('permission_flags')
    .where({ user_id: userId, flag_name: 'canAssignProjectTasks' })
    .select('scoped_project_ids')
    .first() as { scoped_project_ids: number[] | null } | undefined;

  return flag ?? null;
}

export async function createAssignment(params: {
  userId: number;
  taskId: number;
}): Promise<AssignmentRow> {
  // Check for existing assignment (active or inactive) for this user+task pair
  const existing = await db('user_task_assignments')
    .where({ user_id: params.userId, task_id: params.taskId })
    .select('id', 'is_active')
    .first() as { id: number; is_active: boolean } | undefined;

  if (existing) {
    if (existing.is_active) {
      throw new AppError('Assignment already exists for this user and task', 409);
    }
    // Reactivate the inactive assignment instead of creating a duplicate
    await db('user_task_assignments')
      .where({ id: existing.id })
      .update({ is_active: true, updated_at: new Date() });

    const row = await getAssignmentById(existing.id, { role: 'admin', callerId: 0 });
    if (!row) throw new AppError('Assignment not found after reactivation', 500);
    return row;
  }

  const [created] = (await db('user_task_assignments')
    .insert({
      user_id: params.userId,
      task_id: params.taskId,
      is_active: true,
      created_at: new Date(),
      updated_at: new Date(),
    })
    .returning(['id'])) as Array<{ id: number }>;

  const row = await getAssignmentById(created.id, { role: 'admin', callerId: 0 });
  if (!row) throw new AppError('Assignment not found after creation', 500);
  return row;
}

export async function toggleAssignment(
  id: number,
  isActive: boolean,
): Promise<AssignmentRow | null> {
  const updated = await db('user_task_assignments')
    .where({ id })
    .update({ is_active: isActive, updated_at: new Date() });

  if (!updated) return null;

  const row = await getAssignmentById(id, { role: 'admin', callerId: 0 });
  return row;
}

export async function assertUserActive(userId: number): Promise<void> {
  const user = await db('users').where({ id: userId, is_active: true }).select('id').first();
  if (!user) throw new AppError('User not found or inactive', 404);
}

export async function assertTaskOpen(taskId: number): Promise<{ project_id: number }> {
  const task = await db('tasks').where({ id: taskId }).select('id', 'status', 'project_id').first() as
    | { id: number; status: string; project_id: number }
    | undefined;
  if (!task) throw new AppError('Task not found', 404);
  if (task.status === 'closed') throw new AppError('Task is closed', 422);
  return { project_id: task.project_id };
}
