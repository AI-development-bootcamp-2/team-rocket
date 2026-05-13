import type { Knex } from 'knex';
import { AppError } from '../middleware/error.middleware';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const db = require('../database/connection') as Knex;

export interface TaskRow {
  id: number;
  project_id: number;
  client_id: number;
  name: string;
  status: 'open' | 'closed';
  start_date: string | null;
  end_date: string | null;
  description: string | null;
  project_name: string;
  client_name: string;
  assigned_users_count: number | string;
  created_at: Date;
  updated_at: Date;
}

function baseTaskQuery() {
  return db<TaskRow>('tasks as t')
    .join('projects as p', 'p.id', 't.project_id')
    .join('clients as c', 'c.id', 'p.client_id')
    .leftJoin('user_task_assignments as uta_all', function joinAllAssignments() {
      this.on('uta_all.task_id', '=', 't.id')
        .andOn(db.raw('uta_all.is_active = true'));
    })
    .select(
      't.id',
      't.project_id',
      'p.client_id',
      't.name',
      't.status',
      't.start_date',
      't.end_date',
      't.description',
      'p.name as project_name',
      'c.name as client_name',
      db.raw('COUNT(DISTINCT uta_all.user_id) as assigned_users_count'),
      't.created_at',
      't.updated_at',
    )
    .groupBy(
      't.id',
      't.project_id',
      'p.client_id',
      't.name',
      't.status',
      't.start_date',
      't.end_date',
      't.description',
      'p.name',
      'c.name',
      't.created_at',
      't.updated_at',
    );
}

export async function listTasks(filters: {
  projectId?: number;
  status?: 'open' | 'closed';
  userId?: number;
} = {}): Promise<TaskRow[]> {
  const query = baseTaskQuery()
    .orderBy('p.name', 'asc')
    .orderBy('t.name', 'asc');

  if (filters.projectId != null) {
    query.where('t.project_id', filters.projectId);
  }

  if (filters.status != null) {
    query.where('t.status', filters.status);
  }

  if (filters.userId != null) {
    query.join('user_task_assignments as uta', function joinAssignments() {
      this.on('uta.task_id', '=', 't.id')
        .andOn(db.raw('uta.user_id = ?', [filters.userId!]))
        .andOn(db.raw('uta.is_active = true'));
    });
  }

  return query;
}

export async function getTaskById(
  taskId: number,
  userId?: number,
): Promise<TaskRow | null> {
  const query = baseTaskQuery()
    .where('t.id', taskId);

  if (userId != null) {
    query.join('user_task_assignments as uta', function joinAssignments() {
      this.on('uta.task_id', '=', 't.id')
        .andOn(db.raw('uta.user_id = ?', [userId]))
        .andOn(db.raw('uta.is_active = true'));
    });
  }

  const task = await query.first();
  return task ?? null;
}

export interface TaskCreateInput {
  projectId: number;
  name: string;
  startDate?: string | null;
  endDate?: string | null;
  description?: string | null;
}

export async function createTask(input: TaskCreateInput): Promise<TaskRow> {
  const projectExists = await db('projects').where('id', input.projectId).first();
  if (!projectExists) {
    throw new AppError('project_id does not exist', 400);
  }

  const [created] = (await db('tasks')
    .insert({
      project_id: input.projectId,
      name: input.name,
      status: 'open',
      start_date: input.startDate ?? null,
      end_date: input.endDate ?? null,
      description: input.description ?? null,
      created_at: new Date(),
      updated_at: new Date(),
    })
    .returning(['id'])) as Array<{ id: number }>;

  const task = await getTaskById(created.id);
  if (!task) {
    throw new Error(`Created task ${created.id} could not be reloaded`);
  }

  return task;
}

export interface TaskUpdateInput {
  name?: string;
  projectId?: number;
  status?: 'open' | 'closed';
  startDate?: string | null;
  endDate?: string | null;
  description?: string | null;
}

export async function updateTask(
  taskId: number,
  input: TaskUpdateInput,
): Promise<{ before: TaskRow; after: TaskRow } | null> {
  const before = await getTaskById(taskId);
  if (!before) return null;

  if (input.projectId !== undefined) {
    const projectExists = await db('projects').where('id', input.projectId).first();
    if (!projectExists) throw new AppError('project_id does not exist', 400);
  }

  const patch: Record<string, unknown> = {};
  if (input.projectId !== undefined) patch.project_id = input.projectId;
  if (input.name !== undefined) patch.name = input.name;
  if (input.status !== undefined) patch.status = input.status;
  if ('startDate' in input) patch.start_date = input.startDate ?? null;
  if ('endDate' in input) patch.end_date = input.endDate ?? null;
  if ('description' in input) patch.description = input.description ?? null;

  await db('tasks')
    .where('id', taskId)
    .update({ ...patch, updated_at: db.fn.now() });

  const after = await getTaskById(taskId);
  if (!after) {
    throw new Error(`Updated task ${taskId} could not be reloaded`);
  }

  return { before, after };
}

export async function closeTask(
  taskId: number,
): Promise<{ before: TaskRow; after: TaskRow } | null> {
  const before = await getTaskById(taskId);
  if (!before) return null;

  await db('tasks')
    .where('id', taskId)
    .update({ status: 'closed', updated_at: db.fn.now() });

  const after = await getTaskById(taskId);
  if (!after) {
    throw new Error(`Closed task ${taskId} could not be reloaded`);
  }

  return { before, after };
}
