import axiosClient from './axiosClient';
import type { AdminDashboardResponse } from './contracts';

interface GetAdminDashboardParams {
  year?: number;
  month?: number;
}

export async function getAdminDashboard({ year, month }: GetAdminDashboardParams = {}): Promise<AdminDashboardResponse> {
  const params = new URLSearchParams();

  if (year != null) params.set('year', String(year));
  if (month != null) params.set('month', String(month));

  const query = params.toString();
  const response = await axiosClient.get<AdminDashboardResponse>(`/admin/dashboard${query ? `?${query}` : ''}`);
  return response.data;
}
