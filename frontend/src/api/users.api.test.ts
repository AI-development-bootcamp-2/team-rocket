// @ts-nocheck
import axiosClient from './axiosClient';
import {
  listUsers,
  createUser,
  updateUser,
  deactivateUser,
  resetUserPassword,
  listPermissionFlags,
  createPermissionFlag,
  deletePermissionFlag,
  listProjects,
} from './users.api';

jest.mock('./axiosClient', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  },
}));

describe('users.api', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('builds listUsers query params correctly', async () => {
    axiosClient.get.mockResolvedValue({ data: { data: [] } });

    await listUsers({ search: 'ada', role: 'admin', isActive: 'active' });
    await listUsers({ search: '', role: 'all', isActive: 'all' });

    expect(axiosClient.get).toHaveBeenNthCalledWith(1, '/users?search=ada&role=admin&is_active=true');
    expect(axiosClient.get).toHaveBeenNthCalledWith(2, '/users');
  });

  it('posts and returns createUser payloads', async () => {
    axiosClient.post.mockResolvedValue({ data: { id: 7 } });

    await expect(createUser({ email: 'user@test.com' })).resolves.toEqual({ id: 7 });
    expect(axiosClient.post).toHaveBeenCalledWith('/users', { email: 'user@test.com' });
  });

  it('updates and deactivates users', async () => {
    axiosClient.put.mockResolvedValue({ data: { id: 8 } });
    axiosClient.delete.mockResolvedValue({});

    await expect(updateUser(8, { first_name: 'Ada' })).resolves.toEqual({ id: 8 });
    await expect(deactivateUser(8)).resolves.toBeNull();

    expect(axiosClient.put).toHaveBeenCalledWith('/users/8', { first_name: 'Ada' });
    expect(axiosClient.delete).toHaveBeenCalledWith('/users/8');
  });

  it('manages password reset and permission flag endpoints', async () => {
    axiosClient.post
      .mockResolvedValueOnce({ data: { temporaryPassword: 'Temp123!' } })
      .mockResolvedValueOnce({ data: { id: 3 } });
    axiosClient.get.mockResolvedValue({ data: { data: [{ id: 4 }] } });
    axiosClient.delete.mockResolvedValue({});

    await expect(resetUserPassword(5, { temporary_password: 'Temp123!' })).resolves.toEqual({
      temporaryPassword: 'Temp123!',
    });
    await expect(listPermissionFlags(5)).resolves.toEqual({ data: [{ id: 4 }] });
    await expect(createPermissionFlag(5, { flag_name: 'canAssignProjectTasks' })).resolves.toEqual({ id: 3 });
    await expect(deletePermissionFlag(5, 3)).resolves.toBeNull();

    expect(axiosClient.post).toHaveBeenNthCalledWith(1, '/users/5/reset-password', {
      temporary_password: 'Temp123!',
    });
    expect(axiosClient.get).toHaveBeenCalledWith('/users/5/permissions');
    expect(axiosClient.post).toHaveBeenNthCalledWith(2, '/users/5/permissions', {
      flag_name: 'canAssignProjectTasks',
    });
    expect(axiosClient.delete).toHaveBeenCalledWith('/users/5/permissions/3');
  });

  it('requests projects with the active filter', async () => {
    axiosClient.get.mockResolvedValue({ data: { data: [] } });

    await listProjects();
    await listProjects({ isActive: false });

    expect(axiosClient.get).toHaveBeenNthCalledWith(1, '/projects?is_active=true');
    expect(axiosClient.get).toHaveBeenNthCalledWith(2, '/projects?is_active=false');
  });
});


