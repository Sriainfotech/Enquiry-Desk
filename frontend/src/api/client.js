import axios from "axios";

const BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api";

// The backend's origin (no "/api" suffix) — used to resolve the relative media URLs
// (e.g. "/media/quotations/2026/08/file.pdf") that file-upload fields return.
export const API_ORIGIN = BASE_URL.replace(/\/api\/?$/, "");

const ACCESS_KEY = "ced_access_token";
const REFRESH_KEY = "ced_refresh_token";

export const tokenStore = {
  getAccess: () => localStorage.getItem(ACCESS_KEY),
  getRefresh: () => localStorage.getItem(REFRESH_KEY),
  set(access, refresh) {
    if (access) localStorage.setItem(ACCESS_KEY, access);
    if (refresh) localStorage.setItem(REFRESH_KEY, refresh);
  },
  clear() {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  },
};

export const apiClient = axios.create({ baseURL: BASE_URL });

apiClient.interceptors.request.use((config) => {
  const token = tokenStore.getAccess();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let refreshPromise = null;

function broadcastLogout() {
  tokenStore.clear();
  window.dispatchEvent(new CustomEvent("auth:logout"));
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const { response, config } = error;
    if (!response) {
      return Promise.reject({ detail: "Cannot reach the server. Please check your connection.", original: error });
    }

    const isAuthEndpoint = config.url?.includes("/auth/login") || config.url?.includes("/auth/refresh");
    if (response.status === 401 && !config._retry && !isAuthEndpoint) {
      config._retry = true;
      const refresh = tokenStore.getRefresh();
      if (!refresh) {
        broadcastLogout();
        return Promise.reject(normalizeError(error));
      }
      try {
        if (!refreshPromise) {
          refreshPromise = axios
            .post(`${BASE_URL}/auth/refresh/`, { refresh })
            .then((res) => {
              tokenStore.set(res.data.access, res.data.refresh);
              return res.data.access;
            })
            .finally(() => {
              refreshPromise = null;
            });
        }
        const newAccess = await refreshPromise;
        config.headers.Authorization = `Bearer ${newAccess}`;
        return apiClient(config);
      } catch (refreshError) {
        broadcastLogout();
        return Promise.reject(normalizeError(refreshError));
      }
    }

    return Promise.reject(normalizeError(error));
  }
);

function normalizeError(error) {
  const data = error.response?.data;
  if (!data) return { detail: "An unexpected error occurred.", status: error.response?.status };
  return { detail: data.detail || "Request failed.", errors: data.errors, status: error.response?.status };
}

export default apiClient;
