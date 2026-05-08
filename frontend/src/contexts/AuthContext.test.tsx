import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from './AuthContext';
import axiosClient, { setInactivityResetFn, tokenStore } from '../api/axiosClient';

jest.mock('../api/axiosClient', () => ({
  __esModule: true,
  default: {
    post: jest.fn(),
    get: jest.fn(),
  },
  tokenStore: {
    get: jest.fn(),
    set: jest.fn(),
  },
  setInactivityResetFn: jest.fn(),
}));

function makeToken(expOffsetSeconds = 3600) {
  const payload = btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + expOffsetSeconds }));
  return `header.${payload}.signature`;
}

function Consumer() {
  const auth = useAuth();

  return (
    <div>
      <div data-testid="auth-state">{auth.isAuthenticated ? auth.user?.fullName : 'guest'}</div>
      <div data-testid="must-change">{String(auth.user?.mustChangePassword ?? false)}</div>
      <div data-testid="warning">{String(auth.showInactivityWarning)}</div>
      <button onClick={() => auth.login('ada@test.com', 'Password1!', true)}>login</button>
      <button onClick={() => auth.logout()}>logout</button>
      <button onClick={() => auth.clearMustChangePassword()}>clear-password-flag</button>
      <button onClick={() => auth.continueSession()}>continue-session</button>
    </div>
  );
}

describe('AuthContext', () => {
  const mockedAxios = axiosClient as jest.Mocked<typeof axiosClient>;
  const mockedTokenStore = tokenStore as jest.Mocked<typeof tokenStore>;
  const mockedSetInactivityResetFn = setInactivityResetFn as jest.MockedFunction<typeof setInactivityResetFn>;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('bootstraps from refresh and loads the current user', async () => {
    mockedAxios.post.mockResolvedValueOnce({ data: { accessToken: makeToken() } } as never);
    mockedAxios.get.mockResolvedValueOnce({
      data: {
        id: 1,
        firstName: 'Ada',
        lastName: 'Lovelace',
        email: 'ada@test.com',
        role: 'admin',
        mustChangePassword: false,
      },
    } as never);

    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('auth-state')).toHaveTextContent('Ada Lovelace'));
    expect(mockedTokenStore.set).toHaveBeenCalledWith(expect.any(String));
    expect(mockedSetInactivityResetFn).toHaveBeenCalledWith(expect.any(Function));
  });

  it('logs in, persists remembered email, clears the password flag, and logs out', async () => {
    mockedAxios.post
      .mockRejectedValueOnce(new Error('no session') as never)
      .mockResolvedValueOnce({
        data: {
          accessToken: makeToken(),
          user: {
            id: 2,
            firstName: 'Grace',
            lastName: 'Hopper',
            email: 'ada@test.com',
            role: 'user',
            mustChangePassword: true,
          },
        },
      } as never)
      .mockResolvedValueOnce({} as never);

    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>,
    );

    fireEvent.click(screen.getByText('login'));
    await waitFor(() => expect(screen.getByTestId('auth-state')).toHaveTextContent('Grace Hopper'));
    expect(localStorage.getItem('rememberedEmail')).toBe('ada@test.com');
    expect(screen.getByTestId('must-change')).toHaveTextContent('true');

    fireEvent.click(screen.getByText('clear-password-flag'));
    expect(screen.getByTestId('must-change')).toHaveTextContent('false');

    fireEvent.click(screen.getByText('logout'));
    await waitFor(() => expect(screen.getByTestId('auth-state')).toHaveTextContent('guest'));
    expect(mockedTokenStore.set).toHaveBeenLastCalledWith(null);
  });

  it('shows the inactivity warning and auto-logs out after the timeout', async () => {
    const beforeAutoLogout = jest.fn();
    window.addEventListener('beforeAutoLogout', beforeAutoLogout);

    mockedAxios.post
      .mockResolvedValueOnce({ data: { accessToken: makeToken() } } as never)
      .mockResolvedValueOnce({} as never);
    mockedAxios.get.mockResolvedValueOnce({
      data: {
        id: 3,
        firstName: 'Linus',
        lastName: 'Torvalds',
        email: 'linus@test.com',
        role: 'user',
        mustChangePassword: false,
      },
    } as never);

    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>,
    );

    await screen.findByText('Linus Torvalds');

    await act(async () => {
      jest.advanceTimersByTime(28 * 60 * 1000);
    });
    expect(screen.getByTestId('warning')).toHaveTextContent('true');

    fireEvent.click(screen.getByText('continue-session'));
    expect(screen.getByTestId('warning')).toHaveTextContent('false');

    await act(async () => {
      jest.advanceTimersByTime(30 * 60 * 1000);
    });

    await waitFor(() => expect(screen.getByTestId('auth-state')).toHaveTextContent('guest'));
    expect(beforeAutoLogout).toHaveBeenCalled();
    window.removeEventListener('beforeAutoLogout', beforeAutoLogout);
  });
});
