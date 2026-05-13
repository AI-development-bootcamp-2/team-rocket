import axiosClient from './axiosClient';
import type {
  ProjectEnvelopeResponse,
  ProjectListResponse,
  ProjectMutationResponse,
  ProjectWritePayload,
} from './contracts';

interface ListProjectsParams {
  clientId?: number;
  isActive?: boolean;
}

export async function listProjects({ clientId, isActive }: ListProjectsParams = {}): Promise<ProjectListResponse> {
  const params = new URLSearchParams();
  if (clientId != null) params.set('client_id', String(clientId));
  if (isActive != null) params.set('is_active', String(isActive));
  const query = params.toString();
  const response = await axiosClient.get<ProjectListResponse>(`/projects${query ? `?${query}` : ''}`);
  return response.data;
}

export async function getProject(id: number): Promise<ProjectEnvelopeResponse> {
  const response = await axiosClient.get<ProjectEnvelopeResponse>(`/projects/${id}`);
  return response.data;
}

export async function createProject(payload: ProjectWritePayload): Promise<ProjectMutationResponse> {
  const response = await axiosClient.post<ProjectMutationResponse>('/projects', payload);
  return response.data;
}

export async function updateProject(id: number, payload: ProjectWritePayload): Promise<ProjectEnvelopeResponse> {
  const response = await axiosClient.put<ProjectEnvelopeResponse>(`/projects/${id}`, payload);
  return response.data;
}

export async function archiveProject(id: number): Promise<ProjectMutationResponse> {
  const response = await axiosClient.delete<ProjectMutationResponse>(`/projects/${id}`);
  return response.data;
}
