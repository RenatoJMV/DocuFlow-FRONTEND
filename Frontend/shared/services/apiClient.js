// Cliente API completo para DocuFlow Backend - Actualizado con TODOS los endpoints
import securityService from './securityService.js';
import { store } from './store.js';
import { showNotification, showLoading } from '../utils/uiHelpers.js';

class ApiClient {
  constructor(baseUrl) {
    this.baseUrl = baseUrl || 'http://localhost:8080';
    this.offlineMode = false;
    this.interceptors = {
      request: [],
      response: [],
      error: []
    };
    
    // Configuración por defecto
    this.defaults = {
      timeout: 15000,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    // Detectar si estamos en producción
    if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
      this.baseUrl = 'https://docuflow-backend.onrender.com';
    }
  }

  // Agregar interceptores
  addRequestInterceptor(interceptor) {
    this.interceptors.request.push(interceptor);
  }

  addResponseInterceptor(interceptor) {
    this.interceptors.response.push(interceptor);
  }

  addErrorInterceptor(interceptor) {
    this.interceptors.error.push(interceptor);
  }

  // Método principal para hacer requests
  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    
    // Aplicar configuración por defecto
    const config = {
      ...this.defaults,
      ...options,
      headers: {
        ...this.defaults.headers,
        ...options.headers
      }
    };

    // Aplicar interceptores de request
    for (const interceptor of this.interceptors.request) {
      try {
        const result = interceptor(config, endpoint);
        if (result) Object.assign(config, result);
      } catch (error) {
        console.warn('Request interceptor error:', error);
      }
    }

    try {
      if (config.showLoading !== false) {
        showLoading(true);
      }

      const response = await fetch(url, config);
      
      if (config.showLoading !== false) {
        showLoading(false);
      }

      // Aplicar interceptores de response
      for (const interceptor of this.interceptors.response) {
        try {
          const result = interceptor(response, config, endpoint);
          if (result) return result;
        } catch (error) {
          console.warn('Response interceptor error:', error);
        }
      }

      if (!response.ok) {
        throw new ApiError(response.status, `HTTP ${response.status}`, response);
      }

      // Manejar diferentes tipos de respuesta
      if (config.responseType === 'blob') {
        return response.blob();
      }

      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const data = await response.json();
        
        if (config.successMessage) {
          showNotification(config.successMessage, 'success');
        }
        
        return data;
      }

      return response.text();

    } catch (error) {
      if (config.showLoading !== false) {
        showLoading(false);
      }

      // Aplicar interceptores de error
      for (const interceptor of this.interceptors.error) {
        try {
          const result = interceptor(error, config, endpoint);
          if (result) return result;
        } catch (interceptorError) {
          console.warn('Error interceptor error:', interceptorError);
        }
      }

      if (config.showErrorNotification !== false) {
        const message = error.message || 'Error en la conexión';
        showNotification(message, 'error');
      }

      throw error;
    }
  }

  // Métodos HTTP básicos
  get(endpoint, options = {}) {
    return this.request(endpoint, { ...options, method: 'GET' });
  }

  post(endpoint, data, options = {}) {
    return this.request(endpoint, {
      ...options,
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined
    });
  }

  put(endpoint, data, options = {}) {
    return this.request(endpoint, {
      ...options,
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined
    });
  }

  delete(endpoint, options = {}) {
    return this.request(endpoint, { ...options, method: 'DELETE' });
  }

  patch(endpoint, data, options = {}) {
    return this.request(endpoint, {
      ...options,
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined
    });
  }
}

// Clase para manejar errores de API
class ApiError extends Error {
  constructor(status, message, response) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.response = response;
  }

  get isClientError() {
    return this.status >= 400 && this.status < 500;
  }

  get isServerError() {
    return this.status >= 500;
  }

  get isAuthError() {
    return this.status === 401 || this.status === 403;
  }
}

// Crear instancia del cliente API
const apiClient = new ApiClient();

