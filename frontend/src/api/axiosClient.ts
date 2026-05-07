import axios from 'axios';

const axiosClient = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:4000',
  withCredentials: true, // send HTTP-only refresh-token cookie
});

axiosClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
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

    if (error.response?.status === 401 && !original._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => failedQueue.push({ resolve, reject })).then(
          (token) => {
            original.headers.Authorization = `Bearer ${token}`;
            return axiosClient(original);
          }
        );
      }

      original._retry = true;
      isRefreshing = true;

      try {
        const { data } = await axiosClient.post<{ accessToken: string }>('/auth/refresh');
        localStorage.setItem('accessToken', data.accessToken);
        processQueue(null, data.accessToken);
        original.headers.Authorization = `Bearer ${data.accessToken}`;
        return axiosClient(original);
      } catch (err) {
        processQueue(err, null);
        localStorage.removeItem('accessToken');
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
