import type { Knex } from 'knex';
import type { AuditEntityType, AuditAction } from './auth.service';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const db = require('../database/connection') as Knex;

// ── Row type ──────────────────────────────────────────────────────────────────

export interface AuditLogRow {
  id: number;
  actor_user_id: number | null;
  target_entity_type: AuditEntityType;
  target_entity_id: number | null;
  action: AuditAction;
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  reason: string | null;
  timestamp: string;
  ip_address: string | null;
}

// ── Filter / pagination types ─────────────────────────────────────────────────

export interface ListAuditLogsFilters {
  entity_type?: AuditEntityType;
  entity_id?: number;
  user_id?: number;
  action?: AuditAction;
  date_from?: string;
  date_to?: string;
}

export interface PaginationParams {
  page: number;
  limit: number;
}

export interface PaginatedAuditLogs {
  data: AuditLogRow[];
  total: number;
  page: number;
  limit: number;
}

// ── Query builder ─────────────────────────────────────────────────────────────

function buildBaseQuery(filters: ListAuditLogsFilters) {
  const q = db<AuditLogRow>('audit_logs');

  if (filters.entity_type !== undefined) {
    q.where('target_entity_type', filters.entity_type);
  }
  if (filters.entity_id !== undefined) {
    q.where('target_entity_id', filters.entity_id);
  }
  if (filters.user_id !== undefined) {
    q.where('actor_user_id', filters.user_id);
  }
  if (filters.action !== undefined) {
    q.where('action', filters.action);
  }
  if (filters.date_from !== undefined) {
    q.where('timestamp', '>=', filters.date_from);
  }
  if (filters.date_to !== undefined) {
    // date_to is inclusive: advance by one day and use strict less-than.
    const exclusive = new Date(filters.date_to);
    exclusive.setUTCDate(exclusive.getUTCDate() + 1);
    q.where('timestamp', '<', exclusive.toISOString().slice(0, 10));
  }

  return q;
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function listAuditLogs(
  filters: ListAuditLogsFilters,
  pagination: PaginationParams,
): Promise<PaginatedAuditLogs> {
  const { page, limit } = pagination;
  const offset = (page - 1) * limit;

  const countResult = await buildBaseQuery(filters)
    .count<{ count: string }>('* as count')
    .first();
  const total = parseInt(countResult?.count ?? '0', 10);

  const data = (await buildBaseQuery(filters)
    .orderBy('timestamp', 'desc')
    .limit(limit)
    .offset(offset)
    .select('*')) as AuditLogRow[];

  return { data, total, page, limit };
}
