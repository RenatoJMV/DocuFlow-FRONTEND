// Cliente API moderno con fallback offline para DocuFlow
import { store } from './store.js';
import { showNotification, showLoading } from '../utils/uiHelpers.js';
import { getCurrentConfig } from './config.js';
import '../utils/devUtils.js'; // Cargar utilidades de desarrollo

class ApiClient {
  constructor() {
    const config = getCurrentConfig();
    this.config = config;
    
    // Aplicar overrides de desarrollo si existen
    this.baseUrl = this.getEffectiveApiUrl(config);
    this.offlineMode = this.shouldForceOfflineMode(config);
    
    this.interceptors = {
      request: [],
      response: [],
      error: []
    };
    
    // Configuración por defecto
    this.defaults = {
      timeout: config.APP.timeout,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    // Log de configuración (solo en desarrollo)
    if (config.isDevelopment) {
      console.log(`🌐 DocuFlow API configurada:`, {
        environment: config.environment,
        apiUrl: this.baseUrl,
        offlineMode: this.offlineMode,
        hasOverrides: this.baseUrl !== config.apiUrl || this.offlineMode
      });
    }
  }

  getEffectiveApiUrl(config) {
    // Verificar override temporal en desarrollo
    if (config.isDevelopment) {
      const tempUrl = localStorage.getItem('DOCUFLOW_TEMP_API_URL');
      if (tempUrl) {
        console.log(`🔧 Usando API URL temporal: ${tempUrl}`);
        return tempUrl;
      }
    }
    return config.apiUrl;
  }

  shouldForceOfflineMode(config) {
    // Verificar si el modo offline está forzado en desarrollo
    if (config.isDevelopment) {
      const forceOffline = localStorage.getItem('DOCUFLOW_FORCE_OFFLINE');
      if (forceOffline === 'true') {
        console.log('🔌 Modo offline forzado activado');
        return true;
      }
    }
    return false;
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

      // Mostrar loading si está habilitado
      if (options.showLoading !== false) {
        store.setLoading(true);
      }

      // Crear AbortController para timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.defaults.timeout);

      config.signal = controller.signal;

      // Hacer el request
      const response = await fetch(`${this.baseUrl}${endpoint}`, config);
      clearTimeout(timeoutId);

      // Ejecutar interceptores de response
      let processedResponse = response;
      for (const interceptor of this.interceptors.response) {
        processedResponse = await interceptor(processedResponse, config, endpoint);
      }

      return await this.handleResponse(processedResponse, options);

    } catch (error) {
      // Si hay error de conexión, activar modo offline y usar datos demo
      if (error.name === 'AbortError' || error.message.includes('Failed to fetch') || 
          error.message.includes('ERR_CONNECTION_REFUSED') || error.message.includes('NetworkError')) {
        
        if (!this.offlineMode) {
          console.warn('🔌 Servidor no disponible, activando modo offline');
          console.info(`📡 Intentaba conectar a: ${this.baseUrl}${endpoint}`);
          this.offlineMode = true;
          
          // Mostrar notificación de modo offline (se puede comentar si es molesta)
          if (typeof showNotification === 'function') {
            const message = this.config.isDevelopment 
              ? 'Modo offline - usando datos de demostración' 
              : 'Conexión con servidor no disponible - modo offline activado';
            showNotification(message, 'info', 3000);
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
    if (endpoint === '/dashboard/stats') {
      return {
        success: true,
        data: {
          totalFiles: 156,
          totalUsers: 23,
          totalComments: 89,
          downloadsToday: 45,
          documents: 156,
          processed: 142,
          pending: 12,
          errors: 2
        }
      };
    }

    // Dashboard activity
    if (endpoint === '/dashboard/activity') {
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
      const error = new Error(data?.message || `HTTP ${response.status}: ${response.statusText}`);
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
    return this.request(endpoint, {
      ...options,
      method: 'POST',
      body: JSON.stringify(body)
    });
  }

  put(endpoint, body, options = {}) {
    return this.request(endpoint, {
      ...options,
      method: 'PUT',
      body: JSON.stringify(body)
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
  const token = localStorage.getItem('authToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Métodos específicos para la API de DocuFlow
export const docuFlowAPI = {
  // Autenticación
  auth: {
    login: (credentials) => apiClient.post('/auth/login', credentials),
    register: (userData) => apiClient.post('/auth/register', userData),
    logout: () => apiClient.post('/auth/logout', {}),
    refreshToken: () => apiClient.post('/auth/refresh', {})
  },

  // Archivos
  files: {
    getAll: () => apiClient.get('/files'),
    getById: (id) => apiClient.get(`/files/${id}`),
    upload: (fileData) => apiClient.post('/files/upload', fileData),
    delete: (id) => apiClient.delete(`/files/${id}`)
  },

  // Comentarios
  comments: {
    getAll: () => apiClient.get('/comments'),
    getByFileId: (fileId) => apiClient.get(`/comments/file/${fileId}`),
    create: (comment) => apiClient.post('/comments', comment),
    update: (id, comment) => apiClient.put(`/comments/${id}`, comment),
    delete: (id) => apiClient.delete(`/comments/${id}`)
  },

  // Dashboard
  dashboard: {
    getStats: () => apiClient.get('/dashboard/stats'),
    getRecentActivity: () => apiClient.get('/dashboard/activity')
  },

  // Permisos
  permissions: {
    getAll: () => apiClient.get('/permissions'),
    update: (userId, permissions) => apiClient.put(`/permissions/${userId}`, permissions)
  },

  // Logs
  logs: {
    getAll: (params = {}) => {
      const queryString = new URLSearchParams(params).toString();
      return apiClient.get(`/logs${queryString ? `?${queryString}` : ''}`);
    }
  }
};

export { ApiClient, apiClient };
export default apiClient;