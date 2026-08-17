import apiClient from "./client";

export async function listCustomers(params) {
  const { data } = await apiClient.get("/customers/", { params });
  return data; // { count, total_pages, current_page, results }
}

export async function getCustomer(id) {
  const { data } = await apiClient.get(`/customers/${id}/`);
  return data;
}

export async function createCustomer(payload) {
  const { data } = await apiClient.post("/customers/", payload);
  return data;
}

export async function updateCustomer(id, payload) {
  const { data } = await apiClient.put(`/customers/${id}/`, payload);
  return data;
}

export async function patchCustomer(id, payload) {
  const { data } = await apiClient.patch(`/customers/${id}/`, payload);
  return data;
}
