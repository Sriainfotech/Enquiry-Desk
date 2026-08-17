import apiClient from "./client";

export async function listEnquiries(params) {
  const { data } = await apiClient.get("/enquiries/", { params });
  return data;
}

export async function getEnquiry(id) {
  const { data } = await apiClient.get(`/enquiries/${id}/`);
  return data;
}

export async function createEnquiry(payload) {
  const { data } = await apiClient.post("/enquiries/", payload);
  return data;
}

export async function patchEnquiry(id, payload) {
  const { data } = await apiClient.patch(`/enquiries/${id}/`, payload);
  return data;
}

export async function replaceRequirements(enquiryId, requirements) {
  const { data } = await apiClient.put(`/enquiries/${enquiryId}/requirements/`, requirements);
  return data;
}

export async function createQuotation(enquiryId, payload) {
  const { data } = await apiClient.post(`/enquiries/${enquiryId}/quotation/`, payload);
  return data;
}

export async function patchQuotation(enquiryId, payload) {
  const { data } = await apiClient.patch(`/enquiries/${enquiryId}/quotation/`, payload);
  return data;
}

export async function createOrder(enquiryId, payload) {
  const { data } = await apiClient.post(`/enquiries/${enquiryId}/order/`, payload);
  return data;
}

export async function patchOrder(enquiryId, payload) {
  const { data } = await apiClient.patch(`/enquiries/${enquiryId}/order/`, payload);
  return data;
}

export async function generateInvoice(enquiryId, payload) {
  const { data } = await apiClient.post(`/enquiries/${enquiryId}/invoice/`, payload);
  return data;
}

export async function patchInvoice(enquiryId, payload) {
  const { data } = await apiClient.patch(`/enquiries/${enquiryId}/invoice/`, payload);
  return data;
}

export async function listActivity(enquiryId) {
  const { data } = await apiClient.get(`/enquiries/${enquiryId}/activity/`);
  return data;
}

export async function fetchDashboard(params) {
  const { data } = await apiClient.get("/enquiries/dashboard/", { params });
  return data;
}

export async function fetchDashboardRecentEnquiries(params) {
  const { data } = await apiClient.get("/enquiries/dashboard/recent-enquiries/", { params });
  return data;
}

export async function fetchDashboardRecentActivity(limit) {
  const { data } = await apiClient.get("/enquiries/dashboard/recent-activity/", { params: { limit } });
  return data;
}
