// authServiceSimple.js - Servicio de autenticación simplificado
import { docuFlowAPI } from './apiClientSimple.js';

class SimpleAuthService {
  constructor() {
    this.currentUser = null;
    this.isAuthenticated = false;
    this.loadStoredUser();
  }

  // Cargar usuario almacenado
  loadStoredUser() {
    try {
      const token = localStorage.getItem('token');
      const userStr = localStorage.getItem('user');
      
      if (token && userStr) {
        this.currentUser = JSON.parse(userStr);
        this.isAuthenticated = true;
      }
    } catch (error) {
      console.warn('Error cargando usuario almacenado:', error);
      this.logout();
    }
  }

  // Iniciar sesión
  async login(credentials) {
    try {
      const response = await docuFlowAPI.auth.login(credentials);
      
      if (response.success && response.data) {
        this.currentUser = response.data.user;
        this.isAuthenticated = true;
        
        // Almacenar en localStorage
        localStorage.setItem('token', response.data.token);
        localStorage.setItem('user', JSON.stringify(response.data.user));
        
        console.log('✅ Login exitoso:', this.currentUser.name);
        return { success: true, data: response.data };
      } else {
        throw new Error(response.error || 'Error de autenticación');
      }
    } catch (error) {
      console.error('❌ Error en login:', error);
      return { success: false, error: error.message };
    }
  }

  // Cerrar sesión
  async logout() {
    try {
      await docuFlowAPI.auth.logout();
    } catch (error) {
      console.warn('Error al cerrar sesión en servidor:', error);
    }
    
    // Limpiar estado local
    this.currentUser = null;
    this.isAuthenticated = false;
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    
    console.log('✅ Sesión cerrada');
    return { success: true };
  }

  // Obtener usuario actual
  getCurrentUser() {
    return this.currentUser;
  }

  // Verificar si está autenticado
  isLoggedIn() {
    return this.isAuthenticated && this.currentUser && localStorage.getItem('token');
  }

  // Verificar permisos básicos
  hasPermission(permission) {
    if (!this.isAuthenticated || !this.currentUser) return false;
    
    const role = this.currentUser.role;
    
    switch (permission) {
      case 'upload_files':
        return ['admin', 'user'].includes(role);
      case 'delete_files':
        return ['admin'].includes(role);
      case 'manage_users':
        return ['admin'].includes(role);
      case 'view_logs':
        return ['admin'].includes(role);
      case 'read_files':
        return ['admin', 'user', 'guest'].includes(role);
      default:
        return false;
    }
  }

  // Verificar si es administrador
  isAdmin() {
    return this.currentUser?.role === 'admin';
  }

  // Verificar si es usuario regular
  isUser() {
    return this.currentUser?.role === 'user';
  }

  // Obtener token
  getToken() {
    return localStorage.getItem('token');
  }

  // Verificar si el token es válido (básico)
  isTokenValid() {
    const token = this.getToken();
    if (!token) return false;
    
    // Verificación básica - en un sistema real verificarías la expiración
    return token.startsWith('demo-token-') || token.length > 10;
  }

  // Renovar sesión (simplificado)
  async refreshSession() {
    if (!this.isTokenValid()) {
      await this.logout();
      return false;
    }
    return true;
  }
}

// Instancia global
const authService = new SimpleAuthService();

export { SimpleAuthService, authService };
export default authService;