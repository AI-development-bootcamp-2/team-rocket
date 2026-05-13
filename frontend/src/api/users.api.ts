import axiosClient from './axiosClient';
import type {
  CreatePermissionFlagPayload,
  CreateUserPayload,
  PermissionFlag,
  PermissionFlagListResponse,
  ProjectRecord,
  ResetPasswordPayload,
  UpdateUserPayload,
  UserListItem,
  UserListResponse,
} from './contracts';

interface ListUsersParams {
  search?: string;
  role?: 'admin' | 'user' | 'all';
  isActive?: 'active' | 'inactive' | 'all';
}

export async function listUsers({ search, role, isActive }: ListUsersParams = {}): Promise<UserListResponse> {
  const params = new URLSearchParams();

  if (search) params.set('search', search);
  if (role && role !== 'all') params.set('role', role);
  if (isActive && isActive !== 'all') params.set('is_active', String(isActive === 'active'));

  const query = params.toString();
  const response = await axiosClient.get<UserListResponse>(`/users${query ? `?${query}` : ''}`);
  return response.data;
}

export async function createUser(payload: CreateUserPayload): Promise<UserListItem> {
  const response = await axiosClient.post<UserListItem>('/users', payload);
  return response.data;
}

export async function updateUser(userId: number, payload: UpdateUserPayload): Promise<UserListItem> {
  const response = await axiosClient.put<UserListItem>(`/users/${userId}`, payload);
  return response.data;
}

export async function deactivateUser(userId: number): Promise<null> {
  await axiosClient.delete(`/users/${userId}`);
  return null;
}

export async function resetUserPassword(
  userId: number,
  payload: ResetPasswordPayload,
): Promise<Record<string, unknown>> {
  const response = await axiosClient.post<Record<string, unknown>>(`/users/${userId}/reset-password`, payload);
  return response.data;
}

export async function listPermissionFlags(userId: number): Promise<PermissionFlagListResponse> {
  const response = await axiosClient.get<PermissionFlagListResponse>(`/users/${userId}/permissions`);
  return response.data;
}

export async function createPermissionFlag(
  userId: number,
  payload: CreatePermissionFlagPayload,
): Promise<PermissionFlag> {
  const response = await axiosClient.post<PermissionFlag>(`/users/${userId}/permissions`, payload);
  return response.data;
}

export async function deletePermissionFlag(userId: number, flagId: number): Promise<null> {
  await axiosClient.delete(`/users/${userId}/permissions/${flagId}`);
  return null;
}

interface ListProjectsParams {
  isActive?: boolean;
}

export async function listProjects({ isActive = true }: ListProjectsParams = {}): Promise<ProjectRecord[]> {
  const params = new URLSearchParams();
  params.set('is_active', String(isActive));
  const response = await axiosClient.get<ProjectRecord[]>(`/projects?${params.toString()}`);
  return response.data;
}
