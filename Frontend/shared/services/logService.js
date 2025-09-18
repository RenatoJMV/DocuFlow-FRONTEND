import { BACKEND_URL } from './config.js';

// 🔹 Logs
export async function apiGetLogs() {
  const token = localStorage.getItem("token");
  if (!token) return { success: false, logs: [] };
  try {
    const response = await fetch(`${BACKEND_URL}/dashboard/logs`, {
      method: "GET",
      headers: { "Authorization": `Bearer ${token}` }
    });
    const data = await response.json().catch(() => null);
    if (response.ok && data) {
      return { success: true, logs: Array.isArray(data) ? data : (data.logs || []) };
    } else {
      return { success: false, logs: [], error: data?.error };
    }
  } catch {
    return { success: false, logs: [] };
  }
}
