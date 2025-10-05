import { authService } from '../../shared/services/authService.js';
import securityService from '../../shared/services/securityService.js';
import { consumeAuthRedirectMessage } from '../../shared/utils/authGuard.js';
import { showNotification, FormValidator, validators } from '../../shared/utils/uiHelpers.js';

class PortalLoginController {
  constructor() {
    this.rateLimitWindow = 15_000;
    this.rateLimitThreshold = 4;
    this.loginAttempts = [];

    this.cacheElements();
    this.initializeComponents();
    this.setupFormValidation();
    this.setupEventListeners();
    this.restoreRememberedIdentity();
    this.showRedirectMessage();
    this.checkSecurityContext();
  }

  cacheElements() {
    this.loginForm = document.getElementById('loginForm');
    this.identityInput = document.getElementById('identity');
    this.passwordInput = document.getElementById('password');
    this.loginBtn = document.getElementById('loginBtn');
    this.btnText = this.loginBtn?.querySelector('.btn-text');
    this.btnLoading = this.loginBtn?.querySelector('.btn-loading');
    this.rememberMe = document.getElementById('rememberMe');
    this.securityIndicator = document.getElementById('securityIndicator');
    this.securityReportBtn = document.getElementById('securityReportBtn');
    this.securityStatusPanel = document.getElementById('securityStatus');
    this.securityDetailsList = document.getElementById('securityDetails');
    this.forgotPasswordLink = document.getElementById('forgotPasswordLink');
    this.forgotPasswordForm = document.getElementById('forgotPasswordForm');
  }

  initializeComponents() {
    this.setButtonLoading(false);
    this.renderSecurityReport();
  }

  setupFormValidation() {
    this.validator = new FormValidator('loginForm');

    this.validator
      .addRule('identity', (value) => this.isValidIdentity(value), 'Ingresa un usuario o correo válido')
      .addRule('password', (value) => validators.required(value) && validators.minLength(6)(value), 'La contraseña debe tener al menos 6 caracteres');
  }

  setupEventListeners() {
    if (!this.loginForm) return;

    this.loginForm.addEventListener('submit', (event) => {
      event.preventDefault();

      const { isValid } = this.validator.validate();
      if (!isValid) {
        securityService.logSecurityEvent('login_validation_failed', 'Validación de campos de login fallida');
        return;
      }

      if (this.isRateLimited()) {
        showNotification('Demasiados intentos seguidos. Espera unos segundos antes de intentar nuevamente.', 'warning');
        securityService.logSecurityEvent('rapid_login_attempts', 'Intentos de login rápidos detectados');
        return;
      }

      this.handleLogin();
    });

    if (this.identityInput) {
      this.identityInput.addEventListener('input', (event) => this.handleIdentityInput(event));
      this.identityInput.addEventListener('blur', () => this.validator.validate());
    }

    if (this.passwordInput) {
      const toggleBtn = document.getElementById('togglePassword');
      if (toggleBtn) {
        toggleBtn.addEventListener('click', () => this.togglePasswordVisibility(toggleBtn));
      }

      this.passwordInput.addEventListener('input', () => this.validator.validate());
    }

    this.securityReportBtn?.addEventListener('click', () => this.toggleSecurityReport());

    if (this.forgotPasswordLink && this.forgotPasswordForm) {
      this.forgotPasswordLink.addEventListener('click', (event) => {
        event.preventDefault();
        const modal = new bootstrap.Modal(document.getElementById('forgotPasswordModal'));
        modal.show();
      });

      this.forgotPasswordForm.addEventListener('submit', (event) => this.handleForgotPassword(event));
    }
  }

  async handleLogin() {
    if (!this.loginForm) return;

    try {
      this.setButtonLoading(true);

      const identity = this.normalizeIdentity(this.identityInput.value);
      const password = this.passwordInput.value;

      if (!this.validateSecurity(identity, password)) {
        this.setButtonLoading(false);
        return;
      }

      this.registerAttempt();
      securityService.logSecurityEvent('login_attempt', 'Intento de inicio de sesión detectado', {
        identity,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent.substring(0, 120)
      });

      const loginResult = await authService.login({ username: identity, password });

      if (loginResult?.success) {
        this.persistIdentityIfNeeded(identity);
        const userName = loginResult.data?.user?.name || loginResult.data?.user?.username || identity;
        showNotification(`Bienvenido ${userName}`, 'success');
        this.redirectAfterLogin();
        return;
      }

      const errorMessage = loginResult?.error || loginResult?.data?.message || 'Credenciales inválidas';
      securityService.logSecurityEvent('login_failed', 'Inicio de sesión rechazado', { identity, error: errorMessage });
      showNotification(errorMessage, 'error');
    } catch (error) {
      console.error('Login error:', error);
      const message = error?.status === 401
        ? 'Credenciales inválidas. Verifica tu usuario y contraseña.'
        : error?.message || 'No fue posible iniciar sesión';
      securityService.logSecurityEvent('login_exception', 'Error inesperado durante login', { message });
      showNotification(message, 'error');
    } finally {
      this.setButtonLoading(false);
    }
  }

  async handleForgotPassword(event) {
    event.preventDefault();
    const email = document.getElementById('recoveryEmail')?.value?.trim();

    if (!email || !validators.email(email)) {
      showNotification('Ingresa un correo válido para recuperar tu acceso.', 'warning');
      return;
    }

    showNotification('Si la cuenta existe, enviaremos un enlace de recuperación.', 'info');
    securityService.logSecurityEvent('password_recovery_requested', 'Solicitud de recuperación de contraseña', { email });

    const modalInstance = bootstrap.Modal.getInstance(document.getElementById('forgotPasswordModal'));
    modalInstance?.hide();
  }

