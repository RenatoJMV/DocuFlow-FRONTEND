// Store Global Simple para DocuFlow
class AppStore {
  constructor() {
    this.state = {
      user: null,
      profile: null,
      preferences: {},
      files: [],
      comments: [],
      notifications: [],
      dashboard: {
        stats: {
          totalFiles: 0,
          totalUsers: 0,
          totalComments: 0,
          downloadsToday: 0,
          documents: 0,
          processed: 0,
          pending: 0,
          errors: 0
        },
        recentActivity: []
      },
      permissions: [],
      logs: [],
      loading: false,
      error: null
    };
    
    this.listeners = new Map();
    this.middleware = [];
    
    // Cargar estado inicial del localStorage
    this.loadFromStorage();
  }

  // Obtener estado completo o una parte específica
  getState(key) {
    if (key) {
      return this.state[key];
    }
    return this.state;
  }

  // Actualizar estado
  setState(key, value) {
    const prevState = { ...this.state };
    
    // Ejecutar middleware
    this.middleware.forEach(middleware => {
      middleware(prevState, { type: 'setState', key, value });
    });
    
    if (typeof key === 'object') {
      // Actualización múltiple: setState({ key1: value1, key2: value2 })
      this.state = { ...this.state, ...key };
      Object.keys(key).forEach(k => this.notify(k, this.state[k]));
    } else {
      // Actualización simple: setState('key', value)
      this.state[key] = value;
      this.notify(key, value);
    }
    
    // Guardar en localStorage
    this.saveToStorage();
  }

  // Actualización parcial de objetos anidados
  updateState(key, updates) {
    if (typeof this.state[key] === 'object' && !Array.isArray(this.state[key])) {
      this.setState(key, { ...this.state[key], ...updates });
    } else {
      console.warn(`Cannot update non-object state key: ${key}`);
    }
  }

  // Suscribirse a cambios en una clave específica
  subscribe(key, callback) {
    if (!this.listeners.has(key)) {
      this.listeners.set(key, []);
    }
    this.listeners.get(key).push(callback);
    
    // Retornar función de desuscripción
    return () => {
      const callbacks = this.listeners.get(key);
      if (callbacks) {
        const index = callbacks.indexOf(callback);
        if (index > -1) {
          callbacks.splice(index, 1);
        }
      }
    };
  }

  // Notificar a los suscriptores
  notify(key, value) {
    if (this.listeners.has(key)) {
      this.listeners.get(key).forEach(callback => {
        try {
          callback(value, this.state);
        } catch (error) {
          console.error(`Error in subscriber for ${key}:`, error);
        }
      });
    }
  }

  // Agregar middleware
  use(middleware) {
    this.middleware.push(middleware);
  }

  // Acciones específicas para el dashboard
  updateDashboardStats(stats) {
    this.updateState('dashboard', { stats: { ...this.state.dashboard.stats, ...stats } });
  }

  addRecentActivity(activity) {
    const currentActivity = this.state.dashboard.recentActivity;
    const newActivity = [activity, ...currentActivity].slice(0, 10); // Mantener solo 10 elementos
    this.updateState('dashboard', { recentActivity: newActivity });
  }

  // Gestión de archivos
  setFiles(files) {
    this.setState('files', files);
    this.updateDashboardStats({ totalFiles: files.length });
  }

  addFile(file) {
    const currentFiles = this.state.files;
    const newFiles = [file, ...currentFiles];
    this.setFiles(newFiles);
    
    // Agregar a actividad reciente
    this.addRecentActivity({
      id: Date.now(),
      type: 'file_upload',
      file: file.name,
      action: 'Subida',
      user: this.state.user?.name || 'Usuario',
      timestamp: new Date().toISOString(),
      status: 'success'
    });
  }

  removeFile(fileId) {
    const currentFiles = this.state.files;
    const newFiles = currentFiles.filter(file => file.id !== fileId);
    this.setFiles(newFiles);
  }

  // Gestión de comentarios
  setComments(comments) {
    this.setState('comments', comments);
    this.updateDashboardStats({ totalComments: comments.length });
  }

  addComment(comment) {
    const currentComments = this.state.comments;
    const newComments = [comment, ...currentComments];
    this.setComments(newComments);
    
    // Agregar a actividad reciente
    this.addRecentActivity({
      id: Date.now(),
      type: 'comment_added',
      file: comment.fileName || 'Comentario general',
      action: 'Comentario',
      user: this.state.user?.name || 'Usuario',
      timestamp: new Date().toISOString(),
      status: 'info'
    });
  }

  // Gestión de usuario
  setUser(user) {
    this.setState('user', user);
  }

  logout() {
    this.setState({
      user: null,
      files: [],
      comments: [],
      permissions: [],
      logs: []
    });
    localStorage.removeItem('authToken');
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('tokenExpiresAt');
    localStorage.removeItem('userData');
    localStorage.removeItem('user');
    this.clearStorage();
  }

  // Gestión de notificaciones
  addNotification(notification) {
    const notifications = this.state.notifications;
    const newNotification = {
      id: Date.now(),
      timestamp: new Date().toISOString(),
      read: false,
      ...notification
    };
    this.setState('notifications', [newNotification, ...notifications].slice(0, 50));
  }

  markNotificationAsRead(notificationId) {
    const notifications = this.state.notifications.map(notif => 
      notif.id === notificationId ? { ...notif, read: true } : notif
    );
    this.setState('notifications', notifications);
  }

  clearAllNotifications() {
    this.setState('notifications', []);
  }

