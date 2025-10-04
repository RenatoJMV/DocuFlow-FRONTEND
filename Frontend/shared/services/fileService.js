import { BACKEND_URL } from './config.js';

const getAuthToken = () => localStorage.getItem("authToken") || localStorage.getItem("token");
// Eliminar archivo
export async function apiDeleteFile(fileId) {
  const token = getAuthToken();
  if (!token) return { success: false };
  try {
  const response = await fetch(`${BACKEND_URL}/files/${fileId}`, {
      method: "DELETE",
      headers: { "Authorization": `Bearer ${token}` }
    });
    const data = await response.json().catch(() => null);
    return response.ok ? { success: true, ...data } : { success: false, error: data?.error };
  } catch {
    return { success: false };
  }
}
// 🔹 Archivos (Files)
export async function apiGetFiles() {
  const token = getAuthToken();
  if (!token) return { success: false, files: [] };
  try {
  const response = await fetch(`${BACKEND_URL}/files`, {
      method: "GET",
      headers: { "Authorization": `Bearer ${token}` }
    });
    const data = await response.json().catch(() => null);
    if (response.ok && data) {
      return { success: true, files: Array.isArray(data) ? data : (data.files || []) };
    } else {
      return { success: false, files: [], error: data?.error };
    }
  } catch {
    return { success: false, files: [] };
  }
}

export async function apiUploadFile(file, metadata = {}) {
  const token = getAuthToken();
  if (!token) return { success: false };
  const formData = new FormData();
  formData.append("file", file);
  Object.entries(metadata).forEach(([key, value]) => formData.append(key, value));
  try {
  const response = await fetch(`${BACKEND_URL}/files`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${token}` },
      body: formData
    });
    const data = await response.json().catch(() => null);
    return response.ok ? { success: true, ...data } : { success: false, error: data?.error };
  } catch {
    return { success: false };
  }
}

export async function apiDownloadFile(fileId, newName) {
  const token = getAuthToken();
  if (!token) return { success: false };
  try {
  const response = await fetch(`${BACKEND_URL}/files/${fileId}/download`, {
      method: "GET",
      headers: { "Authorization": `Bearer ${token}` }
    });
    if (!response.ok) return { success: false };
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = newName || 'archivo';
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
    return { success: true };
  } catch {
    return { success: false };
  }
}

export async function apiGetFileStats() {
  const token = getAuthToken();
  if (!token) return { success: false };
  try {
  const response = await fetch(`${BACKEND_URL}/files/stats`, {
      method: "GET",
      headers: { "Authorization": `Bearer ${token}` }
    });
    const data = await response.json().catch(() => null);
    return response.ok ? { success: true, ...data } : { success: false, error: data?.error };
  } catch {
    return { success: false };
  }
}

export async function apiGetFileCount() {
  const token = getAuthToken();
  if (!token) return { success: false };
  try {
  const response = await fetch(`${BACKEND_URL}/files/count`, {
      method: "GET",
      headers: { "Authorization": `Bearer ${token}` }
    });
    const data = await response.json().catch(() => null);
    return response.ok ? { success: true, ...data } : { success: false, error: data?.error };
  } catch {
    return { success: false };
  }
}

export async function apiGetFileTotalSize() {
  const token = getAuthToken();
  if (!token) return { success: false };
  try {
  const response = await fetch(`${BACKEND_URL}/files/total-size`, {
      method: "GET",
      headers: { "Authorization": `Bearer ${token}` }
    });
    const data = await response.json().catch(() => null);
    return response.ok ? { success: true, ...data } : { success: false, error: data?.error };
  } catch {
    return { success: false };
  }
}
