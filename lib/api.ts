import axios from 'axios';

// Base URL do backend.
// - Em dev: http://localhost:3001 (ou definir NEXT_PUBLIC_API_URL=...)
// - Em prod: NEXT_PUBLIC_API_URL=https://api.hrstorept.com
const API_BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') ||
  'http://localhost:3001';

const api = axios.create({
  baseURL: `${API_BASE}/api/orders`,
});

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('hrstore-token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      const url: string = error.config?.url || '';
      const isLoginRequest = url.includes('/login');
      const onLoginPage = window.location.pathname.startsWith('/login');
      // Só faz redirect quando a sessão expira em rotas protegidas,
      // nunca durante a própria tentativa de login.
      if (!isLoginRequest && !onLoginPage) {
        localStorage.removeItem('hrstore-token');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;