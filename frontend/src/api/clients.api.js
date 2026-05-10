import axiosClient from './axiosClient';

export async function listClients({ isActive } = {}) {
  const params = new URLSearchParams();
  if (isActive != null) params.set('is_active', String(isActive));
  const query = params.toString();
  const response = await axiosClient.get(`/clients${query ? `?${query}` : ''}`);
  return response.data;
}

// TEMP: backend POST /clients lives on branch `feat/F05-clients-backend` and is
// pending PR approval before it lands on `development`. Until that PR merges,
// this call will 404 — the create modal still renders for design review.
export async function createClient({ name, contact_info, client_number } = {}) {
  const response = await axiosClient.post('/clients', {
    name,
    contact_info: contact_info ?? null,
    client_number: client_number ?? null,
  });
  return response.data;
}
