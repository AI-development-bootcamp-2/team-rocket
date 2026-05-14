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

const mockedAxiosClient = axiosClient as jest.Mocked<typeof axiosClient>;

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
    mockedAxiosClient.get.mockResolvedValue({ data: { data: [] } });

    await listUsers({ search: 'ada', role: 'admin', isActive: 'active' });
    await listUsers({ search: '', role: 'all', isActive: 'all' });

    expect(mockedAxiosClient.get).toHaveBeenNthCalledWith(1, '/users?search=ada&role=admin&is_active=true');
    expect(mockedAxiosClient.get).toHaveBeenNthCalledWith(2, '/users');
  });

  it('posts and returns createUser payloads', async () => {
    mockedAxiosClient.post.mockResolvedValue({ data: { id: 7 } });

    const payload = {
      first_name: 'Ada',
      last_name: 'Lovelace',
      email: 'user@test.com',
      password: 'StrongPass1!',
      role: 'user' as const,
    };

    await expect(createUser(payload)).resolves.toEqual({ id: 7 });
    expect(mockedAxiosClient.post).toHaveBeenCalledWith('/users', payload);
  });

  it('updates and deactivates users', async () => {
    mockedAxiosClient.put.mockResolvedValue({ data: { id: 8 } });
    mockedAxiosClient.delete.mockResolvedValue({});

    const payload = {
      first_name: 'Ada',
      last_name: 'Lovelace',
      email: 'ada@test.com',
      role: 'user' as const,
    };

    await expect(updateUser(8, payload)).resolves.toEqual({ id: 8 });
    await expect(deactivateUser(8)).resolves.toBeNull();

    expect(mockedAxiosClient.put).toHaveBeenCalledWith('/users/8', payload);
    expect(mockedAxiosClient.delete).toHaveBeenCalledWith('/users/8');
  });

  it('manages password reset and permission flag endpoints', async () => {
    mockedAxiosClient.post
      .mockResolvedValueOnce({ data: { temporaryPassword: 'Temp123!' } })
      .mockResolvedValueOnce({ data: { id: 3 } });
    mockedAxiosClient.get.mockResolvedValue({ data: { data: [{ id: 4 }] } });
    mockedAxiosClient.delete.mockResolvedValue({});

    await expect(resetUserPassword(5, { temporary_password: 'Temp123!' })).resolves.toEqual({
      temporaryPassword: 'Temp123!',
    });
    await expect(listPermissionFlags(5)).resolves.toEqual({ data: [{ id: 4 }] });
    await expect(createPermissionFlag(5, { flag_name: 'canAssignProjectTasks' })).resolves.toEqual({ id: 3 });
    await expect(deletePermissionFlag(5, 3)).resolves.toBeNull();

    expect(mockedAxiosClient.post).toHaveBeenNthCalledWith(1, '/users/5/reset-password', {
      temporary_password: 'Temp123!',
    });
    expect(mockedAxiosClient.get).toHaveBeenCalledWith('/users/5/permissions');
    expect(mockedAxiosClient.post).toHaveBeenNthCalledWith(2, '/users/5/permissions', {
      flag_name: 'canAssignProjectTasks',
    });
    expect(mockedAxiosClient.delete).toHaveBeenCalledWith('/users/5/permissions/3');
  });

  it('requests projects with the active filter', async () => {
    mockedAxiosClient.get.mockResolvedValue({ data: [] });

    await listProjects();
    await listProjects({ isActive: false });

    expect(mockedAxiosClient.get).toHaveBeenNthCalledWith(1, '/projects?is_active=true');
    expect(mockedAxiosClient.get).toHaveBeenNthCalledWith(2, '/projects?is_active=false');
  });
});


