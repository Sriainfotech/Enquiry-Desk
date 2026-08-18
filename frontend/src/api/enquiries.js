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

// Quotation/Order/Invoice each carry at most ONE reference document (internal
// tracking only — the actual document is produced in a separate application), all
// via the same backend shape: /enquiries/<id>/<kind>/attachment/. `kind` is one of
// "quotation" | "order" | "invoice". GET resolves to `null` when none exists yet.
function attachmentPath(kind, enquiryId) {
  return `/enquiries/${enquiryId}/${kind}/attachment/`;
}

export async function getEntityAttachment(kind, enquiryId) {
  const { data } = await apiClient.get(attachmentPath(kind, enquiryId));
  return data;
}

export async function uploadEntityAttachment(kind, enquiryId, file, onProgress) {
  const formData = new FormData();
  formData.append("file", file);
  const { data } = await apiClient.post(attachmentPath(kind, enquiryId), formData, {
    headers: { "Content-Type": "multipart/form-data" },
    onUploadProgress: onProgress
      ? (evt) => onProgress(evt.total ? Math.round((evt.loaded * 100) / evt.total) : 0)
      : undefined,
  });
  return data;
}

export async function deleteEntityAttachment(kind, enquiryId) {
  await apiClient.delete(attachmentPath(kind, enquiryId));
}

// Fetched as a blob through the authenticated axios client (not a plain <a href>) so
// JWT auth actually gates file access, matching how every other API call is protected.
export async function openEntityAttachment(kind, enquiryId, filename, { inline = false } = {}) {
  const { data } = await apiClient.get(`${attachmentPath(kind, enquiryId)}download/`, {
    params: inline ? { inline: 1 } : undefined,
    responseType: "blob",
  });
  const url = window.URL.createObjectURL(data);
  if (inline) {
    window.open(url, "_blank", "noopener,noreferrer");
  } else {
    const link = document.createElement("a");
    link.href = url;
    link.download = filename || "attachment";
    document.body.appendChild(link);
    link.click();
    link.remove();
  }
  setTimeout(() => window.URL.revokeObjectURL(url), 30000);
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

export async function fetchDashboardRecentActivity(limit = 8) {
  const { data } = await apiClient.get("/enquiries/dashboard/recent-activity/", { params: { limit } });
  return data.results;
}

export async function fetchActivityHistory(params) {
  const { data } = await apiClient.get("/enquiries/activity/", { params });
  return data;
}
