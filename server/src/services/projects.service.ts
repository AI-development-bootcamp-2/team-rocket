import type { Knex } from 'knex';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const db = require('../database/connection') as Knex;

export interface ProjectListRow {
  id: number;
  name: string;
  is_active: boolean;
  client_id: number;
}

export async function listProjectsForAdmin(filters: {
  isActive?: boolean;
} = {}): Promise<ProjectListRow[]> {
  const query = db<ProjectListRow>('projects')
    .select('id', 'name', 'is_active', 'client_id')
    .orderBy('name', 'asc');

  if (typeof filters.isActive === 'boolean') {
    query.where({ is_active: filters.isActive });
  }

  return query;
}
