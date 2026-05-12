import axiosClient from './axiosClient';

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
