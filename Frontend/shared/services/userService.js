import { BACKEND_URL } from './config.js';

// 🔹 Usuarios

// Obtener roles disponibles
export async function apiGetRoles() {
  const token = localStorage.getItem("token");
  if (!token) return { success: false, roles: [] };
  try {
    const response = await fetch(`${BACKEND_URL}/users/roles`, {
      method: "GET",
      headers: { "Authorization": `Bearer ${token}` }
    });
    const data = await response.json().catch(() => null);
    if (response.ok && data) {
      return { success: true, roles: data };
    } else {
      return { success: false, roles: [], error: data?.error };
    }
  } catch {
    return { success: false, roles: [] };
  }
}

// Cambiar el rol de un usuario
export async function apiSetUserRole(userId, role) {
  const token = localStorage.getItem("token");
  if (!token) return { success: false };
  try {
    const response = await fetch(`${BACKEND_URL}/users/${userId}/role`, {
      method: "PUT",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ role })
    });
    if (response.ok) {
      return { success: true };
    } else {
      const data = await response.json().catch(() => null);
      return { success: false, error: data?.error };
    }
  } catch {
    return { success: false };
  }
}

// Obtener permissions de un usuario
export async function apiGetUserPermissions(userId) {
  const token = localStorage.getItem("token");
  if (!token) return { success: false, permissions: [] };
  try {
    const response = await fetch(`${BACKEND_URL}/users/${userId}/permissions`, {
      method: "GET",
      headers: { "Authorization": `Bearer ${token}` }
    });
    const data = await response.json().catch(() => null);
    if (response.ok && data) {
      return { success: true, permissions: data };
    } else {
      return { success: false, permissions: [], error: data?.error };
    }
  } catch {
    return { success: false, permissions: [] };
  }
}

// Actualizar permissions de un usuario
export async function apiSetUserPermissions(userId, permissions) {
  const token = localStorage.getItem("token");
  if (!token) return { success: false };
  try {
    const response = await fetch(`${BACKEND_URL}/users/${userId}/permissions`, {
      method: "PUT",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ permissions })
    });
    if (response.ok) {
      return { success: true };
    } else {
      const data = await response.json().catch(() => null);
      return { success: false, error: data?.error };
    }
  } catch {
    return { success: false };
  }
}
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
