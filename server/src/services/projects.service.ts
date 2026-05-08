import type { Knex } from 'knex';
import { AppError } from '../middleware/error.middleware';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const db = require('../database/connection') as Knex;

export interface ProjectListRow {
  id: number;
  name: string;
  is_active: boolean;
  client_id: number;
  manager_user_id: number | null;
  start_date: string | null;
  end_date: string | null;
  description: string | null;
  created_at: Date;
  updated_at: Date;
}

export async function listProjects(filters: {
  isActive?: boolean;
  clientId?: number;
  userId?: number;
} = {}): Promise<ProjectListRow[]> {
  const query = db<ProjectListRow>('projects as p')
    .select(
      'p.id',
      'p.name',
      'p.is_active',
      'p.client_id',
      'p.manager_user_id',
      'p.start_date',
      'p.end_date',
      'p.description',
      'p.created_at',
      'p.updated_at',
    )
    .orderBy('p.name', 'asc');

  if (typeof filters.isActive === 'boolean') {
    query.where('p.is_active', filters.isActive);
  }

  if (filters.clientId != null) {
    query.where('p.client_id', filters.clientId);
  }

  // Non-admin users only see projects that have at least one task assigned to them
  if (filters.userId != null) {
    query
      .join('tasks as t', 't.project_id', 'p.id')
      .join('user_task_assignments as uta', function () {
        this.on('uta.task_id', '=', 't.id')
          .andOn(db.raw('uta.user_id = ?', [filters.userId!]))
          .andOn(db.raw('uta.is_active = true'));
      })
      .distinct();
  }

  return query;
}

export interface TaskRow {
  id: number;
  project_id: number;
  name: string;
  status: 'open' | 'closed';
  start_date: string | null;
  end_date: string | null;
  description: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface ProjectDetailRow extends ProjectListRow {
  tasks: TaskRow[];
}

export async function getProjectById(
  projectId: number,
  userId?: number,
): Promise<ProjectDetailRow | null> {
  const project = await db<ProjectListRow>('projects as p')
    .select(
      'p.id',
      'p.name',
      'p.is_active',
      'p.client_id',
      'p.manager_user_id',
      'p.start_date',
      'p.end_date',
      'p.description',
      'p.created_at',
      'p.updated_at',
    )
    .where('p.id', projectId)
    .first();

  if (!project) return null;

  // For regular users: verify they have at least one active assignment in this project
  if (userId != null) {
    const assignment = await db('user_task_assignments as uta')
      .join('tasks as t', 't.id', 'uta.task_id')
      .where('t.project_id', projectId)
      .where('uta.user_id', userId)
      .where('uta.is_active', true)
      .first();

    if (!assignment) return null;
  }

  const tasks = await db<TaskRow>('tasks')
    .select('id', 'project_id', 'name', 'status', 'start_date', 'end_date', 'description', 'created_at', 'updated_at')
    .where('project_id', projectId)
    .orderBy('name', 'asc');

  return { ...project, tasks };
}

export interface ProjectWriteInput {
  clientId: number;
  name: string;
  managerUserId?: number | null;
  startDate?: string | null;
  endDate?: string | null;
  description?: string | null;
}

export async function createProject(
  input: ProjectWriteInput,
): Promise<{ project: ProjectListRow; duplicate: boolean }> {
  // Validate that client exists
  const clientExists = await db('clients').where('id', input.clientId).first();
  if (!clientExists) throw new AppError('client_id does not exist', 400);

  // Check for duplicate name under same client (case-insensitive) — warn but allow
  const existing = await db('projects')
    .whereRaw('LOWER(name) = LOWER(?)', [input.name])
    .where('client_id', input.clientId)
    .first();

  const [project] = await db<ProjectListRow>('projects')
    .insert({
      client_id: input.clientId,
      name: input.name,
      manager_user_id: input.managerUserId ?? null,
      start_date: input.startDate ?? null,
      end_date: input.endDate ?? null,
      description: input.description ?? null,
      is_active: true,
    })
    .returning([
      'id', 'name', 'is_active', 'client_id', 'manager_user_id',
      'start_date', 'end_date', 'description', 'created_at', 'updated_at',
    ]);

  return { project, duplicate: !!existing };
}

export interface ProjectUpdateInput {
  name?: string;
  clientId?: number;
  managerUserId?: number | null;
  startDate?: string | null;
  endDate?: string | null;
  description?: string | null;
  isActive?: boolean;
}

export async function updateProject(
  projectId: number,
  input: ProjectUpdateInput,
): Promise<{ before: ProjectListRow; after: ProjectListRow } | null> {
  const before = await db<ProjectListRow>('projects').where('id', projectId).first();
  if (!before) return null;

  // Validate new client_id if provided
  if (input.clientId !== undefined) {
    const clientExists = await db('clients').where('id', input.clientId).first();
    if (!clientExists) throw new AppError('client_id does not exist', 400);
  }

  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) patch.name = input.name;
  if (input.clientId !== undefined) patch.client_id = input.clientId;
  if ('managerUserId' in input) patch.manager_user_id = input.managerUserId ?? null;
  if ('startDate' in input) patch.start_date = input.startDate ?? null;
  if ('endDate' in input) patch.end_date = input.endDate ?? null;
  if ('description' in input) patch.description = input.description ?? null;
  if (input.isActive !== undefined) patch.is_active = input.isActive;

  const [after] = await db<ProjectListRow>('projects')
    .where('id', projectId)
    .update({ ...patch, updated_at: db.fn.now() })
    .returning([
      'id', 'name', 'is_active', 'client_id', 'manager_user_id',
      'start_date', 'end_date', 'description', 'created_at', 'updated_at',
    ]);

  return { before, after };
}

export async function archiveProject(
  projectId: number,
): Promise<{ project: ProjectListRow; activeTaskCount: number } | null> {
  const project = await db<ProjectListRow>('projects').where('id', projectId).first();
  if (!project) return null;

  // Count active tasks before archiving (for warning)
  const [{ count }] = await db('tasks')
    .where('project_id', projectId)
    .count<{ count: string }[]>('id as count');

  const activeTaskCount = parseInt(count, 10);

  // Soft delete: set is_active = false
  const [archived] = await db<ProjectListRow>('projects')
    .where('id', projectId)
    .update({ is_active: false, updated_at: db.fn.now() })
    .returning([
      'id', 'name', 'is_active', 'client_id', 'manager_user_id',
      'start_date', 'end_date', 'description', 'created_at', 'updated_at',
    ]);

  // Remove this project from all permission_flags.scoped_project_ids (jsonb array) entries
  await db.raw(
    `UPDATE permission_flags
     SET scoped_project_ids = (
       SELECT COALESCE(jsonb_agg(elem), '[]'::jsonb)
       FROM jsonb_array_elements(scoped_project_ids) AS t(elem)
       WHERE elem::text::integer != ?
     )
     WHERE scoped_project_ids @> ?::jsonb`,
    [projectId, JSON.stringify([projectId])],
  );

  return { project: archived, activeTaskCount };
}
