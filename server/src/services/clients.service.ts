/**
 * Client management data access (F05).
 * Two list flavours: an unscoped admin list, and a user-scoped list whose
 * visibility is derived from the assignment chain
 * user_task_assignments → tasks → projects → clients.
 */
import type { Knex } from 'knex';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const db = require('../database/connection') as Knex;

export interface ClientRow {
  id: number;
  client_number: string | null;
  name: string;
  contact_info: string | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

const CLIENT_COLUMNS = [
  'id',
  'client_number',
  'name',
  'contact_info',
  'is_active',
  'created_at',
  'updated_at',
] as const;

const CLIENT_ORDER: ReadonlyArray<{ column: string; order: 'asc' }> = [
  { column: 'name', order: 'asc' },
  { column: 'id', order: 'asc' },
];

/** Returns every client row, including archived ones — admin-only view. */
export async function listAllClients(): Promise<ClientRow[]> {
  return db<ClientRow>('clients')
    .select(...CLIENT_COLUMNS)
    .orderBy([...CLIENT_ORDER]);
}

/**
 * Returns the clients that `userId` can reach through an active task
 * assignment. DISTINCT is required because a single user can be assigned to
 * multiple tasks belonging to the same client.
 */
export async function listClientsForUser(userId: number): Promise<ClientRow[]> {
  const rows = await db('clients as c')
    .distinct(CLIENT_COLUMNS.map((col) => `c.${col}`))
    .innerJoin('projects as p', 'p.client_id', 'c.id')
    .innerJoin('tasks as t', 't.project_id', 'p.id')
    .innerJoin('user_task_assignments as uta', 'uta.task_id', 't.id')
    .where('uta.user_id', userId)
    .where('uta.is_active', true)
    .orderBy(CLIENT_ORDER.map((o) => ({ ...o, column: `c.${o.column}` })));
  return rows as ClientRow[];
}
