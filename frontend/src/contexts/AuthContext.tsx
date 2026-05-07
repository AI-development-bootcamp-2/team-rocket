import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import axiosClient, { tokenStore, setInactivityResetFn } from '../api/axiosClient';

export interface User {
  id: string;
  fullName: string;
  email?: string;
  role: 'user' | 'admin';
  mustChangePassword: boolean;
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

const INACTIVITY_MS      = 30 * 60 * 1000; // auto-logout after 30 min of inactivity
const WARNING_BEFORE_MS  =  2 * 60 * 1000; // show warning 2 min before logout
const DEBOUNCE_MS        = 10_000;          // reset timer at most once every 10s

/** Decode JWT exp claim without an external library */
const getTokenExpiry = (token: string): number | null => {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.exp ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser]                               = useState<User | null>(null);
  const [showInactivityWarning, setShowWarning]       = useState(false);

  const logoutTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warningTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastResetAt  = useRef<number>(0);

  const clearTimers = () => {
    if (logoutTimer.current)  clearTimeout(logoutTimer.current);
    if (warningTimer.current) clearTimeout(warningTimer.current);
  };

  const performLogout = useCallback(async () => {
    clearTimers();
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    try { await axiosClient.post('/auth/logout'); } catch (_) {}
    tokenStore.set(null);
    setUser(null);
    setShowWarning(false);
  }, []);

  /** Proactively refresh the access token 2 min before it expires */
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

  /**
   * Reset the 30-min inactivity clock.
   * Debounced: only resets if >10s have passed since the last reset to avoid
   * thrashing on rapid mousemove / keydown events.
   */
  const resetTimer = useCallback(() => {
    const now = Date.now();
    if (now - lastResetAt.current < DEBOUNCE_MS) return;
    lastResetAt.current = now;

    clearTimers();
    setShowWarning(false);

    // Show warning at T-2min
    warningTimer.current = setTimeout(
      () => setShowWarning(true),
      INACTIVITY_MS - WARNING_BEFORE_MS
    );

    // Auto-logout at T-0
    logoutTimer.current = setTimeout(() => {
      window.dispatchEvent(new CustomEvent('beforeAutoLogout'));
      performLogout();
    }, INACTIVITY_MS);
  }, [performLogout]);

  /** "כן, המשך" — bypass debounce and reset the full 30-min clock */
  const continueSession = useCallback(() => {
    setShowWarning(false);
    lastResetAt.current = 0; // force bypass of debounce
    resetTimer();
  }, [resetTimer]);

  // Register resetTimer with axiosClient so API calls also reset the clock
  useEffect(() => {
    setInactivityResetFn(resetTimer);
    return () => setInactivityResetFn(() => {});
  }, [resetTimer]);

  // On mount: restore session using the httpOnly refresh-token cookie
  useEffect(() => {
    axiosClient
      .post<{ accessToken: string }>('/auth/refresh')
      .then(async ({ data }) => {
        tokenStore.set(data.accessToken);
        scheduleRefresh(data.accessToken);
        const { data: me } = await axiosClient.get<User>('/users/me');
        setUser(me);
        resetTimer();
      })
      .catch(() => {}); // no active session — stay logged out
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Bind activity listeners when authenticated
  useEffect(() => {
    if (!user) return;
    const events = ['mousemove', 'keydown', 'click', 'touchstart'] as const;
    events.forEach((ev) => window.addEventListener(ev, resetTimer));
    return () => {
      events.forEach((ev) => window.removeEventListener(ev, resetTimer));
      clearTimers();
    };
  }, [user, resetTimer]);

  const login = async (email: string, password: string, rememberMe: boolean) => {
    const { data } = await axiosClient.post<{ accessToken: string; user: User }>(
      '/auth/login',
      { email, password, rememberMe }
    );
    tokenStore.set(data.accessToken);
    // rememberedEmail is only for UX email pre-fill — not an auth secret
    if (rememberMe) localStorage.setItem('rememberedEmail', email);
    else            localStorage.removeItem('rememberedEmail');
    setUser(data.user);
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