  handleIdentityInput(event) {
    const rawValue = event.target.value;
    const sanitized = securityService.sanitizeInput('text', rawValue);

    if (sanitized !== rawValue) {
      event.target.value = sanitized;
    }
  }

  togglePasswordVisibility(toggleBtn) {
    const type = this.passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
    this.passwordInput.setAttribute('type', type);
    const icon = toggleBtn.querySelector('i');
    if (icon) {
      icon.className = type === 'password' ? 'fas fa-eye' : 'fas fa-eye-slash';
    }
    securityService.logSecurityEvent('password_visibility_toggle', 'Se alternó la visibilidad de la contraseña');
  }

  validateSecurity(identity, password) {
    if (!securityService.validateInput('sql', identity) || !securityService.validateInput('sql', password)) {
      showNotification('Entrada no válida detectada.', 'error');
      securityService.logSecurityEvent('sql_injection_attempt', 'Intento de inyección detectado desde formulario de login');
      return false;
    }

    return true;
  }

  normalizeIdentity(value = '') {
    const trimmed = value.trim();
    if (!trimmed) return '';

    const lower = trimmed.toLowerCase();
    return lower;
  }

  isValidIdentity(value = '') {
    const trimmed = value.trim();
    if (!validators.required(trimmed)) return false;

    const normalized = trimmed.toLowerCase();
    if (normalized.includes('@')) {
      return validators.email(normalized);
    }

    return /^[a-zA-Z0-9._-]{3,}$/.test(trimmed);
  }

  setButtonLoading(isLoading) {
    if (!this.loginBtn) return;

    this.loginBtn.disabled = Boolean(isLoading);
    if (isLoading) {
      this.btnText?.classList.add('d-none');
      this.btnLoading?.classList.remove('d-none');
    } else {
      this.btnText?.classList.remove('d-none');
      this.btnLoading?.classList.add('d-none');
    }
  }

  registerAttempt() {
    const now = Date.now();
    this.loginAttempts.push(now);
    this.loginAttempts = this.loginAttempts.filter((timestamp) => now - timestamp <= this.rateLimitWindow);
  }

  isRateLimited() {
    const now = Date.now();
    this.loginAttempts = this.loginAttempts.filter((timestamp) => now - timestamp <= this.rateLimitWindow);
    return this.loginAttempts.length >= this.rateLimitThreshold;
  }

  persistIdentityIfNeeded(identity) {
    if (!this.rememberMe) return;

    if (this.rememberMe.checked) {
      localStorage.setItem('docuflow_last_identity', identity);
    } else {
      localStorage.removeItem('docuflow_last_identity');
    }
  }

  restoreRememberedIdentity() {
    const storedIdentity = localStorage.getItem('docuflow_last_identity');
    if (storedIdentity && this.identityInput) {
      this.identityInput.value = storedIdentity;
      if (this.rememberMe) {
        this.rememberMe.checked = true;
      }
    }
  }

  redirectAfterLogin() {
    const redirectUrl = this.consumeRedirectUrl();
    setTimeout(() => {
      window.location.href = redirectUrl || '../dashboard/dashboard.html';
    }, 800);
  }

  consumeRedirectUrl() {
    const redirectUrl = sessionStorage.getItem('redirectUrl');
    if (!redirectUrl) {
      return null;
    }

    sessionStorage.removeItem('redirectUrl');

    if (/^https?:/i.test(redirectUrl)) {
      try {
        const redirect = new URL(redirectUrl);
        if (redirect.origin !== window.location.origin) {
          return '../dashboard/dashboard.html';
        }
        return `${redirect.pathname}${redirect.search}${redirect.hash}`;
      } catch (error) {
        console.warn('URL de redirección inválida, usando dashboard por defecto.', error);
        return '../dashboard/dashboard.html';
      }
    }

    return redirectUrl;
  }

  showRedirectMessage() {
    const { message, reason } = consumeAuthRedirectMessage();
    if (!message) return;

    const type = reason === 'session_timeout' ? 'error' : 'warning';
    showNotification(message, type, 6000);
  }

  toggleSecurityReport() {
    if (!this.securityStatusPanel) return;

    const isHidden = this.securityStatusPanel.hasAttribute('hidden');
    if (isHidden) {
      this.renderSecurityReport();
      this.securityStatusPanel.removeAttribute('hidden');
    } else {
      this.securityStatusPanel.setAttribute('hidden', 'true');
    }
  }

  renderSecurityReport() {
    if (!this.securityDetailsList) return;

    const report = securityService.getSecurityReport();
    const items = [
      { label: 'Contexto seguro', value: report.secureContext ? 'Sí' : 'No', icon: report.secureContext ? 'fa-lock' : 'fa-exclamation-triangle' },
      { label: 'Token CSRF', value: report.csrfEnabled ? 'Asignado' : 'No disponible', icon: 'fa-shield' },
      { label: 'Eventos recientes', value: `${report.recentEvents.length}`, icon: 'fa-wave-square' }
    ];

    this.securityDetailsList.innerHTML = items.map((item) => `
      <li>
        <i class="fas ${item.icon}"></i>
        <span class="fw-semibold">${item.label}:</span>
        <span class="ms-1">${item.value}</span>
      </li>
    `).join('');
  }

  checkSecurityContext() {
    if (!this.securityIndicator) return;

    const isSecure = securityService.isSecureContext();
    if (!isSecure) {
      this.securityIndicator.classList.add('warning');
      this.securityIndicator.innerHTML = '<i class="fas fa-exclamation-triangle me-1"></i> Conexión no segura';
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.portalLoginController = new PortalLoginController();
});

export { PortalLoginController };
export default PortalLoginController;
