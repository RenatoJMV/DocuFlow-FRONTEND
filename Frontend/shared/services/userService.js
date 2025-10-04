import { BACKEND_URL } from './config.js';
import { apiClient } from './apiClient.js';

const getAuthToken = () => localStorage.getItem("authToken") || localStorage.getItem("token");

// 🔹 Usuarios

// Obtener roles disponibles
export async function apiGetRoles() {
  try {
  const response = await apiClient.get('/users/roles');
    return { 
      success: true, 
      roles: response.roles || response.data || response || [] 
    };
  } catch (error) {
    console.error('Error obteniendo roles:', error);
    return { 
      success: false, 
      roles: [], 
      error: error.message || 'Error al obtener roles'
    };
  }
}

// Cambiar el rol de un usuario
export async function apiSetUserRole(userId, role) {
  try {
  await apiClient.put(`/users/${userId}/role`, { role });
    return { success: true };
  } catch (error) {
    console.error('Error cambiando rol de usuario:', error);
    return { 
      success: false, 
      error: error.message || 'Error al cambiar el rol del usuario'
    };
  }
}

// Obtener permisos de un usuario
export async function apiGetUserPermissions(userId) {
  const token = getAuthToken();
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

// Actualizar permisos de un usuario
export async function apiSetUserPermissions(userId, permissions) {
  const token = getAuthToken();
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
// Obtener lista de usuarios
export async function apiGetUsers() {
  try {
  const response = await apiClient.get('/users');
    const users = response.users || response.data || response;
    
    return { 
      success: true, 
      users: Array.isArray(users) ? users : [] 
    };
  } catch (error) {
    console.error('Error obteniendo usuarios:', error);
    return { 
      success: false, 
      users: [], 
      error: error.message || 'Error al obtener usuarios'
    };
  }
}

// Crear nuevo usuario
export async function apiCreateUser(userData) {
  try {
    const response = await apiClient.post('/auth/register', userData);
    return { 
      success: true, 
      user: response.user || response.data || response 
    };
  } catch (error) {
    console.error('Error creando usuario:', error);
    return { 
      success: false, 
      error: error.message || 'Error al crear usuario'
    };
  }
}

// Actualizar usuario existente
export async function apiUpdateUser(userId, userData) {
  try {
  const response = await apiClient.put(`/users/${userId}`, userData);
    return { 
      success: true, 
      user: response.user || response.data || response 
    };
  } catch (error) {
    console.error('Error actualizando usuario:', error);
    return { 
      success: false, 
      error: error.message || 'Error al actualizar usuario'
    };
  }
}

// Eliminar usuario
export async function apiDeleteUser(userId) {
  try {
  await apiClient.delete(`/users/${userId}`);
    return { success: true };
  } catch (error) {
    console.error('Error eliminando usuario:', error);
    return { 
      success: false, 
      error: error.message || 'Error al eliminar usuario'
    };
  }
}

export async function login(username, password) {
  try {
    const response = await fetch(`${BACKEND_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    });
    const data = await response.json().catch(() => null);
    if (response.ok && data?.token) {
      localStorage.setItem("token", data.token);
      localStorage.setItem("authToken", data.token);
      if (data.refreshToken) {
        localStorage.setItem("refreshToken", data.refreshToken);
      }
      if (typeof data.expiresIn === 'number') {
        const expiresAt = Date.now() + data.expiresIn * 1000;
        localStorage.setItem("tokenExpiresAt", expiresAt.toString());
      }
      if (data.user) {
        localStorage.setItem("userData", JSON.stringify(data.user));
        localStorage.setItem("user", JSON.stringify(data.user));
      }
      return { success: true, token: data.token };
    } else {
      return { success: false, error: data?.error || "Credenciales inválidas" };
    }
  } catch (err) {
    console.error("Error en login:", err);
    return { success: false, error: "No se pudo conectar con el servidor" };
  }
}
