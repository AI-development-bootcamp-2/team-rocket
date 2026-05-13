import axiosClient from './axiosClient';
import type { TaskRecord } from './contracts';

interface ListTasksParams {
  projectId?: number;
  status?: string;
}

export async function listTasks({ projectId, status }: ListTasksParams = {}): Promise<TaskRecord[]> {
  const params = new URLSearchParams();
  if (projectId != null) params.set('project_id', String(projectId));
  if (status != null) params.set('status', String(status));
  const query = params.toString();
  const response = await axiosClient.get<TaskRecord[]>(`/tasks${query ? `?${query}` : ''}`);
  return response.data;
}

export async function getTask(id: number): Promise<TaskRecord> {
  const response = await axiosClient.get<TaskRecord>(`/tasks/${id}`);
  return response.data;
}

export async function createTask(payload: Record<string, unknown>): Promise<TaskRecord> {
  const response = await axiosClient.post<TaskRecord>('/tasks', payload);
  return response.data;
}

export async function updateTask(id: number, payload: Record<string, unknown>): Promise<TaskRecord> {
  const response = await axiosClient.put<TaskRecord>(`/tasks/${id}`, payload);
  return response.data;
}

export async function archiveTask(id: number): Promise<TaskRecord> {
  const response = await axiosClient.delete<TaskRecord>(`/tasks/${id}`);
  return response.data;
}