// Interceptor de autenticación
apiClient.addRequestInterceptor((config, endpoint) => {
  const token = localStorage.getItem('token');
  if (token && !config.headers['Authorization']) {
    config.headers['Authorization'] = `Bearer ${token}`;
  }
  return config;
});

// Interceptor para manejar errores de autenticación
apiClient.addErrorInterceptor((error, config, endpoint) => {
  if (error.status === 401 && !config._skipAuthRetry) {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('refreshToken');
    
    if (window.location.pathname !== '/auth/login.html') {
      showNotification('Sesión expirada. Por favor, inicia sesión nuevamente.', 'warning');
      setTimeout(() => {
        window.location.href = '../auth/login.html';
      }, 1500);
    }
  }
  
  store.setError(error);
  return error;
});

// Interceptor para logging en desarrollo
if (window.location.hostname === 'localhost' || window.location.search.includes('debug=true')) {
  apiClient.addRequestInterceptor((config, endpoint) => {
    console.log(`🚀 API Request: ${config.method} ${endpoint}`, config);
    return config;
  });

  apiClient.addResponseInterceptor((response, config, endpoint) => {
    console.log(`✅ API Response: ${endpoint}`, response);
    return null;
  });

  apiClient.addErrorInterceptor((error, config, endpoint) => {
    console.error(`❌ API Error: ${endpoint}`, error);
    return error;
  });
}

// 🚀 MÉTODOS ESPECÍFICOS PARA TODOS LOS ENDPOINTS DE DOCUFLOW
const AUTH_PREFIX = '/auth';
const API_PREFIX = '/api';
const FILES_PREFIX = '/files';
const COMMENTS_PREFIX = `${API_PREFIX}/comments`;
const DASHBOARD_PREFIX = `${API_PREFIX}/dashboard`;
const LOGS_PREFIX = `${API_PREFIX}/logs`;
const GCS_PREFIX = `${API_PREFIX}/gcs`;
const PROFILE_PREFIX = `${API_PREFIX}/profile`;
const EXPORT_PREFIX = `${API_PREFIX}/export`;
const PERMISSIONS_PREFIX = `${API_PREFIX}/permissions`;
const NOTIFICATIONS_PREFIX = '/notifications';
const ADMIN_PREFIX = `${API_PREFIX}/admin`;

