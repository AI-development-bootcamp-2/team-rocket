import type { Knex } from 'knex';
import { AppError } from '../middleware/error.middleware';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const db = require('../database/connection') as Knex;

export interface PermissionFlagRow {
  id: number;
  user_id: number;
  flag_name: string;
  scoped_project_ids: number[] | null;
  granted_by: number | null;
  created_at: Date;
}

export async function listPermissionFlagsForUser(userId: number): Promise<PermissionFlagRow[]> {
  return db<PermissionFlagRow>('permission_flags')
    .select('id', 'user_id', 'flag_name', 'scoped_project_ids', 'granted_by', 'created_at')
    .where({ user_id: userId })
    .orderBy('id', 'asc');
}

export async function createPermissionFlag(params: {
  userId: number;
  grantedBy: number;
  flagName: 'canAssignProjectTasks';
  scopedProjectIds: number[];
}): Promise<PermissionFlagRow> {
  const [row] = (await db('permission_flags')
    .insert({
      user_id: params.userId,
      granted_by: params.grantedBy,
      flag_name: params.flagName,
      scoped_project_ids: JSON.stringify(params.scopedProjectIds),
    })
    .returning([
      'id',
      'user_id',
      'flag_name',
      'scoped_project_ids',
      'granted_by',
      'created_at',
    ])) as PermissionFlagRow[];

  return row;
}

export async function deletePermissionFlag(userId: number, flagId: number): Promise<PermissionFlagRow> {
  const [row] = (await db('permission_flags')
    .where({ id: flagId, user_id: userId })
    .del()
    .returning([
      'id',
      'user_id',
      'flag_name',
      'scoped_project_ids',
      'granted_by',
      'created_at',
    ])) as PermissionFlagRow[];

  if (!row) {
    throw new AppError('Permission flag not found', 404);
  }

  return row;
}

export async function assertUserExists(userId: number): Promise<void> {
  const user = await db('users').where({ id: userId }).select('id').first();
  if (!user) {
    throw new AppError('User not found', 404);
  }
}

export async function assertActiveProjectsExist(projectIds: number[]): Promise<void> {
  if (projectIds.length === 0) {
    return;
  }

  const rows = (await db('projects')
    .whereIn('id', projectIds)
    .andWhere({ is_active: true })
    .select('id')) as Array<{ id: number }>;

  if (rows.length !== projectIds.length) {
    throw new AppError('scoped_project_ids must contain only valid active projects', 400);
  }
}

export function parseFlagName(rawValue: unknown): 'canAssignProjectTasks' {
  if (rawValue !== 'canAssignProjectTasks') {
    throw new AppError('flag_name must be canAssignProjectTasks', 400);
  }
  return rawValue;
}

export function parseScopedProjectIds(rawValue: unknown): number[] {
  if (!Array.isArray(rawValue)) {
    throw new AppError('scoped_project_ids must be an array', 400);
  }

  const parsed = rawValue.map((value) => {
    if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
      throw new AppError('scoped_project_ids must contain positive integer project IDs', 400);
    }
    return value;
  });

  return [...new Set(parsed)];
}
