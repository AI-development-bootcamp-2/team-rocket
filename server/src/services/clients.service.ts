/**
 * Client management data access (F05).
 * Two list flavours: an unscoped admin list, and a user-scoped list whose
 * visibility is derived from the assignment chain
 * user_task_assignments → tasks → projects → clients.
 */
import type { Knex } from 'knex';
import { AppError } from '../middleware/error.middleware';

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

const CLIENT_ORDER: Array<{ column: string; order: 'asc' }> = [
  { column: 'name', order: 'asc' },
  { column: 'id', order: 'asc' },
];

/** Returns every client row, including archived ones — admin-only view. */
export async function listAllClients(): Promise<ClientRow[]> {
  return db<ClientRow>('clients')
    .select(...CLIENT_COLUMNS)
    .orderBy(CLIENT_ORDER);
}

/**
 * Returns the active clients that `userId` can reach through an active task
 * assignment. Filters c.is_active=true so archived clients disappear from
 * user-facing dropdowns immediately after archiving. DISTINCT is required
 * because a single user can be assigned to multiple tasks belonging to the
 * same client.
 */
export async function listClientsForUser(userId: number): Promise<ClientRow[]> {
  const rows = await db('clients as c')
    .distinct(CLIENT_COLUMNS.map((col) => `c.${col}`))
    .innerJoin('projects as p', 'p.client_id', 'c.id')
    .innerJoin('tasks as t', 't.project_id', 'p.id')
    .innerJoin('user_task_assignments as uta', 'uta.task_id', 't.id')
    .where('uta.user_id', userId)
    .where('uta.is_active', true)
    .where('c.is_active', true)
    .orderBy(CLIENT_ORDER.map((o) => ({ ...o, column: `c.${o.column}` })));
  return rows as ClientRow[];
}

/** Returns one client by id, or undefined — no role scoping. Admin lookup. */
export async function findClientByIdForAdmin(id: number): Promise<ClientRow | undefined> {
  return db<ClientRow>('clients')
    .select(...CLIENT_COLUMNS)
    .where({ id })
    .first();
}

/**
 * Returns the client only if `userId` can reach it via an active task
 * assignment AND the client is active. Returning undefined on no-access lets
 * the controller respond with 404, which avoids leaking the existence of
 * clients the user can't see (including archived ones).
 */
export async function findClientByIdForUser(
  userId: number,
  clientId: number,
): Promise<ClientRow | undefined> {
  const row = await db('clients as c')
    .select(CLIENT_COLUMNS.map((col) => `c.${col}`))
    .innerJoin('projects as p', 'p.client_id', 'c.id')
    .innerJoin('tasks as t', 't.project_id', 'p.id')
    .innerJoin('user_task_assignments as uta', 'uta.task_id', 't.id')
    .where('c.id', clientId)
    .where('uta.user_id', userId)
    .where('uta.is_active', true)
    .where('c.is_active', true)
    .first();
  return row as ClientRow | undefined;
}

/** Parses the :id route param to a positive integer, or throws AppError(400). */
export function parseClientId(rawValue: string): number {
  const id = Number.parseInt(rawValue, 10);
  if (Number.isNaN(id) || id <= 0) {
    throw new AppError('Invalid client ID', 400);
  }
  return id;
}

/** Validates a required string field; trims whitespace; throws AppError(400) if missing or empty. */
export function parseRequiredText(rawValue: unknown, fieldName: string): string {
  if (typeof rawValue !== 'string' || rawValue.trim() === '') {
    throw new AppError(`${fieldName} is required`, 400);
  }
  return rawValue.trim();
}

/**
 * Validates an optional string. Returns undefined when absent (preserve
 * existing DB value on update), null for explicit empty string (clear the
 * field), or the trimmed string. Throws AppError(400) if a non-string is
 * supplied.
 */
export function parseOptionalText(rawValue: unknown): string | null | undefined {
  if (rawValue == null) return undefined;
  if (typeof rawValue !== 'string') throw new AppError('Invalid text field', 400);
  const trimmed = rawValue.trim();
  return trimmed === '' ? null : trimmed;
}

export interface CreateClientInput {
  name: string;
  contactInfo?: string | null;
  clientNumber?: string | null;
}

/**
 * Inserts a new client row inside a transaction so the duplicate-name check
 * and INSERT are atomic. Reports `nameDuplicate=true` when an *active* client
 * already shares the same name (case-insensitive) — the controller uses that
 * flag to attach a warning to the 201 response per spec §1.
 * Archived clients don't trigger the warning since reusing a freed name is
 * normal. Duplicate `client_number` raises Postgres 23505 → AppError(409).
 */