const docuFlowAPI = {
  // 🔐 AUTENTICACIÓN
  auth: {
    register: (userData) => apiClient.post(`${AUTH_PREFIX}/register`, userData, {
      _skipAuthRetry: true,
      successMessage: 'Usuario registrado exitosamente'
    }),
    login: (credentials) => apiClient.post(`${AUTH_PREFIX}/login`, credentials, {
      _skipAuthRetry: true,
      successMessage: '¡Bienvenido de vuelta!'
    }),
    refresh: (refreshToken) => apiClient.post(`${AUTH_PREFIX}/refresh`, { refreshToken }, {
      _skipAuthRetry: true,
      showLoading: false
    }),
    logout: () => apiClient.post(`${AUTH_PREFIX}/logout`, {}, {
      showLoading: false
    })
  },

  // 📁 GESTIÓN DE ARCHIVOS
  files: {
    // Operaciones básicas
    getAll: () => apiClient.get(FILES_PREFIX),
    getById: (id) => apiClient.get(`${FILES_PREFIX}/${id}`),
    upload: (formData) => apiClient.request(`${FILES_PREFIX}/upload`, {
      method: 'POST',
      body: formData,
      headers: {} // No Content-Type para FormData
    }),
    update: (id, documentData) => apiClient.put(`${FILES_PREFIX}/${id}`, documentData),
    delete: (id) => apiClient.delete(`${FILES_PREFIX}/${id}`),
    
    // Descarga y búsqueda
    download: (id) => apiClient.get(`${FILES_PREFIX}/${id}/download`, { responseType: 'blob' }),
    search: (query) => apiClient.get(`${FILES_PREFIX}/search?query=${encodeURIComponent(query)}`),
    getByUser: (userId) => apiClient.get(`${FILES_PREFIX}/user/${userId}`),
    getRecent: (limit = 10) => apiClient.get(`${FILES_PREFIX}/recent?limit=${limit}`),
    
    // Compartir y metadatos
    share: (id, shareData) => apiClient.post(`${FILES_PREFIX}/${id}/share`, shareData),
    getMetadata: (id) => apiClient.get(`${FILES_PREFIX}/${id}/metadata`),
    updateMetadata: (id, metadata) => apiClient.put(`${FILES_PREFIX}/${id}/metadata`, metadata),
    getVersions: (id) => apiClient.get(`${FILES_PREFIX}/${id}/versions`),

    // Estadísticas
    getStats: () => apiClient.get(`${FILES_PREFIX}/stats`),
    getCount: () => apiClient.get(`${FILES_PREFIX}/count`),
    getTotalSize: () => apiClient.get(`${FILES_PREFIX}/total-size`)
  },

  // 💬 COMENTARIOS
  comments: {
    create: (commentData) => apiClient.post(COMMENTS_PREFIX, commentData),
    getByDocument: (documentId) => apiClient.get(`${COMMENTS_PREFIX}/document/${documentId}`),
    update: (id, commentData) => apiClient.put(`${COMMENTS_PREFIX}/${id}`, commentData),
    delete: (id) => apiClient.delete(`${COMMENTS_PREFIX}/${id}`),
    assign: (id, assigneeData) => apiClient.put(`${COMMENTS_PREFIX}/${id}/assign`, assigneeData)
  },

  // 📊 DASHBOARD
  dashboard: {
    getStats: () => apiClient.get(`${DASHBOARD_PREFIX}/stats`),
    getActivity: () => apiClient.get(`${DASHBOARD_PREFIX}/activity`),
    getPopularFiles: () => apiClient.get(`${DASHBOARD_PREFIX}/popular-files`),
    getUserSummary: () => apiClient.get(`${DASHBOARD_PREFIX}/user-summary`),
    getDownloadsToday: () => apiClient.get(`${DASHBOARD_PREFIX}/downloads/today`)
  },

  // 📋 LOGS
  logs: {
    getAll: () => apiClient.get(LOGS_PREFIX),
    getByUser: (userId) => apiClient.get(`${LOGS_PREFIX}/user/${userId}`),
    getByType: (type) => apiClient.get(`${LOGS_PREFIX}/type/${type}`),
    create: (logData) => apiClient.post(LOGS_PREFIX, logData)
  },

  // ✅ SALUD DEL SISTEMA
  health: {
    check: () => apiClient.get('/health'),
    detailed: () => apiClient.get('/health/detailed')
  },

  // ☁️ GOOGLE CLOUD STORAGE
  gcs: {
    upload: (formData) => apiClient.request(`${GCS_PREFIX}/upload`, {
      method: 'POST',
      body: formData,
      headers: {}
    }),
    download: (fileName) => apiClient.get(`${GCS_PREFIX}/download/${fileName}`, { responseType: 'blob' }),
    delete: (fileName) => apiClient.delete(`${GCS_PREFIX}/delete/${fileName}`),
    list: () => apiClient.get(`${GCS_PREFIX}/list`),
    getOrphaned: () => apiClient.get(`${GCS_PREFIX}/files/orphaned`)
  },

  // 👤 PERFIL DE USUARIO
  profile: {
    get: () => apiClient.get(PROFILE_PREFIX),
    update: (profileData) => apiClient.put(PROFILE_PREFIX, profileData),
    changePassword: (passwordData) => apiClient.put(`${PROFILE_PREFIX}/password`, passwordData),
    uploadAvatar: (formData) => apiClient.request(`${PROFILE_PREFIX}/avatar`, {
      method: 'POST',
      body: formData,
      headers: {}
    })
  },

  // 📤 EXPORTACIÓN
  export: {
    files: (params = {}) => {
      const queryString = new URLSearchParams(params).toString();
      return apiClient.get(`${EXPORT_PREFIX}/files${queryString ? `?${queryString}` : ''}`);
    },
    logs: (params = {}) => {
      const queryString = new URLSearchParams(params).toString();
      return apiClient.get(`${EXPORT_PREFIX}/logs${queryString ? `?${queryString}` : ''}`);
    },
    stats: () => apiClient.get(`${EXPORT_PREFIX}/stats`),
    statsCsv: () => apiClient.request(`${EXPORT_PREFIX}/stats?format=csv`, {
      method: 'GET',
      responseType: 'blob',
      headers: {
        Accept: 'text/csv'
      }
    })
  },

  // 🔒 PERMISOS
  permissions: {
    getFilePermissions: (fileId) => apiClient.get(`${PERMISSIONS_PREFIX}/file/${fileId}`),
    assign: (permissionData) => apiClient.post(`${PERMISSIONS_PREFIX}/assign`, permissionData),
    revoke: (permissionData) => apiClient.request(`${PERMISSIONS_PREFIX}/revoke`, {
      method: 'DELETE',
      body: JSON.stringify(permissionData)
    }),
    getUserPermissions: (userId) => apiClient.get(`${PERMISSIONS_PREFIX}/user/${userId}`)
  },

  // 🔔 NOTIFICACIONES
  notifications: {
    getAll: () => apiClient.get(NOTIFICATIONS_PREFIX),
    markAsRead: (id) => apiClient.put(`${NOTIFICATIONS_PREFIX}/${id}/read`),
    create: (notificationData) => apiClient.post(NOTIFICATIONS_PREFIX, notificationData),
    delete: (id) => apiClient.delete(`${NOTIFICATIONS_PREFIX}/${id}`),
    deactivate: (id) => apiClient.put(`${NOTIFICATIONS_PREFIX}/${id}/deactivate`)
  },

  // 👥 ADMINISTRACIÓN DE USUARIOS
  admin: {
    users: {
      getAll: () => apiClient.get(`${ADMIN_PREFIX}/users`),
      getById: (id) => apiClient.get(`${ADMIN_PREFIX}/users/${id}`),
      create: (userData) => apiClient.post(`${ADMIN_PREFIX}/users`, userData),
      update: (id, userData) => apiClient.put(`${ADMIN_PREFIX}/users/${id}`, userData),
      delete: (id) => apiClient.delete(`${ADMIN_PREFIX}/users/${id}`),
      updateStatus: (id, active) => apiClient.put(`${ADMIN_PREFIX}/users/${id}/status`, { active })
    }
  },

  // 📎 SUBIDA LEGACY
  upload: {
    single: (formData) => apiClient.request(`${FILES_PREFIX}/upload`, {
      method: 'POST',
      body: formData,
      headers: {}
    }),
    multiple: (formData) => apiClient.request(`${FILES_PREFIX}/upload/multiple`, {
      method: 'POST',
      body: formData,
      headers: {}
    })
  }
};

// Funciones auxiliares para manejo de tokens
export function persistAuthTokens(tokens) {
  if (tokens.accessToken) {
    localStorage.setItem('token', tokens.accessToken);
    localStorage.setItem('accessToken', tokens.accessToken);
  }
  if (tokens.refreshToken) {
    localStorage.setItem('refreshToken', tokens.refreshToken);
  }
  if (tokens.expiresIn) {
    const expiresAt = new Date(Date.now() + tokens.expiresIn * 1000);
    localStorage.setItem('tokenExpiresAt', expiresAt.toISOString());
  }
}

export function clearAuthTokens() {
  localStorage.removeItem('token');
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('tokenExpiresAt');
  localStorage.removeItem('user');
}

export function getStoredAccessToken() {
  return localStorage.getItem('token') || localStorage.getItem('accessToken');
}

export function getStoredRefreshToken() {
  return localStorage.getItem('refreshToken');
}

export function isTokenExpired() {
  const expiresAt = localStorage.getItem('tokenExpiresAt');
  if (!expiresAt) return false;
  
  return new Date() >= new Date(expiresAt);
}

// Exportar tanto la instancia como la clase
export { apiClient, ApiClient, ApiError, docuFlowAPI };
export default apiClient;