import axiosClient from './axiosClient';

export async function getAdminDashboard({ year, month } = {}) {
  const params = new URLSearchParams();

  if (year != null && year !== '') params.set('year', String(year));
  if (month != null && month !== '') params.set('month', String(month));

  const query = params.toString();
  const response = await axiosClient.get(`/admin/dashboard${query ? `?${query}` : ''}`);
  return response.data;
}
