// Cliente API moderno con fallback offline para DocuFlow
import { store } from './store.js';
import { showNotification, showLoading } from '../utils/uiHelpers.js';

class ApiClient {
  constructor() {
    // Configuración simplificada sin dependencia externa
    const isLocalhost = ['localhost', '127.0.0.1', ''].includes(window.location.hostname);
    
    this.baseUrl = isLocalhost 
      ? 'http://localhost:8080'  // Puerto por defecto de Spring Boot
      : 'https://docuflow-backend.onrender.com';
      
    this.offlineMode = false;
    
    this.interceptors = {
      request: [],
      response: [],
      error: []
    };
    
    // Configuración por defecto
    this.defaults = {
      timeout: 10000,
      headers: {}
    };

    // Log de configuración
    console.log(`🌐 DocuFlow API configurada: ${this.baseUrl}`);
  }

  // Agregar interceptores
  addRequestInterceptor(fn) {
    this.interceptors.request.push(fn);
    return this;
  }

  addResponseInterceptor(fn) {
    this.interceptors.response.push(fn);
    return this;
  }

  addErrorInterceptor(fn) {
    this.interceptors.error.push(fn);
    return this;
  }

  // Método principal para hacer requests
  async request(endpoint, options = {}) {
    try {
      // Si ya estamos en modo offline, usar datos de demostración directamente
      if (this.offlineMode) {
        return await this.getDemoResponse(endpoint, options);
      }

      // Configurar request base
      let config = {
        method: options.method || 'GET',
        headers: {
          ...this.defaults.headers,
          ...options.headers
        },
        ...options
      };

      // Ejecutar interceptores de request
      for (const interceptor of this.interceptors.request) {
        config = await interceptor(config, endpoint);
      }

      // Ajustar cabeceras según el tipo de cuerpo
      const isFormData = typeof FormData !== 'undefined' && config.body instanceof FormData;
      if (isFormData && config.headers) {
        delete config.headers['Content-Type'];
      }

      // Mostrar loading si está habilitado
      if (options.showLoading !== false) {
        store.setLoading(true);
      }

      // Crear AbortController para timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.defaults.timeout);

      config.signal = controller.signal;

      // Log detallado para debugging
      console.log('📤 Request details:', {
        method: config.method,
        url: `${this.baseUrl}${endpoint}`,
        headers: config.headers,
        body: config.body
      });

      // Hacer el request
      const response = await fetch(`${this.baseUrl}${endpoint}`, config);
      clearTimeout(timeoutId);

      console.log('📥 Response status:', response.status, response.statusText);

      // Ejecutar interceptores de response
      let processedResponse = response;
      for (const interceptor of this.interceptors.response) {
        processedResponse = await interceptor(processedResponse, config, endpoint);
      }

      return await this.handleResponse(processedResponse, options);

    } catch (error) {
      // Si hay error de conexión, activar modo offline y usar datos demo
      const isConnectionError = error.name === 'AbortError' || 
                               error.name === 'TypeError' ||
                               error.message.includes('Failed to fetch') || 
                               error.message.includes('ERR_CONNECTION_REFUSED') || 
                               error.message.includes('NetworkError') ||
                               error.message.includes('net::ERR_');
      
      if (isConnectionError) {
        if (!this.offlineMode) {
          console.warn('🔌 Servidor no disponible, activando modo offline');
          console.info(`📡 Intentaba conectar a: ${this.baseUrl}${endpoint}`);
          this.offlineMode = true;
          
          // Mostrar notificación de modo offline
          if (typeof showNotification === 'function') {
            showNotification('Modo offline - usando datos de demostración', 'info', 3000);
          }
        }
        
        return await this.getDemoResponse(endpoint, options);
      }

      // Ejecutar interceptores de error para otros tipos de error
      for (const interceptor of this.interceptors.error) {
        error = await interceptor(error, endpoint, options);
      }

      throw error;

    } finally {
      // Ocultar loading
      if (options.showLoading !== false) {
        store.setLoading(false);
      }
    }
  }