  // Gestión de estado de carga
  setLoading(isLoading) {
    this.setState('loading', isLoading);
  }

  // Gestión de errores
  setError(error) {
    this.setState('error', error);
    if (error) {
      this.addNotification({
        type: 'error',
        title: 'Error',
        message: error.message || error,
        duration: 5000
      });
    }
  }

  clearError() {
    this.setState('error', null);
  }

  // Persistencia en localStorage
  saveToStorage() {
    try {
      const stateToSave = {
        user: this.state.user,
        dashboard: this.state.dashboard,
        notifications: this.state.notifications.slice(0, 20) // Solo las 20 más recientes
      };
      localStorage.setItem('docuflow_state', JSON.stringify(stateToSave));
    } catch (error) {
      console.warn('Could not save state to localStorage:', error);
    }
  }

  loadFromStorage() {
    try {
      const savedState = localStorage.getItem('docuflow_state');
      if (savedState) {
        const parsed = JSON.parse(savedState);
        this.state = { ...this.state, ...parsed };
      }
    } catch (error) {
      console.warn('Could not load state from localStorage:', error);
    }
  }

  clearStorage() {
    try {
      localStorage.removeItem('docuflow_state');
    } catch (error) {
      console.warn('Could not clear localStorage:', error);
    }
  }

  // Utilidades
  getUnreadNotifications() {
    return this.state.notifications.filter(notif => !notif.read);
  }

  getFileById(fileId) {
    return this.state.files.find(file => file.id === fileId);
  }

  getCommentsByFileId(fileId) {
    return this.state.comments.filter(comment => comment.fileId === fileId);
  }

  // Métodos específicos para perfil
  setProfile(profile) {
    this.setState('profile', profile);
  }

  getProfile() {
    return this.getState('profile');
  }

  updateProfile(updates) {
    this.updateState('profile', updates);
  }

  // Métodos para preferencias
  setPreferences(preferences) {
    this.setState('preferences', preferences);
  }

  getPreferences() {
    return this.getState('preferences');
  }

  setPreference(key, value) {
    const currentPreferences = this.getState('preferences') || {};
    this.setState('preferences', {
      ...currentPreferences,
      [key]: value
    });
  }

  getPreference(key, defaultValue = null) {
    const preferences = this.getState('preferences') || {};
    return preferences[key] ?? defaultValue;
  }

  // Verificar si el usuario está autenticado
  isAuthenticated() {
    const user = this.getState('user');
    const token = localStorage.getItem('token');
    return !!(user && token);
  }

  // Verificar rol del usuario
  hasRole(role) {
    const user = this.getState('user');
    return user?.role === role;
  }

  // Verificar permisos del usuario
  hasPermission(permission) {
    const user = this.getState('user');
    const permissions = user?.permissions || [];
    return permissions.includes(permission);
  }

  // Método para cargar configuración inicial del perfil
  async initializeProfile() {
    try {
      // Cargar preferencias del localStorage
      const storedPreferences = localStorage.getItem('userPreferences');
      if (storedPreferences) {
        const preferences = JSON.parse(storedPreferences);
        this.setPreferences(preferences);
      }
      
      return true;
    } catch (error) {
      console.error('Error initializing profile:', error);
      return false;
    }
  }

  // Método para sincronizar preferencias
  syncPreferences(preferences) {
    this.setPreferences(preferences);
    localStorage.setItem('userPreferences', JSON.stringify(preferences));
  }

  // Limpiar datos de usuario (actualizado)
  clearUserData() {
    this.setState({
      user: null,
      profile: null,
      preferences: {},
      files: [],
      comments: [],
      notifications: [],
      permissions: []
    });
  }

  // Debug helpers
  debug() {
    console.log('Current State:', this.state);
    console.log('Listeners:', this.listeners);
  }

  reset() {
    this.state = {
      user: null,
      profile: null,
      preferences: {},
      files: [],
      comments: [],
      notifications: [],
      dashboard: {
        stats: {
          totalFiles: 0,
          totalUsers: 0,
          totalComments: 0,
          downloadsToday: 0,
          documents: 0,
          processed: 0,
          pending: 0,
          errors: 0
        },
        recentActivity: []
      },
      permissions: [],
      logs: [],
      loading: false,
      error: null
    };
    this.clearStorage();
  }
}

// Middleware para logging
const loggingMiddleware = (prevState, action) => {
  if (window.location.search.includes('debug=true')) {
    console.log('Store Action:', action, 'Previous State:', prevState);
  }
};

// Crear instancia global del store
const store = new AppStore();

// Agregar middleware de logging
store.use(loggingMiddleware);

// Helper para conectar componentes al store
export function connectStore(component, dependencies = []) {
  const unsubscribers = [];
  
  dependencies.forEach(key => {
    const unsubscribe = store.subscribe(key, () => {
      if (typeof component.update === 'function') {
        component.update();
      }
    });
    unsubscribers.push(unsubscribe);
  });
  
  // Retornar función de cleanup
  return () => {
    unsubscribers.forEach(unsubscribe => unsubscribe());
  };
}

// Helper para uso con hooks-like pattern
export function useStore(key) {
  return {
    get value() {
      return store.getState(key);
    },
    set(newValue) {
      store.setState(key, newValue);
    },
    update(updates) {
      if (typeof updates === 'function') {
        const currentValue = store.getState(key);
        const newValue = updates(currentValue);
        store.setState(key, newValue);
      } else {
        store.updateState(key, updates);
      }
    },
    subscribe(callback) {
      return store.subscribe(key, callback);
    }
  };
}

// Exportar la instancia del store
export { store };
export default store;