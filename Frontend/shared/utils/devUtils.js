// Utilidades de configuración para desarrollo de DocuFlow

import { getCurrentConfig } from './config.js';

/**
 * Utilidades disponibles solo en modo desarrollo
 * Para usar en la consola del navegador durante desarrollo
 */
export const DevUtils = {
  
  /**
   * Mostrar configuración actual
   */
  showConfig() {
    const config = getCurrentConfig();
    console.table({
      'Entorno': config.environment,
      'API URL': config.apiUrl,
      'Backend URL': config.backendUrl,
      'Es desarrollo': config.isDevelopment ? '✅' : '❌',
      'Es producción': config.isProduction ? '✅' : '❌'
    });
    return config;
  },

  /**
   * Cambiar temporalmente la URL de la API (solo desarrollo)
   * @param {string} url - Nueva URL de la API
   */
  setTempApiUrl(url) {
    const config = getCurrentConfig();
    if (!config.isDevelopment) {
      console.warn('⚠️ Esta función solo está disponible en desarrollo');
      return false;
    }

    localStorage.setItem('DOCUFLOW_TEMP_API_URL', url);
    console.log(`🔧 API URL temporal configurada: ${url}`);
    console.log('💡 Recarga la página para aplicar los cambios');
    return true;
  },

  /**
   * Restaurar URL de API por defecto
   */
  resetApiUrl() {
    localStorage.removeItem('DOCUFLOW_TEMP_API_URL');
    console.log('🔄 URL de API restaurada a configuración por defecto');
    console.log('💡 Recarga la página para aplicar los cambios');
  },

  /**
   * Activar/desactivar modo offline forzado
   * @param {boolean} enabled - true para activar modo offline
   */
  forceOfflineMode(enabled = true) {
    const config = getCurrentConfig();
    if (!config.isDevelopment) {
      console.warn('⚠️ Esta función solo está disponible en desarrollo');
      return false;
    }

    if (enabled) {
      localStorage.setItem('DOCUFLOW_FORCE_OFFLINE', 'true');
      console.log('🔌 Modo offline forzado activado');
    } else {
      localStorage.removeItem('DOCUFLOW_FORCE_OFFLINE');
      console.log('🌐 Modo offline forzado desactivado');
    }
    console.log('💡 Recarga la página para aplicar los cambios');
    return true;
  },

  /**
   * Limpiar todos los datos de desarrollo
   */
  clearDevData() {
    const keys = ['DOCUFLOW_TEMP_API_URL', 'DOCUFLOW_FORCE_OFFLINE'];
    keys.forEach(key => localStorage.removeItem(key));
    console.log('🧹 Datos de desarrollo limpiados');
    console.log('💡 Recarga la página para aplicar los cambios');
  }
};

// Hacer DevUtils disponible globalmente en desarrollo
if (getCurrentConfig().isDevelopment) {
  window.DevUtils = DevUtils;
  console.log('🛠️ DevUtils disponible globalmente. Usa DevUtils.showConfig() para ver la configuración');
}