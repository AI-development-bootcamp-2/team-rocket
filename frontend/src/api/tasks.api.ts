// @ts-nocheck
import axiosClient from './axiosClient';

export async function listTasks({ projectId, status } = {}) {
  const params = new URLSearchParams();
  if (projectId != null) params.set('project_id', String(projectId));
  if (status != null) params.set('status', String(status));
  const query = params.toString();
  const response = await axiosClient.get(`/tasks${query ? `?${query}` : ''}`);
  return response.data;
}

export async function getTask(id) {
  const response = await axiosClient.get(`/tasks/${id}`);
  return response.data;
}

export async function createTask(payload) {
  const response = await axiosClient.post('/tasks', payload);
  return response.data;
}

export async function updateTask(id, payload) {
  const response = await axiosClient.put(`/tasks/${id}`, payload);
  return response.data;
}

export async function archiveTask(id) {
  const response = await axiosClient.delete(`/tasks/${id}`);
  return response.data;
}

