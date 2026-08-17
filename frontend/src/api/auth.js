import apiClient, { tokenStore } from "./client";

export async function login(username, password) {
  const { data } = await apiClient.post("/auth/login/", { username, password });
  tokenStore.set(data.access, data.refresh);
  return data.user;
}

export async function logout() {
  const refresh = tokenStore.getRefresh();
  try {
    if (refresh) await apiClient.post("/auth/logout/", { refresh });
  } finally {
    tokenStore.clear();
  }
}

export async function fetchCurrentUser() {
  const { data } = await apiClient.get("/auth/me/");
  return data;
}

export async function forgotPassword(email) {
  const { data } = await apiClient.post("/auth/forgot-password/", { email });
  return data;
}

export async function resetPassword({ uid, token, new_password, confirm_password }) {
  const { data } = await apiClient.post("/auth/reset-password/", { uid, token, new_password, confirm_password });
  return data;
}
