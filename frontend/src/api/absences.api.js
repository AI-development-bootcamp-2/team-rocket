import axiosClient from './axiosClient';

export async function listAbsences({ userId, month, dateFrom, dateTo, type } = {}) {
  const params = new URLSearchParams();

  if (userId) params.set('user_id', String(userId));
  if (month) params.set('month', month);
  if (dateFrom) params.set('date_from', dateFrom);
  if (dateTo) params.set('date_to', dateTo);
  if (type) params.set('type', type);

  const query = params.toString();
  const response = await axiosClient.get(`/absences${query ? `?${query}` : ''}`);
  return response.data;
}

export async function createAbsence(payload) {
  const response = await axiosClient.post('/absences', payload);
  return response.data;
}

export async function uploadAbsenceDocument(absenceId, file) {
  const formData = new FormData();
  formData.append('file', file);

  const response = await axiosClient.post(`/absences/${absenceId}/documents`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });

  return response.data;
}
