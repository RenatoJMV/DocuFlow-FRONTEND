// Configuración centralizada de DocuFlow
export const CONFIG = {
  // URLs de API por entorno
  API_ENDPOINTS: {
    development: 'http://localhost:3000/api',
    production: 'https://docuflow-backend.onrender.com/api'
  },

  // Configuraciones de la aplicación
  APP: {
    name: 'DocuFlow',
    version: '1.0.0',
    timeout: 10000
  },

  // Configuraciones de autenticación
  AUTH: {
    tokenKey: 'authToken',
    userDataKey: 'userData',
    sessionTimeout: 24 * 60 * 60 * 1000 // 24 horas
  }
};

// Detectar entorno automáticamente
const isLocalhost = ['localhost', '127.0.0.1', '0.0.0.0', ''].includes(window.location.hostname);

// URL del backend (compatible con configuración anterior)
export const BACKEND_URL = isLocalhost 
  ? 'http://localhost:8080'  // Mantengo el puerto 8080 como estaba
  : 'https://docuflow-backend.onrender.com';

// URL de la API (para el nuevo sistema)
export const API_URL = isLocalhost
  ? CONFIG.API_ENDPOINTS.development
  : CONFIG.API_ENDPOINTS.production;

// Función para obtener configuración actual
export function getCurrentConfig() {
  return {
    ...CONFIG,
    environment: isLocalhost ? 'development' : 'production',
    apiUrl: API_URL,
    backendUrl: BACKEND_URL,
    isDevelopment: isLocalhost,
    isProduction: !isLocalhost
  };
}