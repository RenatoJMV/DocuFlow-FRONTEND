// apiClientSimple.js - Versión simplificada para funcionalidades básicas
import { CONFIG } from './config.js';

class SimpleApiClient {
  constructor() {
    this.baseUrl = CONFIG.API_ENDPOINTS.development;
    
    // Detectar entorno
    if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
      this.baseUrl = CONFIG.API_ENDPOINTS.production;
    }
    
    this.defaultHeaders = {
      'Content-Type': 'application/json'
    };
  }

  // Método principal de request
  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const config = {
      headers: { ...this.defaultHeaders },
      ...options
    };

    // Agregar token si existe
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    try {
      const response = await fetch(url, config);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return { success: true, data };
      
    } catch (error) {
      console.warn('🔌 Error de conexión, usando datos de demostración');
      return this.getDemoResponse(endpoint, options);
    }
  }

  // Métodos HTTP básicos
  async get(endpoint) {
    return this.request(endpoint, { method: 'GET' });
  }

  async post(endpoint, data) {
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async put(endpoint, data) {
    return this.request(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  async delete(endpoint) {
    return this.request(endpoint, { method: 'DELETE' });
  }

  // Upload de archivos
  async upload(endpoint, formData) {
    const url = `${this.baseUrl}${endpoint}`;
    const token = localStorage.getItem('token');
    
    const config = {
      method: 'POST',
      body: formData
    };

    if (token) {
      config.headers = { Authorization: `Bearer ${token}` };
    }

    try {
      const response = await fetch(url, config);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      return { success: true, data };
    } catch (error) {
      return this.getDemoUploadResponse();
    }
  }

  // Respuestas de demostración simplificadas
  getDemoResponse(endpoint, options) {
    const method = options.method || 'GET';
    const body = options.body ? JSON.parse(options.body) : null;

    // Autenticación
    if (endpoint === '/auth/login' && method === 'POST') {
      const { username, password } = body;
      const demoUsers = {
        'admin@docuflow.com': { password: 'admin123', role: 'admin', name: 'Administrador' },
        'user@docuflow.com': { password: 'user123', role: 'user', name: 'Usuario Regular' }
      };

      const user = demoUsers[username];
      if (user && user.password === password) {
        localStorage.setItem('token', `demo-token-${Date.now()}`);
        localStorage.setItem('user', JSON.stringify({
          id: Date.now(),
          username,
          name: user.name,
          role: user.role,
          email: username
        }));
        
        return {
          success: true,
          data: {
            user: { username, name: user.name, role: user.role },
            token: `demo-token-${Date.now()}`
          }
        };
      } else {
        return { success: false, error: 'Credenciales incorrectas' };
      }
    }

    // Archivos
    if (endpoint.startsWith('/files')) {
      if (method === 'GET') {
        return {
          success: true,
          data: {
            files: [
              {
                id: 1,
                name: 'documento.pdf',
                size: 1024000,
                type: 'application/pdf',
                uploadedAt: new Date().toISOString(),
                uploadedBy: 'admin@docuflow.com'
              },
              {
                id: 2,
                name: 'imagen.jpg',
                size: 512000,
                type: 'image/jpeg',
                uploadedAt: new Date().toISOString(),
                uploadedBy: 'user@docuflow.com'
              }
            ]
          }
        };
      }
    }

    // Comentarios
    if (endpoint.startsWith('/comments')) {
      if (method === 'GET') {
        return {
          success: true,
          data: {
            comments: [
              {
                id: 1,
                fileId: 1,
                content: 'Este documento necesita revisión',
                author: 'admin@docuflow.com',
                createdAt: new Date().toISOString(),
                type: 'comment'
              },
              {
                id: 2,
                fileId: 1,
                content: 'Tarea: Revisar formato',
                author: 'user@docuflow.com',
                createdAt: new Date().toISOString(),
                type: 'task',
                completed: false
              }
            ]
          }
        };
      }
    }

    // Logs
    if (endpoint.startsWith('/logs')) {
      return {
        success: true,
        data: {
          logs: [
            {
              id: 1,
              action: 'file_upload',
              user: 'admin@docuflow.com',
              target: 'documento.pdf',
              timestamp: new Date().toISOString()
            },
            {
              id: 2,
              action: 'file_download',
              user: 'user@docuflow.com',
              target: 'documento.pdf',
              timestamp: new Date().toISOString()
            }
          ]
        }
      };
    }

    // Permisos
    if (endpoint.startsWith('/permissions')) {
      return {
        success: true,
        data: {
          permissions: [
            { userId: 1, fileId: 1, permission: 'read' },
            { userId: 1, fileId: 1, permission: 'write' },
            { userId: 2, fileId: 1, permission: 'read' }
          ]
        }
      };
    }

    // Respuesta por defecto
    return { success: true, data: {} };
  }

  getDemoUploadResponse() {
    return {
      success: true,
      data: {
        file: {
          id: Date.now(),
          name: 'archivo_demo.pdf',
          size: 1024000,
          type: 'application/pdf',
          uploadedAt: new Date().toISOString(),
          url: '#'
        }
      }
    };
  }
}

// Instancia global
const apiClient = new SimpleApiClient();

// API específica de DocuFlow simplificada
const docuFlowAPI = {
  // Autenticación
  auth: {
    login: (credentials) => apiClient.post('/auth/login', credentials),
    logout: () => {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      return Promise.resolve({ success: true });
    }
  },

  // Archivos
  files: {
    list: (filters = {}) => apiClient.get('/files'),
    upload: (formData) => apiClient.upload('/files/upload', formData),
    download: (fileId) => apiClient.get(`/files/${fileId}/download`),
    delete: (fileId) => apiClient.delete(`/files/${fileId}`),
    search: (query) => apiClient.get(`/files/search?q=${encodeURIComponent(query)}`)
  },

  // Comentarios y tareas
  comments: {
    list: (fileId) => apiClient.get(`/comments?fileId=${fileId}`),
    create: (comment) => apiClient.post('/comments', comment),
    update: (id, comment) => apiClient.put(`/comments/${id}`, comment),
    delete: (id) => apiClient.delete(`/comments/${id}`)
  },

  // Logs
  logs: {
    list: (filters = {}) => apiClient.get('/logs'),
    create: (log) => apiClient.post('/logs', log)
  },

  // Permisos
  permissions: {
    list: (fileId) => apiClient.get(`/permissions?fileId=${fileId}`),
    grant: (permission) => apiClient.post('/permissions', permission),
    revoke: (id) => apiClient.delete(`/permissions/${id}`)
  }
};

export { SimpleApiClient, apiClient, docuFlowAPI };
export default apiClient;