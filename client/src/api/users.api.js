const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001'

function getAccessToken() {
  return window.localStorage.getItem('accessToken')
}

async function request(path, options = {}) {
  const headers = new Headers(options.headers ?? {})
  headers.set('Content-Type', 'application/json')

  const token = getAccessToken()
  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
    credentials: 'include',
  })

  if (response.status === 204) {
    return null
  }

  const payload = await response.json().catch(() => ({}))

  if (!response.ok) {
    const error = new Error(payload.error ?? 'Request failed')
    error.status = response.status
    error.payload = payload
    throw error
  }

  return payload
}

export function listUsers({ search, role, isActive }) {
  const params = new URLSearchParams()
  if (search) params.set('search', search)
  if (role && role !== 'all') params.set('role', role)
  if (isActive && isActive !== 'all') params.set('is_active', String(isActive === 'active'))
  const query = params.toString()
  return request(`/users${query ? `?${query}` : ''}`)
}

export function getCurrentUser() {
  return request('/users/me')
}

export function createUser(payload) {
  return request('/users', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function updateUser(userId, payload) {
  return request(`/users/${userId}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

export function deactivateUser(userId) {
  return request(`/users/${userId}`, {
    method: 'DELETE',
  })
}

export function resetUserPassword(userId, payload) {
  return request(`/users/${userId}/reset-password`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function listPermissionFlags(userId) {
  return request(`/users/${userId}/permissions`)
}

export function createPermissionFlag(userId, payload) {
  return request(`/users/${userId}/permissions`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function deletePermissionFlag(userId, flagId) {
  return request(`/users/${userId}/permissions/${flagId}`, {
    method: 'DELETE',
  })
}

export function listProjects({ isActive = true } = {}) {
  const params = new URLSearchParams()
  params.set('is_active', String(isActive))
  return request(`/projects?${params.toString()}`)
}
