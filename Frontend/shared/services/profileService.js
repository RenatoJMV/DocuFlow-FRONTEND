// Servicio para gestión de perfiles de usuario
import { docuFlowAPI } from './apiClient.js';
import { store } from './store.js';
import { showNotification } from '../utils/uiHelpers.js';

class ProfileService {
  constructor() {
    this.currentProfile = null;
    this.preferences = null;
    this.activityHistory = [];
    this.sessions = [];
    
    // Cache de datos
    this.cache = {
      profile: null,
      preferences: null,
      activity: null,
      stats: null,
      lastUpdate: null
    };
    
    // Configuración de cache (5 minutos)
    this.cacheTimeout = 5 * 60 * 1000;
  }

  // Obtener perfil actual con cache
  async getCurrentProfile(forceRefresh = false) {
    const now = Date.now();
    
    if (!forceRefresh && 
        this.cache.profile && 
        this.cache.lastUpdate && 
        (now - this.cache.lastUpdate) < this.cacheTimeout) {
      return this.cache.profile;
    }

    try {
      const response = await docuFlowAPI.profile.getCurrent();
      
      if (response.success) {
        this.currentProfile = response.data;
        this.cache.profile = response.data;
        this.cache.lastUpdate = now;
        
        // Actualizar store global
        store.setUser(response.data.user);
        
        return response.data;
      }
      
      throw new Error(response.message || 'Error al cargar perfil');
    } catch (error) {
      console.error('Error getting current profile:', error);
      throw error;
    }
  }

  // Actualizar perfil
  async updateProfile(profileData) {
    try {
      // Validar datos antes de enviar
      const validatedData = this.validateProfileData(profileData);
      
      const response = await docuFlowAPI.profile.update(validatedData);
      
      if (response.success) {
        // Actualizar cache
        this.currentProfile = { ...this.currentProfile, ...validatedData };
        this.cache.profile = this.currentProfile;
        this.cache.lastUpdate = Date.now();
        
        // Registrar actividad
        this.addActivityRecord({
          type: 'profile_update',
          title: 'Perfil actualizado',
          description: 'Se actualizó la información del perfil',
          timestamp: new Date().toISOString()
        });
        
        return response.data;
      }
      
      throw new Error(response.message || 'Error al actualizar perfil');
    } catch (error) {
      console.error('Error updating profile:', error);
      throw error;
    }
  }

  // Validar datos del perfil
  validateProfileData(data) {
    const validatedData = { ...data };
    
    // Validar email
    if (validatedData.email && !this.isValidEmail(validatedData.email)) {
      throw new Error('El formato del email no es válido');
    }
    
    // Validar teléfono
    if (validatedData.phone && !this.isValidPhone(validatedData.phone)) {
      throw new Error('El formato del teléfono no es válido');
    }
    
    // Limpiar campos vacíos
    Object.keys(validatedData).forEach(key => {
      if (validatedData[key] === '') {
        validatedData[key] = null;
      }
    });
    
    return validatedData;
  }

  // Subir avatar
  async uploadAvatar(file) {
    try {
      // Validar archivo
      this.validateAvatarFile(file);
      
      const response = await docuFlowAPI.profile.uploadAvatar(file);
      
      if (response.success) {
        // Actualizar cache con nueva URL de avatar
        if (this.currentProfile) {
          this.currentProfile.avatarUrl = response.data.avatarUrl;
          this.cache.profile = this.currentProfile;
        }
        
        this.addActivityRecord({
          type: 'profile_update',
          title: 'Avatar actualizado',
          description: 'Se cambió la foto de perfil',
          timestamp: new Date().toISOString()
        });
        
        return response.data;
      }
      
      throw new Error(response.message || 'Error al subir avatar');
    } catch (error) {
      console.error('Error uploading avatar:', error);
      throw error;
    }
  }

  // Validar archivo de avatar
  validateAvatarFile(file) {
    // Validar tipo
    if (!file.type.startsWith('image/')) {
      throw new Error('El archivo debe ser una imagen');
    }
    
    // Validar tamaño (máximo 5MB)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      throw new Error('La imagen debe ser menor a 5MB');
    }
    
