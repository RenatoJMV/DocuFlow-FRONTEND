import { BACKEND_URL } from './config.js';

const getAuthToken = () => localStorage.getItem("authToken") || localStorage.getItem("token");

// 🔹 Logs
export async function apiGetLogs() {
  const token = getAuthToken();
  if (!token) return { success: false, logs: [] };
  try {
    const response = await fetch(`${BACKEND_URL}/api/dashboard/logs`, {
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
