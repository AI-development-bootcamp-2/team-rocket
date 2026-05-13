import axiosClient from './axiosClient';

export async function getDailySummary({ date, userId } = {}) {
  const params = new URLSearchParams();
  if (date) params.set('date', date);
  if (userId) params.set('user_id', userId);
  const query = params.toString();
  const response = await axiosClient.get(`/time-entries/daily-summary${query ? `?${query}` : ''}`);
  return response.data;
}

export async function getDropdownData() {
  const response = await axiosClient.get('/time-entries/dropdown-data');
  return response.data;
}

export async function listTimeEntries({ date, userId, week, month } = {}) {
  const params = new URLSearchParams();
  if (date) params.set('date', date);
  if (userId) params.set('user_id', userId);
  if (week) params.set('week', week);
  if (month) params.set('month', month);
  const query = params.toString();
  const response = await axiosClient.get(`/time-entries${query ? `?${query}` : ''}`);
  return response.data;
}

export async function createTimeEntry(payload) {
  const response = await axiosClient.post('/time-entries', payload);
  return response.data;
}

export async function updateTimeEntry(id, payload) {
  const response = await axiosClient.put(`/time-entries/${id}`, payload);
  return response.data;
}

export async function deleteTimeEntry(id) {
  await axiosClient.delete(`/time-entries/${id}`);
  return null;
}

export async function getMonthlySummary({ year, month } = {}) {
  const response = await axiosClient.get('/monthly-summary', { params: { year, month } });
  return response.data;
}
