// Servicio de Autenticación con Seguridad Avanzada para DocuFlow
// Implementa autenticación JWT con las mejores prácticas de seguridad

import securityService from './securityService.js';
import { store } from './store.js';

class AuthService {
  constructor() {
    this.isAuthenticated = false;
    this.currentUser = null;
    this.loginAttempts = new Map();
    this.sessionTimeout = 30 * 60 * 1000; // 30 minutos
    this.refreshTokenTimeout = null;
    this.securityConfig = {
      maxLoginAttempts: 5,
      lockoutDuration: 15 * 60 * 1000, // 15 minutos
      enforcePasswordPolicy: true,
      enableTwoFactor: false,
      sessionTimeoutWarning: 5 * 60 * 1000 // 5 minutos antes del timeout
    };
    
    this.init();
  }

  async init() {
    // Verificar si hay una sesión válida almacenada de forma segura
    await this.checkStoredSession();
    this.setupSessionMonitoring();
    this.setupSecurityEventListeners();
  }

  // ============================================================================
  // AUTENTICACIÓN PRINCIPAL
  // ============================================================================

  async login(credentials) {
    try {
      // Validar entrada antes del envío
      if (!this.validateCredentials(credentials)) {
        throw new Error('Invalid credentials format');
      }

      // Verificar rate limiting de login
      if (this.isLoginRateLimited(credentials.email)) {
        const remainingTime = this.getRemainingLockoutTime(credentials.email);
        throw new Error(`Too many login attempts. Try again in ${Math.ceil(remainingTime / 60000)} minutes.`);
      }

      // Sanitizar credenciales
      const sanitizedCredentials = {
        email: securityService.sanitizeInput('html', credentials.email),
        password: credentials.password // No sanitizar password
      };

      // Realizar petición de login
      const response = await this.makeSecureRequest('/auth/login', 'POST', sanitizedCredentials);
      
      if (response.data && response.data.token) {
        await this.handleSuccessfulLogin(response.data);
        this.recordSuccessfulLogin(credentials.email);
        return response.data;
      } else {
        throw new Error('Invalid login response');
      }

    } catch (error) {
      this.recordFailedLogin(credentials.email);
      securityService.logSecurityEvent('login_failed', 'Login attempt failed', {
        email: credentials.email,
        error: error.message,
        timestamp: new Date().toISOString()
      });
      throw error;
    }
  }

