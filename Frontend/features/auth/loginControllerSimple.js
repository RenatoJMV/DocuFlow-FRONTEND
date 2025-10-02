// loginControllerSimple.js - Controlador de login simplificado
import authService from '../../shared/services/authServiceSimple.js';
import { showNotification } from '../../shared/utils/uiHelpers.js';

class SimpleLoginController {
  constructor() {
    this.init();
  }

  init() {
    // Verificar si ya está autenticado
    if (authService.isLoggedIn()) {
      window.location.href = '../dashboard/dashboard.html';
      return;
    }

    this.setupEventListeners();
  }

  setupEventListeners() {
    // Formulario de login
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
      loginForm.addEventListener('submit', (e) => this.handleLogin(e));
    }

    // Mostrar/ocultar contraseña
    const togglePassword = document.getElementById('togglePassword');
    const passwordInput = document.getElementById('password');
    
    if (togglePassword && passwordInput) {
      togglePassword.addEventListener('click', () => {
        const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
        passwordInput.setAttribute('type', type);
        
        const icon = togglePassword.querySelector('i');
        if (icon) {
          icon.className = type === 'password' ? 'bi bi-eye' : 'bi bi-eye-slash';
        }
      });
    }
  }

  async handleLogin(event) {
    event.preventDefault();

    const username = document.getElementById('username')?.value.trim();
    const password = document.getElementById('password')?.value;

    if (!username || !password) {
      showNotification('Por favor, completa todos los campos', 'error');
      return;
    }

    this.setLoading(true);

    try {
      const loginResult = await authService.login({ username, password });

      if (loginResult.success) {
        const user = loginResult.data.user;
        showNotification(`¡Bienvenido ${user.name}!`, 'success');

        setTimeout(() => {
          window.location.href = '../dashboard/dashboard.html';
        }, 1000);

      } else {
        throw new Error(loginResult.error || 'Credenciales incorrectas');
      }

    } catch (error) {
      console.error('Login error:', error);
      showNotification(error.message || 'Error al iniciar sesión', 'error');
    } finally {
      this.setLoading(false);
    }
  }

  setLoading(isLoading) {
    const loginBtn = document.getElementById('loginBtn');
    const btnText = document.querySelector('.btn-text');
    const btnLoading = document.querySelector('.btn-loading');

    if (loginBtn) {
      loginBtn.disabled = isLoading;
    }

    if (btnText && btnLoading) {
      if (isLoading) {
        btnText.classList.add('d-none');
        btnLoading.classList.remove('d-none');
      } else {
        btnText.classList.remove('d-none');
        btnLoading.classList.add('d-none');
      }
    }
  }

  showForgotPassword() {
    showNotification('Contacte al administrador del sistema para recuperar su contraseña.', 'info', 4000);
  }
}

// Instancia global
const loginController = new SimpleLoginController();

// Hacer disponible globalmente para uso en HTML
window.loginController = loginController;
window.showForgotPassword = () => loginController.showForgotPassword();

export default loginController;