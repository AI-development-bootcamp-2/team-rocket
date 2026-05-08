import axiosClient from './axiosClient';

export async function listClients({ isActive } = {}) {
  const params = new URLSearchParams();
  if (isActive != null) params.set('is_active', String(isActive));
  const query = params.toString();
  const response = await axiosClient.get(`/clients${query ? `?${query}` : ''}`);
  return response.data;
}