    // Validar dimensiones (opcional)
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const maxDimension = 2048;
        if (img.width > maxDimension || img.height > maxDimension) {
          reject(new Error(`Las dimensiones máximas son ${maxDimension}x${maxDimension}px`));
        } else {
          resolve(true);
        }
      };
      img.onerror = () => reject(new Error('No se pudo procesar la imagen'));
      img.src = URL.createObjectURL(file);
    });
  }

  // Remover avatar
  async removeAvatar() {
    try {
      const response = await docuFlowAPI.profile.removeAvatar();
      
      if (response.success) {
        // Actualizar cache
        if (this.currentProfile) {
          this.currentProfile.avatarUrl = null;
          this.cache.profile = this.currentProfile;
        }
        
        this.addActivityRecord({
          type: 'profile_update',
          title: 'Avatar removido',
          description: 'Se eliminó la foto de perfil',
          timestamp: new Date().toISOString()
        });
        
        return response.data;
      }
      
      throw new Error(response.message || 'Error al remover avatar');
    } catch (error) {
      console.error('Error removing avatar:', error);
      throw error;
    }
  }

  // Obtener historial de actividad
  async getActivityHistory(params = {}) {
    try {
      const response = await docuFlowAPI.profile.getActivity(params);
      
      if (response.success) {
        this.activityHistory = response.data;
        this.cache.activity = response.data;
        
        return response.data;
      }
      
      throw new Error(response.message || 'Error al cargar historial');
    } catch (error) {
      console.error('Error getting activity history:', error);
      throw error;
    }
  }

  // Agregar registro de actividad local
  addActivityRecord(activity) {
    if (this.activityHistory) {
      this.activityHistory.unshift(activity);
      
      // Mantener solo los últimos 50 registros
      if (this.activityHistory.length > 50) {
        this.activityHistory = this.activityHistory.slice(0, 50);
      }
      
      this.cache.activity = this.activityHistory;
    }
  }

  // Obtener preferencias
  async getPreferences() {
    try {
      const response = await docuFlowAPI.profile.getPreferences();
      
      if (response.success) {
        this.preferences = response.data;
        this.cache.preferences = response.data;
        
        return response.data;
      }
      
      throw new Error(response.message || 'Error al cargar preferencias');
    } catch (error) {
      console.error('Error getting preferences:', error);
      throw error;
    }
  }

  // Actualizar preferencias
  async updatePreferences(preferences) {
    try {
      const response = await docuFlowAPI.profile.updatePreferences(preferences);
      
      if (response.success) {
        this.preferences = { ...this.preferences, ...preferences };
        this.cache.preferences = this.preferences;
        
        // Aplicar preferencias inmediatamente
        this.applyPreferences(this.preferences);
        
        // Guardar en localStorage
        localStorage.setItem('userPreferences', JSON.stringify(this.preferences));
        
        this.addActivityRecord({
          type: 'profile_update',
          title: 'Preferencias actualizadas',
          description: 'Se modificaron las configuraciones del usuario',
          timestamp: new Date().toISOString()
        });
        
        return response.data;
      }
      
      throw new Error(response.message || 'Error al actualizar preferencias');
    } catch (error) {
      console.error('Error updating preferences:', error);
      throw error;
    }
  }

  // Aplicar preferencias
  applyPreferences(preferences) {
    if (!preferences) return;
    
    // Aplicar tema
    if (preferences.theme) {
      document.documentElement.setAttribute('data-theme', preferences.theme);
    }
    
    // Aplicar idioma
    if (preferences.language) {
      document.documentElement.setAttribute('lang', preferences.language);
    }
    
    // Configurar notificaciones
    if (window.notificationController) {
      window.notificationController.setSoundEnabled(preferences.soundNotifications);
    }
    
    // Configurar otras preferencias
    this.configureSystemPreferences(preferences);
  }

  // Configurar preferencias del sistema
  configureSystemPreferences(preferences) {
    // Auto-save
    if (preferences.autoSave !== undefined) {
      store.setPreference('autoSave', preferences.autoSave);
    }
    
    // Vista previa de archivos
    if (preferences.filePreview !== undefined) {
      store.setPreference('filePreview', preferences.filePreview);
    }
    
    // Timezone
    if (preferences.timezone) {
      store.setPreference('timezone', preferences.timezone);
    }
  }

  // Cambiar contraseña
  async changePassword(passwordData) {
    try {
      // Validar datos de contraseña
      this.validatePasswordData(passwordData);
      
      const response = await docuFlowAPI.profile.changePassword(passwordData);
      
      if (response.success) {
        this.addActivityRecord({
          type: 'password_change',
          title: 'Contraseña cambiada',
          description: 'Se actualizó la contraseña de la cuenta',
          timestamp: new Date().toISOString()
        });
        
        return response.data;
      }
      
      throw new Error(response.message || 'Error al cambiar contraseña');
    } catch (error) {
      console.error('Error changing password:', error);
      throw error;
    }
  }

  // Validar datos de contraseña
  validatePasswordData(data) {
    const { currentPassword, newPassword } = data;
    
    if (!currentPassword || currentPassword.length < 1) {
      throw new Error('La contraseña actual es requerida');
    }
    
    if (!newPassword || newPassword.length < 8) {
      throw new Error('La nueva contraseña debe tener al menos 8 caracteres');
    }
    
    // Validar complejidad de contraseña
    if (!this.isStrongPassword(newPassword)) {
      throw new Error('La contraseña debe contener al menos una mayúscula, una minúscula y un número');
    }
  }

  // Obtener estadísticas del perfil
  async getProfileStats() {
    try {
      const response = await docuFlowAPI.profile.getStats();
      
      if (response.success) {
        this.cache.stats = response.data;
        return response.data;
      }
      
      throw new Error(response.message || 'Error al cargar estadísticas');
    } catch (error) {
      console.error('Error getting profile stats:', error);
      throw error;
    }
  }

  // Obtener sesiones activas
  async getSessions() {
    try {
      const response = await docuFlowAPI.profile.getSessions();
      
      if (response.success) {
        this.sessions = response.data;
        return response.data;
      }
      
      throw new Error(response.message || 'Error al cargar sesiones');
    } catch (error) {
      console.error('Error getting sessions:', error);
      throw error;
    }
  }

  // Revocar sesión
  async revokeSession(sessionId) {
    try {
      const response = await docuFlowAPI.profile.revokeSession(sessionId);
      
      if (response.success) {
        // Actualizar lista de sesiones
        this.sessions = this.sessions.filter(session => session.id !== sessionId);
        
        this.addActivityRecord({
          type: 'security',
          title: 'Sesión revocada',
          description: 'Se cerró una sesión activa',
          timestamp: new Date().toISOString()
        });
        
        return response.data;
      }
      
      throw new Error(response.message || 'Error al revocar sesión');
    } catch (error) {
      console.error('Error revoking session:', error);
      throw error;
    }
  }

  // Utilidades de validación
  isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  isValidPhone(phone) {
    const phoneRegex = /^[\+]?[0-9\s\-\(\)]{10,}$/;
    return phoneRegex.test(phone);
  }

  isStrongPassword(password) {
    const strongRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])/;
    return strongRegex.test(password);
  }

  // Obtener iniciales del usuario
  getUserInitials(profile = null) {
    const userProfile = profile || this.currentProfile;
    if (!userProfile) return 'U';
    
    const firstName = userProfile.firstName || '';
    const lastName = userProfile.lastName || '';
    
    if (firstName && lastName) {
      return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
    } else if (firstName) {
      return firstName.charAt(0).toUpperCase();
    } else {
      return userProfile.username?.charAt(0).toUpperCase() || 'U';
    }
  }

  // Formatear tamaño de archivo
  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  // Limpiar cache
  clearCache() {
    this.cache = {
      profile: null,
      preferences: null,
      activity: null,
      stats: null,
      lastUpdate: null
    };
  }

  // Cargar preferencias desde localStorage
  loadStoredPreferences() {
    try {
      const stored = localStorage.getItem('userPreferences');
      if (stored) {
        const preferences = JSON.parse(stored);
        this.applyPreferences(preferences);
        return preferences;
      }
    } catch (error) {
      console.warn('Error loading stored preferences:', error);
    }
    return null;
  }

  // Inicializar servicio
  async initialize() {
    try {
      // Cargar preferencias almacenadas
      this.loadStoredPreferences();
      
      // Cargar perfil actual
      await this.getCurrentProfile();
      
      return true;
    } catch (error) {
      console.error('Error initializing profile service:', error);
      return false;
    }
  }
}

// Crear instancia del servicio
const profileService = new ProfileService();

export { ProfileService, profileService };
export default profileService;