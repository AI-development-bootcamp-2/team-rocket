import axiosClient from './axiosClient';

export interface AuditLogEntry {
  id: number;
  actor_user_id: number | null;
  target_entity_type: string;
  target_entity_id: number | null;
  action: string;
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  reason: string | null;
  timestamp: string;
  ip_address: string | null;
}

export interface AuditLogsResponse {
  data: AuditLogEntry[];
  total: number;
  page: number;
  limit: number;
}

export interface AuditLogsFilters {
  entity_type?: string;
  user_id?: string | number;
  action?: string;
  date_from?: string;
  date_to?: string;
  page?: number;
  limit?: number;
}

export async function listAuditLogs(filters: AuditLogsFilters = {}): Promise<AuditLogsResponse> {
  const params = new URLSearchParams();

  if (filters.entity_type) params.set('entity_type', filters.entity_type);
  if (filters.user_id) params.set('user_id', String(filters.user_id));
  if (filters.action) params.set('action', filters.action);
  if (filters.date_from) params.set('date_from', filters.date_from);
  if (filters.date_to) params.set('date_to', filters.date_to);
  params.set('page', String(filters.page ?? 1));
  params.set('limit', String(filters.limit ?? 25));

  const response = await axiosClient.get<AuditLogsResponse>(`/audit-logs?${params.toString()}`);
  return response.data;
}