  // Método para obtener respuestas de demostración cuando no hay servidor
  async getDemoResponse(endpoint, options = {}) {
    // Simular delay de red
    await new Promise(resolve => setTimeout(resolve, 300 + Math.random() * 200));

    const method = options.method || 'GET';
    
    // Datos de demostración por endpoint
    if (endpoint === '/auth/login') {
      const credentials = options.body ? JSON.parse(options.body) : {};
      const { username, password } = credentials;
      
      // Validar credenciales demo
      const demoUsers = {
        'admin@docuflow.com': { password: 'admin123', role: 'admin', name: 'Administrador' },
        'user@docuflow.com': { password: 'user123', role: 'user', name: 'Usuario Regular' },
        'guest@docuflow.com': { password: 'guest123', role: 'guest', name: 'Invitado' }
      };
      
      const user = demoUsers[username];
      if (user && user.password === password) {
        return {
          success: true,
          user: {
            id: Math.floor(Math.random() * 1000),
            username,
            name: user.name,
            role: user.role,
            email: username
          },
          token: `demo-token-${Date.now()}`,
          message: '¡Inicio de sesión exitoso!'
        };
      } else {
        throw new Error('Credenciales incorrectas');
      }
    }

    // Dashboard stats
    if (endpoint === '/api/dashboard/stats') {
      return {
        success: true,
        data: {
          totalFiles: 156,
          totalStorageUsed: 2147483648, // 2GB en bytes
          totalUsers: 23,
          totalComments: 89,
          recentActivities: 45
        }
      };
    }

    // File stats
    if (endpoint === '/files/stats') {
      return {
        success: true,
        data: {
          totalFiles: 156,
          totalSize: 2147483648,
          fileTypes: { pdf: 45, docx: 32, xlsx: 79 }
        }
      };
    }

    // Dashboard activity
    if (endpoint === '/dashboard/activity' || endpoint === '/api/dashboard/activity') {
      return {
        success: true,
        data: [
          {
            id: 1,
            type: 'file_upload',
            file: 'Documento_Importante.pdf',
            action: 'Subida',
            user: 'Juan Pérez',
            timestamp: new Date(Date.now() - 10 * 60000).toISOString(),
            status: 'success'
          },
          {
            id: 2,
            type: 'comment_added',
            file: 'Presentación_Q4.pptx',
            action: 'Comentario',
            user: 'María García',
            timestamp: new Date(Date.now() - 25 * 60000).toISOString(),
            status: 'info'
          },
          {
            id: 3,
            type: 'file_download',
            file: 'Informe_Anual.xlsx',
            action: 'Descarga',
            user: 'Carlos López',
            timestamp: new Date(Date.now() - 45 * 60000).toISOString(),
            status: 'success'
          }
        ]
      };
    }

    // Files
    if (endpoint === '/files') {
      return {
        success: true,
        data: [
          {
            id: 1,
            name: 'Documento_Importante.pdf',
            size: 2048576,
            type: 'pdf',
            uploadedBy: 'Juan Pérez',
            uploadDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
          },
          {
            id: 2,
            name: 'Presentación_Q4.pptx',
            size: 5242880,
            type: 'pptx',
            uploadedBy: 'María García',
            uploadDate: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()
          }
        ]
      };
    }

    // Comments
    if (endpoint.includes('/comments')) {
      return {
        success: true,
        data: [
          {
            id: 1,
            fileId: 1,
            content: 'Este documento necesita revisión',
            author: 'Juan Pérez',
            createdAt: new Date(Date.now() - 60 * 60000).toISOString()
          }
        ]
      };
    }

    // Default success response for other endpoints
    return {
      success: true,
      data: [],
      message: 'Respuesta de demostración'
    };
  }

  // Procesar respuesta
  async handleResponse(response, options = {}) {
    const contentType = response.headers.get('content-type');
    let data;

    try {
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else if (contentType && contentType.includes('text/')) {
        data = await response.text();
      } else {
        data = await response.blob();
      }
    } catch (error) {
      console.warn('Error parsing response:', error);
      data = null;
    }

    if (!response.ok) {
      // Log detallado del error para debugging
      console.error('❌ HTTP Error Details:', {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        data: data
      });

      let errorMessage = `HTTP ${response.status}: `;
      
      // Mensajes específicos para códigos comunes
      if (response.status === 403) {
        errorMessage += data?.message || 'Acceso denegado. Verifica tus credenciales o permisos.';
      } else if (response.status === 401) {
        errorMessage += data?.message || 'No autorizado. Inicia sesión nuevamente.';
      } else if (response.status === 404) {
        errorMessage += data?.message || 'Endpoint no encontrado.';
      } else if (response.status >= 500) {
        errorMessage += data?.message || 'Error interno del servidor.';
      } else {
        errorMessage += data?.message || response.statusText;
      }

      const error = new Error(errorMessage);
      error.status = response.status;
      error.response = data;
      throw error;
    }

    return data;
  }

  // Métodos HTTP
  get(endpoint, options = {}) {
    return this.request(endpoint, { ...options, method: 'GET' });
  }

