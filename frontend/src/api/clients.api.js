import axiosClient from './axiosClient';

export async function listClients({ isActive } = {}) {
  const params = new URLSearchParams();
  if (isActive != null) params.set('is_active', String(isActive));
  const query = params.toString();
  const response = await axiosClient.get(`/clients${query ? `?${query}` : ''}`);
  return response.data;
}

export async function createClient({ name, contact_info, is_active } = {}) {
  const response = await axiosClient.post('/clients', {
    name,
    contact_info: contact_info ?? null,
    is_active: is_active ?? true,
  });
  return response.data;
}

export async function updateClient(id, { name, contact_info, is_active } = {}) {
  const response = await axiosClient.put(`/clients/${id}`, {
    name,
    contact_info: contact_info ?? null,
    is_active,
  });
  return response.data;
}

export async function archiveClient(id) {
  const response = await axiosClient.delete(`/clients/${id}`);
  return response.data;
}
