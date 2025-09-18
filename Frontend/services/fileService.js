import { BACKEND_URL } from './config.js';

// 🔹 Archivos (Files)
export async function apiGetFiles() {
  const token = localStorage.getItem("token");
  if (!token) return { success: false, files: [] };
  try {
    const response = await fetch(`${BACKEND_URL}/dashboard/files`, {
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
  const token = localStorage.getItem("token");
  if (!token) return { success: false };
  const formData = new FormData();
  formData.append("file", file);
  Object.entries(metadata).forEach(([key, value]) => formData.append(key, value));
  try {
    // Cambia la URL aquí según tu backend real
    const response = await fetch(`${BACKEND_URL}/api/upload`, {
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
  const token = localStorage.getItem("token");
  if (!token) return { success: false };
  try {
    const response = await fetch(`${BACKEND_URL}/dashboard/files/${fileId}/download`, {
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
