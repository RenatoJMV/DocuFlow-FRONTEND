import { BACKEND_URL } from './config.js';
import { apiClient, docuFlowAPI } from './apiClient.js';

const getAuthToken = () => localStorage.getItem("authToken") || localStorage.getItem("token");

// 🔹 Usuarios

// Obtener roles disponibles
export async function apiGetRoles() {
  try {
    const response = await apiClient.get('/api/admin/users/roles');
    const roles = response?.roles || response?.data || response;
    return {
      success: true,
      roles: Array.isArray(roles) ? roles : []
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
    await apiClient.put(`/api/admin/users/${userId}`, { role });
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
  try {
    const response = await docuFlowAPI.permissions.getUserPermissions(userId);
    const normalized = normalizePermissionsResponse(response);
    return { success: true, permissions: normalized };
  } catch (error) {
    console.error('Error obteniendo permisos de usuario:', error);
    return { success: false, permissions: [], error: error.message };
  }
}

// Actualizar permisos de un usuario
export async function apiSetUserPermissions(userId, permissions) {
  try {
    await apiClient.put(`/permissions/user/${userId}`, { permissions });
    return { success: true };
  } catch (error) {
    console.error('Error actualizando permisos de usuario:', error);
    return { success: false, error: error.message || 'Error al actualizar permisos' };
  }
}
// Obtener lista de usuarios
export async function apiGetUsers() {
  try {
    const response = await apiClient.get('/api/admin/users');
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
    const response = await apiClient.post('/api/admin/users', userData);
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
    const response = await apiClient.put(`/api/admin/users/${userId}`, userData);
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
    await apiClient.delete(`/api/admin/users/${userId}`);
    return { success: true };
  } catch (error) {
    console.error('Error eliminando usuario:', error);
    return { 
      success: false, 
      error: error.message || 'Error al eliminar usuario'
    };
  }
}

export async function apiResetUserPassword(userId, newPassword) {
  try {
    await apiClient.patch(`/api/admin/users/${userId}/password`, { password: newPassword });
    return { success: true };
  } catch (error) {
    console.error('Error actualizando contraseña:', error);
    return { success: false, error: error.message || 'Error al actualizar contraseña' };
  }
}

export async function apiGetPermissionCatalog() {
  try {
    const response = await apiClient.get('/permissions/modules');
    return { success: true, catalog: response?.modules || response?.data || response };
  } catch (error) {
    console.error('Error obteniendo catálogo de permisos:', error);
    return { success: false, catalog: [], error: error.message };
  }
}

export async function apiGetRolePermissionTemplates() {
  try {
    const response = await apiClient.get('/permissions/roles/permissions');
    return { success: true, templates: response?.templates || response?.data || response };
  } catch (error) {
    console.error('Error obteniendo permisos por rol:', error);
    return { success: false, templates: {}, error: error.message };
  }
}

function normalizePermissionsResponse(raw) {
  if (!raw) return [];

  if (Array.isArray(raw)) {
    return raw.map(String);
  }

  if (typeof raw === 'object') {
    const flattened = [];
    Object.entries(raw).forEach(([moduleKey, value]) => {
      if (Array.isArray(value)) {
        value.forEach((perm) => flattened.push(String(perm)));
        return;
      }

      if (typeof value === 'object' && value !== null) {
        Object.entries(value).forEach(([actionKey, flag]) => {
          if (flag === true || flag === 'true' || flag === 1) {
            flattened.push(`${moduleKey}.${actionKey}`);
          }
        });
      }
    });
    return flattened;
  }

  return [];
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
