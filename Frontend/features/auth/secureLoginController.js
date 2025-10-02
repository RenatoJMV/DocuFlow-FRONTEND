// Controlador de Login con Seguridad Avanzada para DocuFlow
// Implementa validaciones completas y protecciones contra ataques

import securityService from '../../shared/services/securityService.js';
import authService from '../../shared/services/authServiceSecure.js';
import { showNotification, FormValidator, validators } from '../../shared/utils/uiHelpers.js';

class SecureLoginController {
  constructor() {
    this.loginForm = null;
    this.validator = null;
    this.securityChecks = {
      rateLimitProtection: true,
      xssProtection: true,
      csrfProtection: true,
      inputValidation: true,
      passwordStrengthCheck: false // Solo para registro, no para login
    };
    
    this.init();
  }

  async init() {
    // Esperar a que el DOM esté listo
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.initializeAfterDOM());
    } else {
      this.initializeAfterDOM();
    }
  }

  initializeAfterDOM() {
    this.cacheElements();
    
    if (this.loginForm) {
      this.setupEventListeners();
      this.setupSecurityMeasures();
      this.setupFormValidation();
      this.setupPasswordToggle();
      this.setupDemoUsers(); // Solo para desarrollo
    } else {
      console.error('Login form not found');
    }
  }

  cacheElements() {
    this.loginForm = document.getElementById('loginForm');
    this.loginBtn = document.getElementById('loginBtn');
    this.btnText = this.loginBtn?.querySelector('.btn-text');
    this.btnLoading = this.loginBtn?.querySelector('.btn-loading');
    this.emailInput = document.getElementById('email');
    this.passwordInput = document.getElementById('password');
  }

  setupEventListeners() {
    // Evento principal de login
    this.loginForm.addEventListener('submit', (e) => this.handleLogin(e));
    
    // Validación en tiempo real
    if (this.emailInput) {
      this.emailInput.addEventListener('input', (e) => this.validateEmailInput(e));
      this.emailInput.addEventListener('blur', (e) => this.validateEmailInput(e));
    }
    
    if (this.passwordInput) {
      this.passwordInput.addEventListener('input', (e) => this.validatePasswordInput(e));
    }
    
    // Prevenir ataques de fuerza bruta
    this.setupBruteForceProtection();
  }

  setupSecurityMeasures() {
    // Agregar meta tag CSRF si no existe
    if (!document.querySelector('meta[name="csrf-token"]')) {
      const csrfMeta = document.createElement('meta');
      csrfMeta.name = 'csrf-token';
      csrfMeta.content = securityService.csrfToken;
      document.head.appendChild(csrfMeta);
    }
    
    // Configurar autocompletado seguro
    if (this.emailInput) {
      this.emailInput.setAttribute('autocomplete', 'username');
      this.emailInput.setAttribute('spellcheck', 'false');
    }
    
    if (this.passwordInput) {
      this.passwordInput.setAttribute('autocomplete', 'current-password');
      this.passwordInput.setAttribute('spellcheck', 'false');
    }
    
    // Prevenir ataques de clickjacking
    if (window.self !== window.top) {
      securityService.logSecurityEvent('clickjacking_attempt', 'Login page loaded in iframe');
      document.body.innerHTML = '<h1>Security Error</h1><p>This page cannot be displayed in a frame.</p>';
      return;
    }
    
    // Verificar contexto seguro
    if (!securityService.isSecureContext()) {
      showNotification('⚠️ Warning: Connection is not secure. Use HTTPS for better security.', 'warning');
    }
  }

  setupFormValidation() {
    // Configurar validación con FormValidator existente
    this.validator = new FormValidator(this.loginForm, {
      email: [validators.required, validators.email],
      password: [validators.required, validators.minLength(6)]
    });
  }

  setupPasswordToggle() {
    const toggleBtn = document.getElementById('togglePassword');
    
    if (toggleBtn && this.passwordInput) {
      toggleBtn.addEventListener('click', (e) => {
        e.preventDefault();
        
        const type = this.passwordInput.getAttribute('type');
        this.passwordInput.setAttribute('type', type === 'password' ? 'text' : 'password');
        
        const icon = toggleBtn.querySelector('i');
        if (icon) {
          icon.className = type === 'password' ? 'fas fa-eye-slash' : 'fas fa-eye';
        }
        
        // Log de evento de seguridad
        securityService.logSecurityEvent('password_visibility_toggle', 'Password visibility toggled');
      });
    }
  }

  validateEmailInput(event) {
    const input = event.target;
    const value = input.value.trim();
    
    if (value) {
      // Sanitizar entrada
      const sanitizedValue = securityService.sanitizeInput('html', value);
      if (sanitizedValue !== value) {
        input.value = sanitizedValue;
        this.showFieldError(input, 'Invalid characters removed from email');
      }
      
      // Validar formato de email
      if (!securityService.validateInput('email', sanitizedValue)) {
        this.showFieldError(input, 'Please enter a valid email address');
        return false;
      }
      
      this.showFieldSuccess(input);
      return true;
    }
    
    return false;
  }

  validatePasswordInput(event) {
    const input = event.target;
    const value = input.value;
    
    if (value) {
      // Verificar longitud mínima
      if (value.length < 6) {
        this.showFieldError(input, 'Password must be at least 6 characters');
        return false;
      }
      
      // Verificar caracteres peligrosos
      if (/<script|javascript:|on\w+=/i.test(value)) {
        this.showFieldError(input, 'Password contains invalid characters');
        securityService.logSecurityEvent('xss_attempt_password', 'XSS attempt in password field');
        return false;
      }
      
      this.showFieldSuccess(input);
      return true;
    }
    
    return false;
  }

  setupBruteForceProtection() {
    let attemptCount = 0;
    let lastAttemptTime = 0;
    
    this.loginForm.addEventListener('submit', () => {
      const now = Date.now();
      
      // Detectar intentos muy rápidos (menos de 1 segundo entre intentos)
      if (now - lastAttemptTime < 1000) {
        attemptCount++;
        
        if (attemptCount > 3) {
          securityService.logSecurityEvent('rapid_login_attempts', 'Rapid login attempts detected');
          showNotification('Too many rapid attempts. Please wait a moment.', 'warning');
          
          // Bloquear temporalmente
          if (this.loginBtn) {
            this.loginBtn.disabled = true;
            setTimeout(() => {
              this.loginBtn.disabled = false;
            }, 5000);
          }
        }
      } else {
        attemptCount = 0;
      }
      
      lastAttemptTime = now;
    });
  }

  async handleLogin(event) {
    event.preventDefault();
    
    try {
      // Mostrar loading
      this.setButtonLoading(true);
      
      // Validar formulario
      if (!this.validator.validate()) {
        this.setButtonLoading(false);
        return;
      }
      
      // Obtener datos del formulario
      const formData = new FormData(this.loginForm);
      const credentials = {
        email: formData.get('email')?.trim(),
        password: formData.get('password')
      };
      
      // Validación adicional de seguridad
      if (!this.validateCredentialsSecurity(credentials)) {
        this.setButtonLoading(false);
        return;
      }
      
      // Log de intento de login
      securityService.logSecurityEvent('login_attempt', 'User attempting to login', {
        email: credentials.email,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent.substring(0, 100)
      });
      
      // Realizar login
      const result = await authService.login(credentials);
      
      if (result && result.token) {
        showNotification('✅ Login successful! Redirecting...', 'success');
        
        // Limpiar formulario por seguridad
        this.clearForm();
        
        // Redirigir después de un breve delay
        setTimeout(() => {
          this.redirectAfterLogin();
        }, 1500);
        
      } else {
        throw new Error('Invalid login response');
      }
      
    } catch (error) {
      console.error('Login error:', error);
      
      // Mostrar error específico
      if (error.message.includes('Too many login attempts')) {
        showNotification('🔒 ' + error.message, 'error');
      } else if (error.message.includes('Invalid credentials')) {
        showNotification('❌ Invalid email or password', 'error');
      } else if (error.message.includes('Account locked')) {
        showNotification('🔒 Account temporarily locked due to multiple failed attempts', 'error');
      } else {
        showNotification('❌ Login failed. Please try again.', 'error');
      }
      
      // Shake animation para el formulario
      this.animateError();
      
    } finally {
      this.setButtonLoading(false);
    }
  }

  validateCredentialsSecurity(credentials) {
    // Verificar que no hay intentos de inyección SQL
    if (!securityService.validateInput('sql', credentials.email) || 
        !securityService.validateInput('sql', credentials.password)) {
      securityService.logSecurityEvent('sql_injection_attempt', 'SQL injection attempt in login form');
      showNotification('❌ Invalid input detected', 'error');
      return false;
    }
    
    return true;
  }

  setButtonLoading(loading) {
    if (!this.loginBtn) return;
    
    if (loading) {
      this.loginBtn.disabled = true;
      this.btnText.style.display = 'none';
      this.btnLoading.style.display = 'inline-block';
    } else {
      this.loginBtn.disabled = false;
      this.btnText.style.display = 'inline-block';
      this.btnLoading.style.display = 'none';
    }
  }

  showFieldError(input, message) {
    input.classList.add('is-invalid');
    input.classList.remove('is-valid');
    
    // Buscar o crear elemento de error
    let errorElement = input.nextElementSibling;
    if (!errorElement || !errorElement.classList.contains('invalid-feedback')) {
      errorElement = document.createElement('div');
      errorElement.className = 'invalid-feedback';
      input.parentNode.insertBefore(errorElement, input.nextSibling);
    }
    
    errorElement.textContent = message;
  }

  showFieldSuccess(input) {
    input.classList.add('is-valid');
    input.classList.remove('is-invalid');
    
    // Remover mensaje de error si existe
    const errorElement = input.nextElementSibling;
    if (errorElement && errorElement.classList.contains('invalid-feedback')) {
      errorElement.textContent = '';
    }
  }

  clearFieldError(input) {
    input.classList.remove('is-invalid', 'is-valid');
    
    const errorElement = input.nextElementSibling;
    if (errorElement && errorElement.classList.contains('invalid-feedback')) {
      errorElement.textContent = '';
    }
  }

  animateError() {
    this.loginForm.classList.add('shake');
    setTimeout(() => {
      this.loginForm.classList.remove('shake');
    }, 500);
  }

  clearForm() {
    this.loginForm.reset();
    
    // Limpiar estados de validación
    const inputs = this.loginForm.querySelectorAll('input');
    inputs.forEach(input => {
      this.clearFieldError(input);
    });
  }

  redirectAfterLogin() {
    // Verificar si hay una URL de redirect almacenada
    const redirectUrl = sessionStorage.getItem('redirectUrl');
    
    if (redirectUrl) {
      sessionStorage.removeItem('redirectUrl');
      
      // Validar que la URL de redirect es segura
      if (this.isValidRedirectUrl(redirectUrl)) {
        window.location.href = redirectUrl;
        return;
      }
    }
    
    // Redirect por defecto al dashboard
    window.location.href = '/features/dashboard/dashboard.html';
  }

  isValidRedirectUrl(url) {
    try {
      const urlObj = new URL(url, window.location.origin);
      
      // Solo permitir redirects a la misma origen
      if (urlObj.origin !== window.location.origin) {
        return false;
      }
      
      // No permitir javascript: o data: URLs
      if (urlObj.protocol !== 'http:' && urlObj.protocol !== 'https:') {
        return false;
      }
      
      return true;
    } catch {
      return false;
    }
  }

  // ============================================================================
  // DEMO USERS (SOLO PARA DESARROLLO)
  // ============================================================================

  setupDemoUsers() {
    // Solo mostrar en desarrollo
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      const demoContainer = document.createElement('div');
      demoContainer.className = 'demo-users mt-3';
      demoContainer.innerHTML = `
        <div class="alert alert-warning">
          <small><strong>Demo Users (Development Only):</strong></small>
          <div class="btn-group w-100 mt-2">
            <button type="button" class="btn btn-outline-secondary btn-sm" data-demo="admin">
              Admin User
            </button>
            <button type="button" class="btn btn-outline-secondary btn-sm" data-demo="user">
              Regular User
            </button>
          </div>
        </div>
      `;
      
      // Agregar después del formulario
      this.loginForm.parentNode.appendChild(demoContainer);
      
      // Eventos para demo users
      demoContainer.addEventListener('click', (e) => {
        if (e.target.hasAttribute('data-demo')) {
          const demoType = e.target.getAttribute('data-demo');
          this.fillDemoCredentials(demoType);
        }
      });
    }
  }

  fillDemoCredentials(type) {
    // ADVERTENCIA: Solo para desarrollo
    const demoCredentials = {
      admin: {
        email: 'admin@docuflow.com',
        password: 'AdminPass123!'
      },
      user: {
        email: 'user@docuflow.com',
        password: 'UserPass123!'
      }
    };
    
    const credentials = demoCredentials[type];
    if (credentials && this.emailInput && this.passwordInput) {
      this.emailInput.value = credentials.email;
      this.passwordInput.value = credentials.password;
      
      // Validar los campos automáticamente
      this.validateEmailInput({ target: this.emailInput });
      this.validatePasswordInput({ target: this.passwordInput });
    }
  }

  // ============================================================================
  // MÉTODOS DE UTILIDAD
  // ============================================================================

  getSecurityStatus() {
    return {
      securityChecks: this.securityChecks,
      formValidated: this.loginForm?.checkValidity() || false,
      csrfTokenPresent: !!document.querySelector('meta[name="csrf-token"]'),
      secureContext: securityService.isSecureContext()
    };
  }
}

// Crear instancia del controlador cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
  window.secureLoginController = new SecureLoginController();
});

// Exportar para testing
export { SecureLoginController };
export default SecureLoginController;