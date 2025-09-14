import { BACKEND_URL } from './config.js';

// 🔹 Comentarios
export async function apiGetComments() {
  const token = localStorage.getItem("token");
  if (!token) return { success: false, comments: [] };
  try {
    const response = await fetch(`${BACKEND_URL}/dashboard/comments`, {
      method: "GET",
      headers: { "Authorization": `Bearer ${token}` }
    });
    const data = await response.json().catch(() => null);
    if (response.ok && data) {
      return { success: true, comments: Array.isArray(data) ? data : (data.comments || []) };
    } else {
      return { success: false, comments: [], error: data?.error };
    }
  } catch {
    return { success: false, comments: [] };
  }
}
