import { BACKEND_URL } from './config.js';

// 🔹 Usuarios
export async function apiGetUsers() {
  const token = localStorage.getItem("token");
  if (!token) return { success: false, users: [] };
  try {
    const response = await fetch(`${BACKEND_URL}/dashboard/users`, {
      method: "GET",
      headers: { "Authorization": `Bearer ${token}` }
    });
    const data = await response.json().catch(() => null);
    if (response.ok && data) {
      return { success: true, users: Array.isArray(data) ? data : (data.users || []) };
    } else {
      return { success: false, users: [], error: data?.error };
    }
  } catch {
    return { success: false, users: [] };
  }
}

export async function login(username, password) {
  try {
    const response = await fetch(`${BACKEND_URL}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    });
    const data = await response.json().catch(() => null);
    if (response.ok && data?.token) {
      localStorage.setItem("token", data.token);
      return { success: true, token: data.token };
    } else {
      return { success: false, error: data?.error || "Credenciales inválidas" };
    }
  } catch (err) {
    console.error("Error en login:", err);
    return { success: false, error: "No se pudo conectar con el servidor" };
  }
}