  async makeSecureRequest(url, method, data) {
    const baseURL = this.getBaseURL();
    const response = await fetch(`${baseURL}${url}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': securityService.csrfToken,
        ...Object.fromEntries(securityService.securityHeaders)
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return {
      data: await response.json(),
      status: response.status
    };
  }

  getBaseURL() {
    const isProduction = window.location.hostname !== 'localhost' && 
                        window.location.hostname !== '127.0.0.1';
    
    if (isProduction) {
      return window.location.protocol + '//' + window.location.hostname + ':8080/api';
    }
    
    return 'http://localhost:8080/api';
  }

  async handleSuccessfulLogin(loginData) {
    // Almacenar tokens de forma segura
    await securityService.setSecureItem('token', loginData.token);
    
    if (loginData.refreshToken) {
      await securityService.setSecureItem('refreshToken', loginData.refreshToken);
    }

    // Almacenar datos del usuario de forma segura
    if (loginData.user) {
      const sanitizedUser = this.sanitizeUserData(loginData.user);
      await securityService.setSecureItem('userData', sanitizedUser);
      this.currentUser = sanitizedUser;
    }

    this.isAuthenticated = true;
    
    // Configurar auto-refresh del token
    this.setupTokenRefresh(loginData.expiresIn);
    
    // Registrar evento de seguridad
    securityService.logSecurityEvent('login_success', 'User logged in successfully', {
      userId: loginData.user?.id,
      email: loginData.user?.email,
      timestamp: new Date().toISOString()
    });

    // Actualizar estado global
    store.updateState('auth', {
      isAuthenticated: true,
      user: this.currentUser,
      token: loginData.token
    });
  }

  async logout() {
    try {
      // Intentar logout en el servidor
      const token = await securityService.getSecureItem('token');
      if (token) {
        try {
          await this.makeSecureRequest('/auth/logout', 'POST', {});
        } catch (error) {
          console.warn('Server logout failed:', error.message);
        }
      }

      // Limpiar datos locales de forma segura
      await this.clearSession();
      
      securityService.logSecurityEvent('logout', 'User logged out', {
        userId: this.currentUser?.id,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Logout error:', error);
      // Forzar limpieza local incluso si el logout del servidor falla
      await this.clearSession();
    }
  }

  async clearSession() {
    // Limpiar todos los datos sensibles
    securityService.clearSensitiveData();
    
    // Limpiar estado local
    this.isAuthenticated = false;
    this.currentUser = null;
    
    // Limpiar timeouts
    if (this.refreshTokenTimeout) {
      clearTimeout(this.refreshTokenTimeout);
      this.refreshTokenTimeout = null;
    }

    // Actualizar estado global
    store.updateState('auth', {
      isAuthenticated: false,
      user: null,
      token: null
    });
  }

  // ============================================================================
  // GESTIÓN DE TOKENS
  // ============================================================================

  async getValidToken() {
    const token = await securityService.getSecureItem('token');
    
    if (!token) {
      return null;
    }

    // Verificar si el token está próximo a expirar
    if (this.isTokenNearExpiry(token)) {
      try {
        await this.refreshToken();
        return await securityService.getSecureItem('token');
      } catch (error) {
        console.error('Token refresh failed:', error);
        await this.logout();
        return null;
      }
    }

    return token;
  }

  async refreshToken() {
    try {
      const refreshToken = await securityService.getSecureItem('refreshToken');
      
      if (!refreshToken) {
        throw new Error('No refresh token available');
      }

      const response = await this.makeSecureRequest('/auth/refresh', 'POST', {
        refreshToken: refreshToken
      });

      if (response.data && response.data.token) {
        await securityService.setSecureItem('token', response.data.token);
        
        if (response.data.refreshToken) {
          await securityService.setSecureItem('refreshToken', response.data.refreshToken);
        }

        this.setupTokenRefresh(response.data.expiresIn);
        
        securityService.logSecurityEvent('token_refreshed', 'Token refreshed successfully');
        
        return response.data.token;
      } else {
        throw new Error('Invalid refresh response');
      }

    } catch (error) {
      securityService.logSecurityEvent('token_refresh_failed', 'Token refresh failed', {
        error: error.message
      });
      throw error;
    }
  }

  setupTokenRefresh(expiresIn) {
    if (this.refreshTokenTimeout) {
      clearTimeout(this.refreshTokenTimeout);
    }

    // Renovar el token 5 minutos antes de que expire
    const refreshTime = (expiresIn * 1000) - (5 * 60 * 1000);
    
    this.refreshTokenTimeout = setTimeout(async () => {
      try {
        await this.refreshToken();
      } catch (error) {
        console.error('Automatic token refresh failed:', error);
        await this.logout();
      }
    }, refreshTime);
  }

  isTokenNearExpiry(token) {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const expiryTime = payload.exp * 1000;
      const currentTime = Date.now();
      const timeUntilExpiry = expiryTime - currentTime;
      
      // Considerar "próximo a expirar" si quedan menos de 5 minutos
      return timeUntilExpiry < (5 * 60 * 1000);
    } catch (error) {
      console.error('Error parsing token:', error);
      return true; // Considerar expirado si no se puede parsear
    }
  }

  // ============================================================================
  // VALIDACIONES Y SEGURIDAD
  // ============================================================================

  validateCredentials(credentials) {
    if (!credentials || typeof credentials !== 'object') {
      return false;
    }

    const { email, password } = credentials;

    // Validar email
    if (!email || !securityService.validateInput('email', email)) {
      return false;
    }

    // Validar password (solo que exista para login, no validar complejidad)
    if (!password || typeof password !== 'string' || password.length === 0) {
      return false;
    }

    return true;
  }

  sanitizeUserData(userData) {
    if (!userData || typeof userData !== 'object') {
      return null;
    }

    const sanitized = {};
    const allowedFields = ['id', 'email', 'name', 'role', 'avatar', 'preferences', 'lastLogin'];

    for (const field of allowedFields) {
      if (userData[field] !== undefined) {
        if (typeof userData[field] === 'string') {
          sanitized[field] = securityService.sanitizeInput('html', userData[field]);
        } else {
          sanitized[field] = userData[field];
        }
      }
    }

    return sanitized;
  }

  // ============================================================================
  // RATE LIMITING DE LOGIN
  // ============================================================================

  isLoginRateLimited(email) {
    const attempts = this.loginAttempts.get(email);
    
    if (!attempts) {
      return false;
    }

    return attempts.count >= this.securityConfig.maxLoginAttempts &&
           Date.now() - attempts.lastAttempt < this.securityConfig.lockoutDuration;
  }

  getRemainingLockoutTime(email) {
    const attempts = this.loginAttempts.get(email);
    
    if (!attempts) {
      return 0;
    }

    const timeSinceLastAttempt = Date.now() - attempts.lastAttempt;
    return Math.max(0, this.securityConfig.lockoutDuration - timeSinceLastAttempt);
  }

  recordFailedLogin(email) {
    const now = Date.now();
    const attempts = this.loginAttempts.get(email) || { count: 0, lastAttempt: 0 };

    // Reset counter si ha pasado el tiempo de lockout
    if (now - attempts.lastAttempt > this.securityConfig.lockoutDuration) {
      attempts.count = 0;
    }

    attempts.count++;
    attempts.lastAttempt = now;
    
    this.loginAttempts.set(email, attempts);

    if (attempts.count >= this.securityConfig.maxLoginAttempts) {
      securityService.logSecurityEvent('account_locked', 'Account locked due to multiple failed login attempts', {
        email,
        attempts: attempts.count,
        lockoutDuration: this.securityConfig.lockoutDuration
      });
    }
  }

  recordSuccessfulLogin(email) {
    // Limpiar intentos fallidos después de login exitoso
    this.loginAttempts.delete(email);
  }

  // ============================================================================
  // MONITOREO DE SESIÓN
  // ============================================================================

  setupSessionMonitoring() {
    // Verificar sesión periódicamente
    setInterval(async () => {
      if (this.isAuthenticated) {
        const token = await securityService.getSecureItem('token');
        if (!token || this.isTokenExpired(token)) {
          await this.logout();
        }
      }
    }, 60000); // Verificar cada minuto
  }

  setupSecurityEventListeners() {
    // Detectar cambios de pestaña/ventana
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        securityService.logSecurityEvent('session_hidden', 'Session became hidden');
      } else {
        securityService.logSecurityEvent('session_visible', 'Session became visible');
      }
    });

    // Detectar actividad del usuario para renovar sesión
    const activityEvents = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    const resetSessionTimeout = () => {
      if (this.sessionTimeoutId) {
        clearTimeout(this.sessionTimeoutId);
      }
      
      this.sessionTimeoutId = setTimeout(async () => {
        if (this.isAuthenticated) {
          securityService.logSecurityEvent('session_timeout', 'Session expired due to inactivity');
          await this.logout();
        }
      }, this.sessionTimeout);
    };

    activityEvents.forEach(event => {
      document.addEventListener(event, resetSessionTimeout, true);
    });

    // Inicializar timeout
    resetSessionTimeout();
  }

  isTokenExpired(token) {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return Date.now() >= payload.exp * 1000;
    } catch (error) {
      return true;
    }
  }

  async checkStoredSession() {
    try {
      const token = await securityService.getSecureItem('token');
      const userData = await securityService.getSecureItem('userData');

      if (token && userData && !this.isTokenExpired(token)) {
        this.isAuthenticated = true;
        this.currentUser = userData;
        
        // Configurar refresh automático
        this.setupTokenRefresh(this.getTokenRemainingTime(token) / 1000);
        
        // Actualizar estado global
        store.updateState('auth', {
          isAuthenticated: true,
          user: this.currentUser,
          token: token
        });

        securityService.logSecurityEvent('session_restored', 'Session restored from secure storage');
        return true;
      } else {
        // Limpiar datos inválidos
        await this.clearSession();
        return false;
      }
    } catch (error) {
      console.error('Error checking stored session:', error);
      await this.clearSession();
      return false;
    }
  }

  getTokenRemainingTime(token) {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return Math.max(0, (payload.exp * 1000) - Date.now());
    } catch (error) {
      return 0;
    }
  }

  // ============================================================================
  // MÉTODOS PÚBLICOS
  // ============================================================================

  async getCurrentUser() {
    if (!this.isAuthenticated) {
      return null;
    }

    if (!this.currentUser) {
      this.currentUser = await securityService.getSecureItem('userData');
    }

    return this.currentUser;
  }

  async isUserAuthenticated() {
    if (!this.isAuthenticated) {
      return false;
    }

    const token = await this.getValidToken();
    return !!token;
  }

  async hasRole(role) {
    const user = await this.getCurrentUser();
    return user && user.role === role;
  }

  async hasPermission(permission) {
    const user = await this.getCurrentUser();
    return user && user.permissions && user.permissions.includes(permission);
  }

  // Compatibilidad con el código existente
  getToken() {
    return this.getValidToken();
  }

  getUser() {
    return this.getCurrentUser();
  }

  setUser(user) {
    this.currentUser = user;
  }

  // ============================================================================
  // GESTIÓN DE PASSWORDS
  // ============================================================================

  async changePassword(currentPassword, newPassword) {
    try {
      // Validar nueva contraseña
      if (!securityService.validateInput('password', newPassword)) {
        throw new Error('New password does not meet security requirements');
      }

      const response = await this.makeSecureRequest('/auth/change-password', 'POST', {
        currentPassword,
        newPassword
      });

      securityService.logSecurityEvent('password_changed', 'Password changed successfully');
      return response.data;

    } catch (error) {
      securityService.logSecurityEvent('password_change_failed', 'Password change failed', {
        error: error.message
      });
      throw error;
    }
  }

  async requestPasswordReset(email) {
    try {
      if (!securityService.validateInput('email', email)) {
        throw new Error('Invalid email format');
      }

      const response = await this.makeSecureRequest('/auth/forgot-password', 'POST', {
        email: securityService.sanitizeInput('html', email)
      });

      securityService.logSecurityEvent('password_reset_requested', 'Password reset requested', {
        email
      });

      return response.data;

    } catch (error) {
      securityService.logSecurityEvent('password_reset_failed', 'Password reset request failed', {
        email,
        error: error.message
      });
      throw error;
    }
  }

  // ============================================================================
  // UTILIDADES DE SEGURIDAD
  // ============================================================================

  getSecurityReport() {
    return {
      isAuthenticated: this.isAuthenticated,
      currentUser: this.currentUser ? {
        id: this.currentUser.id,
        email: this.currentUser.email,
        role: this.currentUser.role
      } : null,
      loginAttempts: Object.fromEntries(this.loginAttempts),
      securityConfig: this.securityConfig,
      sessionStatus: {
        hasValidToken: !!this.getValidToken(),
        timeoutConfigured: !!this.sessionTimeoutId,
        refreshConfigured: !!this.refreshTokenTimeout
      }
    };
  }

  clearSecurityState() {
    this.loginAttempts.clear();
    if (this.sessionTimeoutId) {
      clearTimeout(this.sessionTimeoutId);
    }
    if (this.refreshTokenTimeout) {
      clearTimeout(this.refreshTokenTimeout);
    }
  }
}

// Crear instancia global del servicio de autenticación
const authService = new AuthService();

// Exportar para uso en módulos
export { AuthService, authService };
export default authService;