import { authService } from '../../shared/services/authService.js';
import { showNotification, FormValidator, validators } from '../../shared/utils/uiHelpers.js';

class LoginController {
  constructor() {
    this.cacheElements();
    this.initializeComponents();
    this.setupEventListeners();
    this.setupFormValidation();
    this.setButtonLoading(false);
  }

  cacheElements() {
    this.loginForm = document.getElementById('loginForm');
    this.loginBtn = document.getElementById('loginBtn');
    this.btnText = this.loginBtn?.querySelector('.btn-text');
    this.btnLoading = this.loginBtn?.querySelector('.btn-loading');
  }

  initializeComponents() {
    // Initialize navbar (though not needed for login)
    // createNavbar('login'); // Commented as login doesn't need navbar
    
    // Setup password toggle
    this.setupPasswordToggle();
  }

  setupPasswordToggle() {
    const toggleBtn = document.getElementById('togglePassword');
    const passwordInput = document.getElementById('password');
    
    if (toggleBtn && passwordInput) {
      toggleBtn.addEventListener('click', () => {
        const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
        passwordInput.setAttribute('type', type);
        
        const icon = toggleBtn.querySelector('i');
        icon.classList.toggle('bi-eye');
        icon.classList.toggle('bi-eye-slash');
      });
    }
  }

  setupFormValidation() {
    this.validator = new FormValidator('loginForm');
    this.validator
      .addRule(
        'username',
        (value) => this.isValidUsername(value),
        'Ingresa un usuario o correo válido'
      )
      .addRule(
        'password',
        (value) => validators.required(value) && validators.minLength(6)(value),
        'La contraseña debe tener al menos 6 caracteres'
      );
  }

  setupEventListeners() {
    if (!this.loginForm) return;

    this.loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const { isValid } = this.validator.validate();
      if (!isValid) {
        return;
      }

      await this.handleLogin();
    });
  }

  isValidUsername(value = '') {
    const trimmed = value.trim();
    if (!validators.required(trimmed)) return false;

    const normalized = trimmed.toLowerCase();
    if (normalized.includes('@')) {
      return validators.email(normalized);
    }

    // Permite letras, números y caracteres comunes en nombres de usuario
    return /^[a-zA-Z0-9._-]{3,}$/.test(trimmed);
  }

  setButtonLoading(isLoading) {
    if (!this.loginBtn) return;

    this.loginBtn.disabled = !!isLoading;
    if (isLoading) {
      this.btnText?.classList.add('d-none');
      this.btnLoading?.classList.remove('d-none');
    } else {
      this.btnText?.classList.remove('d-none');
      this.btnLoading?.classList.add('d-none');
    }
  }

  async handleLogin() {
    try {
      // Show loading state
      this.setButtonLoading(true);

      const username = document.getElementById('username').value.trim();
      const password = document.getElementById('password').value;

      const loginResult = await authService.login({ username, password });

      if (loginResult?.success) {
        const userName = loginResult.data?.user?.name || loginResult.data?.user?.username || username;
        showNotification(`Bienvenido ${userName}`, 'success');

        setTimeout(() => {
          window.location.href = '../dashboard/dashboard.html';
        }, 800);
      } else {
        const errorMessage = loginResult?.error || loginResult?.data?.message || 'Credenciales inválidas';
        throw new Error(errorMessage);
      }

    } catch (error) {
      console.error('Login error:', error);
      showNotification(error.message || 'Error al iniciar sesión', 'error');
    } finally {
      // Restore button state
      this.setButtonLoading(false);
    }
  }

  // Función para mostrar modal de recuperación de contraseña
  showForgotPassword() {
    showNotification('Función de recuperación de contraseña próximamente', 'info');
    // Aquí podrías implementar un modal de recuperación de contraseña
  }
}

// Función global para el HTML
window.showForgotPassword = function() {
  showNotification('Función de recuperación de contraseña próximamente', 'info');
};

// Initialize controller when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new LoginController();
});
