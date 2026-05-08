import axiosClient from './axiosClient';

export async function listUsers({ search, role, isActive }) {
  const params = new URLSearchParams();

  if (search) params.set('search', search);
  if (role && role !== 'all') params.set('role', role);
  if (isActive && isActive !== 'all') params.set('is_active', String(isActive === 'active'));

  const query = params.toString();
  const response = await axiosClient.get(`/users${query ? `?${query}` : ''}`);
  return response.data;
}

export async function createUser(payload) {
  const response = await axiosClient.post('/users', payload);
  return response.data;
}

export async function updateUser(userId, payload) {
  const response = await axiosClient.put(`/users/${userId}`, payload);
  return response.data;
}

export async function deactivateUser(userId) {
  await axiosClient.delete(`/users/${userId}`);
  return null;
}

export async function resetUserPassword(userId, payload) {
  const response = await axiosClient.post(`/users/${userId}/reset-password`, payload);
  return response.data;
}

export async function listPermissionFlags(userId) {
  const response = await axiosClient.get(`/users/${userId}/permissions`);
  return response.data;
}

export async function createPermissionFlag(userId, payload) {
  const response = await axiosClient.post(`/users/${userId}/permissions`, payload);
  return response.data;
}

export async function deletePermissionFlag(userId, flagId) {
  await axiosClient.delete(`/users/${userId}/permissions/${flagId}`);
  return null;
}

export async function listProjects({ isActive = true } = {}) {
  const params = new URLSearchParams();
  params.set('is_active', String(isActive));
  const response = await axiosClient.get(`/projects?${params.toString()}`);
  return response.data;
}
