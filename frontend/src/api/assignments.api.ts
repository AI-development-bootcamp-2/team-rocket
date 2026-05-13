import axiosClient from './axiosClient';
import type {
  AssignmentListResponse,
  AssignmentMutationResponse,
  PermissionFlagListResponse,
} from './contracts';

interface ListAssignmentsParams {
  projectId?: number;
  userId?: number;
}

interface CreateAssignmentPayload {
  task_id: number;
  user_id: number;
}

export async function listAssignments(
  { projectId, userId }: ListAssignmentsParams = {},
): Promise<AssignmentListResponse> {
  const params = new URLSearchParams();
  if (projectId != null) params.set('project_id', String(projectId));
  if (userId != null) params.set('user_id', String(userId));
  const query = params.toString();
  const response = await axiosClient.get<AssignmentListResponse>(`/assignments${query ? `?${query}` : ''}`);
  return response.data;
}

export async function createAssignment(payload: CreateAssignmentPayload): Promise<AssignmentMutationResponse> {
  const response = await axiosClient.post<AssignmentMutationResponse>('/assignments', payload);
  return response.data;
}

export async function toggleAssignment(id: number, isActive: boolean): Promise<AssignmentMutationResponse> {
  const response = await axiosClient.put<AssignmentMutationResponse>(`/assignments/${id}`, { is_active: isActive });
  return response.data;
}

export async function getMyPermissions(): Promise<PermissionFlagListResponse> {
  const response = await axiosClient.get<PermissionFlagListResponse>('/users/me/permissions');
  return response.data;
}
