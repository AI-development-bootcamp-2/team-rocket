import axiosClient from './axiosClient';
import type {
  ClientListResponse,
  ClientMutationResponse,
  ClientRecord,
  ClientWritePayload,
} from './contracts';

interface ListClientsParams {
  isActive?: boolean;
}

export async function listClients({ isActive }: ListClientsParams = {}): Promise<ClientListResponse> {
  const params = new URLSearchParams();
  if (isActive != null) params.set('is_active', String(isActive));
  const query = params.toString();
  const response = await axiosClient.get<ClientListResponse>(`/clients${query ? `?${query}` : ''}`);
  return response.data;
}

export async function createClient({ name, contact_info, is_active }: ClientWritePayload): Promise<ClientMutationResponse> {
  const response = await axiosClient.post<ClientMutationResponse>('/clients', {
    name,
    contact_info: contact_info ?? null,
    is_active: is_active ?? true,
  });
  return response.data;
}

export async function updateClient(id: number, { name, contact_info, is_active }: ClientWritePayload): Promise<ClientRecord> {
  const response = await axiosClient.put<ClientRecord>(`/clients/${id}`, {
    name,
    contact_info: contact_info ?? null,
    is_active,
  });
  return response.data;
}

export async function archiveClient(id: number): Promise<ClientMutationResponse> {
  const response = await axiosClient.delete<ClientMutationResponse>(`/clients/${id}`);
  return response.data;
}
