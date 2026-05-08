import axiosClient from './axiosClient';

export async function listProjects({ clientId, isActive } = {}) {
  const params = new URLSearchParams();
  if (clientId != null) params.set('client_id', String(clientId));
  if (isActive != null) params.set('is_active', String(isActive));
  const query = params.toString();
  const response = await axiosClient.get(`/projects${query ? `?${query}` : ''}`);
  return response.data;
}

export async function getProject(id) {
  const response = await axiosClient.get(`/projects/${id}`);
  return response.data;
}

export async function createProject(payload) {
  const response = await axiosClient.post('/projects', payload);
  return response.data;
}

export async function updateProject(id, payload) {
  const response = await axiosClient.put(`/projects/${id}`, payload);
  return response.data;
}

export async function archiveProject(id) {
  const response = await axiosClient.delete(`/projects/${id}`);
  return response.data;
}
