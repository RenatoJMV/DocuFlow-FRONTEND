import { BACKEND_URL } from './config.js';

export async function apiGetDownloadsToday() {
  const token = localStorage.getItem("token");
  if (!token) return { success: false, count: 0 };
  try {
    const response = await fetch(`${BACKEND_URL}/dashboard/downloads/today`, {
      headers: { "Authorization": `Bearer ${token}` }
    });
    const data = await response.json().catch(() => null);
    if (response.ok && data) {
      return { success: true, count: data.count ?? 0 };
    } else {
      return { success: false, count: 0, error: data?.error };
    }
  } catch {
    return { success: false, count: 0 };
  }
}