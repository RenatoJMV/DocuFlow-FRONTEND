// Configuración centralizada de DocuFlow
export const CONFIG = {
  // URLs de API por entorno
  API_ENDPOINTS: {
    development: 'http://localhost:8080',
    production: 'https://docuflow-backend.onrender.com'
  },

  // Configuraciones de la aplicación
  APP: {
    name: 'DocuFlow',
    version: '1.0.0',
    timeout: 15000
  },

  // Configuraciones de autenticación
  AUTH: {
    tokenKey: 'token',
    userDataKey: 'user',
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

// Modo offline forzado - DESHABILITADO para conectar al backend real
export const FORCE_OFFLINE = false;

console.log(`🌐 Configuración API: ${BACKEND_URL} (${isLocalhost ? 'desarrollo' : 'producción'})`);

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