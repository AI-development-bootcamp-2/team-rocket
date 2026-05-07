import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import axiosClient from '../api/axiosClient';

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
}

const AuthContext = createContext<AuthContextValue | null>(null);

const INACTIVITY_MS = 30 * 60 * 1000; //auto logout after 30 minutes of inactivity

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopTimer = () => {
    if (timer.current) clearTimeout(timer.current);
  };

  const performLogout = useCallback(async () => {
    try {
      await axiosClient.post('/auth/logout');
    } catch (_) {}
    localStorage.removeItem('accessToken');
    setUser(null);
    stopTimer();
  }, []);

  const resetTimer = useCallback(() => {
    stopTimer();
    timer.current = setTimeout(performLogout, INACTIVITY_MS);
  }, [performLogout]);

  // Restore session on mount
  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) return;
    axiosClient
      .get<User>('/users/me')
      .then(({ data }) => {
        setUser(data);
        resetTimer();
      })
      .catch(() => localStorage.removeItem('accessToken'));
  }, [resetTimer]);

  // Inactivity auto-logout
  useEffect(() => {
    if (!user) return;
    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    events.forEach((ev) => window.addEventListener(ev, resetTimer));
    return () => {
      events.forEach((ev) => window.removeEventListener(ev, resetTimer));
      stopTimer();
    };
  }, [user, resetTimer]);

  const login = async (email: string, password: string, rememberMe: boolean) => {
    const { data } = await axiosClient.post<{ accessToken: string; user: User }>(
      '/auth/login',
      { email, password, rememberMe }
    );
    localStorage.setItem('accessToken', data.accessToken);
    if (rememberMe) localStorage.setItem('rememberedEmail', email);
    else localStorage.removeItem('rememberedEmail');
    setUser(data.user);
    resetTimer();
  };

  const clearMustChangePassword = () =>
    setUser((prev) => (prev ? { ...prev, mustChangePassword: false } : null));

  return (
    <AuthContext.Provider
      value={{ user, isAuthenticated: !!user, login, logout: performLogout, clearMustChangePassword }}
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
