import axios from 'axios';

// Access token lives ONLY in memory — never localStorage / sessionStorage
let _token: string | null = null;
let _resetInactivity: (() => void) | null = null;

export const tokenStore = {
  get: () => _token,
  set: (t: string | null) => { _token = t; },
};

/** Called by AuthContext so every outgoing request also resets the inactivity timer */
export const setInactivityResetFn = (fn: () => void) => { _resetInactivity = fn; };

const axiosClient = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:4000',
  withCredentials: true, // send httpOnly refresh-token cookie automatically
});

// Attach Bearer token + reset inactivity on every request
axiosClient.interceptors.request.use((config) => {
  if (_token) config.headers.Authorization = `Bearer ${_token}`;
  _resetInactivity?.();
  return config;
});

let isRefreshing = false;
let failedQueue: Array<{ resolve: (v: unknown) => void; reject: (e: unknown) => void }> = [];

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach(({ resolve, reject }) => (error ? reject(error) : resolve(token)));
  failedQueue = [];
};

axiosClient.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;

    // Dispatch a global event for 5xx so any toast listener can pick it up
    if (error.response?.status >= 500) {
      window.dispatchEvent(
        new CustomEvent('app:serverError', {
          detail: { message: 'שגיאת שרת. אנא נסה שוב מאוחר יותר.' },
        })
      );
    }

    // 401 — try silent token refresh, then replay original request
    if (error.response?.status === 401 && !original._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) =>
          failedQueue.push({ resolve, reject })
        ).then((token) => {
          original.headers.Authorization = `Bearer ${token}`;
          return axiosClient(original);
        });
      }

      original._retry = true;
      isRefreshing = true;

      try {
        const { data } = await axiosClient.post<{ accessToken: string }>('/auth/refresh');
        tokenStore.set(data.accessToken);
        processQueue(null, data.accessToken);
        original.headers.Authorization = `Bearer ${data.accessToken}`;
        return axiosClient(original);
      } catch (err) {
        processQueue(err, null);
        tokenStore.set(null);
        window.location.replace('/login');
        return Promise.reject(err);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default axiosClient;
