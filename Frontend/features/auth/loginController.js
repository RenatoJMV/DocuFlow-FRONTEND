import { authService } from '../../shared/services/authService.js';
import { showNotification, FormValidator, validators } from '../../shared/utils/uiHelpers.js';

class LoginController {
  constructor() {
    this.initializeComponents();
    this.setupEventListeners();
    this.setupFormValidation();
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
        (value) => validators.required(value) && validators.email(value.trim().toLowerCase()),
        'Ingresa un correo electrónico válido'
      )
      .addRule(
        'password',
        (value) => validators.required(value) && validators.minLength(8)(value),
        'La contraseña debe tener al menos 8 caracteres'
      );
  }

  setupEventListeners() {
    const loginForm = document.getElementById('loginForm');
    const loginBtn = document.getElementById('loginBtn');

    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const { isValid } = this.validator.validate();
      if (!isValid) {
        return;
      }

      await this.handleLogin();
    });
  }

  async handleLogin() {
    const loginBtn = document.getElementById('loginBtn');
    const originalText = loginBtn.innerHTML;
    
    try {
      // Show loading state
      loginBtn.disabled = true;
      loginBtn.innerHTML = '<i class="bi bi-arrow-clockwise spin me-2"></i>Iniciando sesión...';

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
      loginBtn.disabled = false;
      loginBtn.innerHTML = originalText;
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