export async function createClientForAdmin(
  input: CreateClientInput,
): Promise<{ client: ClientRow; nameDuplicate: boolean }> {
  return db.transaction(async (trx: Knex.Transaction) => {
    const dup = await trx<ClientRow>('clients')
      .select('id')
      .whereRaw('LOWER(name) = LOWER(?)', [input.name])
      .where({ is_active: true })
      .first();

    try {
      const [row] = (await trx('clients')
        .insert({
          name: input.name,
          client_number: input.clientNumber ?? null,
          contact_info: input.contactInfo ?? null,
          is_active: true,
          created_at: new Date(),
          updated_at: new Date(),
        })
        .returning([...CLIENT_COLUMNS])) as ClientRow[];

      return { client: row, nameDuplicate: !!dup };
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new AppError('client_number already exists', 409);
      }
      throw error;
    }
  });
}

/** Coerces a boolean field; throws AppError(400) on a non-boolean non-null value. */
export function parseOptionalBoolean(rawValue: unknown, fieldName: string): boolean | undefined {
  if (rawValue == null) return undefined;
  if (typeof rawValue !== 'boolean') throw new AppError(`${fieldName} must be a boolean`, 400);
  return rawValue;
}

export interface UpdateClientInput {
  name?: string;
  contactInfo?: string | null;
  clientNumber?: string | null;
  isActive?: boolean;
}

/**
 * Applies a partial update inside a transaction with a row-level lock so
 * concurrent admin requests can't produce a stale audit `before` snapshot.
 * Fields that are `undefined` in `input` are preserved from the locked row;
 * `null` (where the schema allows it) clears the field. Touches `updated_at`
 * on every successful update. Returns both the before and after rows so the
 * caller can write a diff to the audit log.
 */
export async function updateClientForAdmin(
  id: number,
  input: UpdateClientInput,
): Promise<{ before: ClientRow; after: ClientRow }> {
  return db.transaction(async (trx: Knex.Transaction) => {
    const existing = await trx<ClientRow>('clients')
      .select(...CLIENT_COLUMNS)
      .where({ id })
      .forUpdate()
      .first();

    if (!existing) {
      throw new AppError('Client not found', 404);
    }

    try {
      const [updated] = (await trx('clients')
        .where({ id })
        .update({
          name: input.name === undefined ? existing.name : input.name,
          client_number:
            input.clientNumber === undefined ? existing.client_number : input.clientNumber,
          contact_info:
            input.contactInfo === undefined ? existing.contact_info : input.contactInfo,
          is_active: input.isActive === undefined ? existing.is_active : input.isActive,
          updated_at: new Date(),
        })
        .returning([...CLIENT_COLUMNS])) as ClientRow[];

      if (!updated) {
        throw new AppError('Client not found', 404);
      }

      return { before: existing, after: updated };
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new AppError('client_number already exists', 409);
      }
      throw error;
    }
  });
}

/**
 * Soft-deletes a client inside a transaction with a row-level lock. Counts
 * the client's active projects *within the same transaction* so the warning
 * count is consistent with the row being archived. Returns the count so the
 * controller can build the warning string. Idempotent: archiving an already-
 * archived client succeeds (matches F04's deactivateUserForAdmin).
 */
export async function deactivateClientForAdmin(
  id: number,
): Promise<{ before: ClientRow; after: ClientRow; activeProjectCount: number }> {
  return db.transaction(async (trx: Knex.Transaction) => {
    const existing = await trx<ClientRow>('clients')
      .select(...CLIENT_COLUMNS)
      .where({ id })
      .forUpdate()
      .first();

    if (!existing) {
      throw new AppError('Client not found', 404);
    }

    const projectCountResult = await trx('projects')
      .where({ client_id: id, is_active: true })
      .count<{ count: string | number }>('* as count')
      .first();
    const activeProjectCount = Number(projectCountResult?.count ?? 0);

    const [updated] = (await trx('clients')
      .where({ id })
      .update({
        is_active: false,
        updated_at: new Date(),
      })
      .returning([...CLIENT_COLUMNS])) as ClientRow[];

    return { before: existing, after: updated, activeProjectCount };
  });
}

/** Normalises a client row to the JSON shape stored in audit_logs.new_value / old_value. */
export function toAuditClientValue(client: ClientRow): Record<string, unknown> {
  return {
    id: client.id,
    clientNumber: client.client_number,
    name: client.name,
    contactInfo: client.contact_info,
    isActive: client.is_active,
  };
}

/** True iff `error` is the Postgres unique_violation (SQLSTATE 23505). */
function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === '23505'
  );
}
