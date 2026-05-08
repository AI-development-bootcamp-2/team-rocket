import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import axiosClient, { tokenStore, setInactivityResetFn } from '../api/axiosClient';

type Role = 'user' | 'admin';

interface ApiUser {
  id: number;
  firstName: string;
  lastName: string;
  email?: string;
  role: Role;
  mustChangePassword: boolean;
}

export interface User extends ApiUser {
  fullName: string;
}

interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string, password: string, rememberMe: boolean) => Promise<void>;
  logout: () => Promise<void>;
  clearMustChangePassword: () => void;
  showInactivityWarning: boolean;
  continueSession: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const INACTIVITY_MS = 30 * 60 * 1000;
const WARNING_BEFORE_MS = 2 * 60 * 1000;
const DEBOUNCE_MS = 10_000;

const normalizeUser = (user: ApiUser): User => ({
  ...user,
  fullName: [user.firstName, user.lastName].filter(Boolean).join(' '),
});

const getTokenExpiry = (token: string): number | null => {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.exp ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [showInactivityWarning, setShowWarning] = useState(false);

  const logoutTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warningTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastResetAt = useRef<number>(0);

  const clearTimers = () => {
    if (logoutTimer.current) clearTimeout(logoutTimer.current);
    if (warningTimer.current) clearTimeout(warningTimer.current);
  };

  const performLogout = useCallback(async () => {
    clearTimers();
    if (refreshTimer.current) clearTimeout(refreshTimer.current);

    try {
      await axiosClient.post('/auth/logout');
    } catch (_) {}

    tokenStore.set(null);
    setUser(null);
    setShowWarning(false);
  }, []);

  const scheduleRefresh = useCallback((token: string) => {
    if (refreshTimer.current) clearTimeout(refreshTimer.current);

    const expiry = getTokenExpiry(token);
    if (!expiry) return;

    const delay = expiry - Date.now() - 2 * 60 * 1000;
    if (delay <= 0) return;

    refreshTimer.current = setTimeout(async () => {
      try {
        const { data } = await axiosClient.post<{ accessToken: string }>('/auth/refresh');
        tokenStore.set(data.accessToken);
        scheduleRefresh(data.accessToken);
      } catch {
        performLogout();
      }
    }, delay);
  }, [performLogout]);

  const resetTimer = useCallback(() => {
    const now = Date.now();
    if (now - lastResetAt.current < DEBOUNCE_MS) return;
    lastResetAt.current = now;

    clearTimers();
    setShowWarning(false);

    warningTimer.current = setTimeout(() => setShowWarning(true), INACTIVITY_MS - WARNING_BEFORE_MS);
    logoutTimer.current = setTimeout(() => {
      window.dispatchEvent(new CustomEvent('beforeAutoLogout'));
      performLogout();
    }, INACTIVITY_MS);
  }, [performLogout]);

  const continueSession = useCallback(() => {
    setShowWarning(false);
    lastResetAt.current = 0;
    resetTimer();
  }, [resetTimer]);

  useEffect(() => {
    setInactivityResetFn(resetTimer);
    return () => setInactivityResetFn(() => {});
  }, [resetTimer]);

  useEffect(() => {
    axiosClient
      .post<{ accessToken: string }>('/auth/refresh')
      .then(async ({ data }) => {
        tokenStore.set(data.accessToken);
        scheduleRefresh(data.accessToken);
        const { data: me } = await axiosClient.get<ApiUser>('/users/me');
        setUser(normalizeUser(me));
        resetTimer();
      })
      .catch(() => {});
  }, [resetTimer, scheduleRefresh]);

  useEffect(() => {
    if (!user) return;

    const events = ['mousemove', 'keydown', 'click', 'touchstart'] as const;
    events.forEach((eventName) => window.addEventListener(eventName, resetTimer));

    return () => {
      events.forEach((eventName) => window.removeEventListener(eventName, resetTimer));
      clearTimers();
    };
  }, [user, resetTimer]);

  const login = async (email: string, password: string, rememberMe: boolean) => {
    const { data } = await axiosClient.post<{ accessToken: string; user: ApiUser }>(
      '/auth/login',
      { email, password, rememberMe }
    );

    tokenStore.set(data.accessToken);
    if (rememberMe) localStorage.setItem('rememberedEmail', email);
    else localStorage.removeItem('rememberedEmail');

    setUser(normalizeUser(data.user));
    scheduleRefresh(data.accessToken);
    resetTimer();
  };

  const clearMustChangePassword = () =>
    setUser((prev) => (prev ? { ...prev, mustChangePassword: false } : null));

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        login,
        logout: performLogout,
        clearMustChangePassword,
        showInactivityWarning,
        continueSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
};