  post(endpoint, body, options = {}) {
    const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
    const headers = {
      ...(options.headers || {})
    };

    if (!isFormData && headers['Content-Type'] === undefined) {
      headers['Content-Type'] = 'application/json';
    }

    return this.request(endpoint, {
      ...options,
      method: 'POST',
      headers,
      body: isFormData ? body : JSON.stringify(body)
    });
  }

  put(endpoint, body, options = {}) {
    const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
    const headers = {
      ...(options.headers || {})
    };

    if (!isFormData && headers['Content-Type'] === undefined) {
      headers['Content-Type'] = 'application/json';
    }

    return this.request(endpoint, {
      ...options,
      method: 'PUT',
      headers,
      body: isFormData ? body : JSON.stringify(body)
    });
  }

  delete(endpoint, options = {}) {
    return this.request(endpoint, { ...options, method: 'DELETE' });
  }
}

// Crear instancia del cliente API
const apiClient = new ApiClient();

// Configurar interceptores básicos
apiClient.addRequestInterceptor((config, endpoint) => {
  // Agregar token de autenticación si existe
  const token = localStorage.getItem('authToken') || localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Métodos específicos para la API de DocuFlow
export const docuFlowAPI = {
  // Autenticación
  auth: {
    login: (credentials) => apiClient.post('/login', credentials),
    register: (userData) => apiClient.post('/auth/register', userData),
    logout: () => apiClient.post('/auth/logout', {}),
    refreshToken: () => apiClient.post('/auth/refresh', {})
  },

  // Comentarios
  comments: {
    getAll: () => apiClient.get('/api/comments'),
    getByFileId: (fileId) => apiClient.get(`/api/comments/document/${fileId}`),
    create: (comment) => apiClient.post('/api/comments', comment),
    update: (id, comment) => apiClient.put(`/api/comments/${id}`, comment),
    delete: (id) => apiClient.delete(`/api/comments/${id}`)
  },

  // Dashboard
  dashboard: {
    getStats: () => apiClient.get('/api/dashboard/stats'),
    getFileStats: () => apiClient.get('/api/dashboard/files/stats'),
    getActivity: () => apiClient.get('/api/dashboard/activity'),
    getRecentFiles: (limit = 5) => apiClient.get(`/api/dashboard/recent-files?limit=${limit}`),
    getRecentActivities: (limit = 10) => apiClient.get(`/api/dashboard/recent-activities?limit=${limit}`),
    // Endpoints legacy para compatibilidad
    getUsers: () => apiClient.get('/api/dashboard/users'),
    getComments: () => apiClient.get('/api/dashboard/comments'),
    getLogs: () => apiClient.get('/api/dashboard/logs'),
    getFiles: () => apiClient.get('/api/dashboard/files'),
    getDownloadsToday: () => apiClient.get('/api/dashboard/downloads/today')
  },

  // Permisos
  permissions: {
    getAll: () => apiClient.get('/users'),
    update: (userId, permissions) => apiClient.put(`/users/${userId}/permissions`, { permissions })
  },

  // Logs
  logs: {
    getAll: (params = {}) => {
      const queryString = new URLSearchParams(params).toString();
      return apiClient.get(`/api/logs${queryString ? `?${queryString}` : ''}`);
    },
    getRecent: (limit = 10) => apiClient.get(`/api/logs/recent?limit=${limit}`),
    getCount: () => apiClient.get('/api/logs/count'),
    getByUser: (username) => apiClient.get(`/api/logs/user/${username}`)
  },

  // Archivos
  files: {
    getAll: async () => {
      const data = await apiClient.get('/files');
      if (Array.isArray(data)) {
        return { success: true, files: data };
      }
      if (Array.isArray(data?.files)) {
        return { success: data.success ?? true, files: data.files };
      }
      if (Array.isArray(data?.data)) {
        return { success: data.success ?? true, files: data.data };
      }
      return data;
    },
    getById: (id) => apiClient.get(`/files/${id}`),
    upload: (formData) => apiClient.request('/files', {
      method: 'POST',
      body: formData
    }),
    delete: (id) => apiClient.delete(`/files/${id}`),
    download: (id) => apiClient.get(`/files/${id}/download`, { responseType: 'blob' }),
    getStats: async () => {
      const data = await apiClient.get('/files/stats');
      if (data?.data) {
        return { success: data.success ?? true, ...data.data };
      }
      return data;
    },
    getCount: async () => {
      const data = await apiClient.get('/files/count');
      if (data?.data) {
        return { success: data.success ?? true, ...data.data };
      }
      return data;
    },
    getTotalSize: async () => {
      const data = await apiClient.get('/files/total-size');
      if (data?.data) {
        return { success: data.success ?? true, ...data.data };
      }
      return data;
    }
  }
};

export { ApiClient, apiClient };
export default apiClient;