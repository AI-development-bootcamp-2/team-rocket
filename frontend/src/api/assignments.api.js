import axiosClient from './axiosClient';

export async function listAssignments({ projectId, userId } = {}) {
  const params = new URLSearchParams();
  if (projectId != null) params.set('project_id', String(projectId));
  if (userId != null) params.set('user_id', String(userId));
  const query = params.toString();
  const response = await axiosClient.get(`/assignments${query ? `?${query}` : ''}`);
  return response.data;
}

export async function createAssignment(payload) {
  const response = await axiosClient.post('/assignments', payload);
  return response.data;
}

export async function toggleAssignment(id, isActive) {
  const response = await axiosClient.put(`/assignments/${id}`, { is_active: isActive });
  return response.data;
}

export async function getMyPermissions() {
  const response = await axiosClient.get('/users/me/permissions');
  return response.data;
}
