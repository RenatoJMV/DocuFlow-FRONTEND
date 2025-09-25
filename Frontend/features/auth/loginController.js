import { docuFlowAPI } from '../../shared/services/apiClient.js';
import { store } from '../../shared/services/store.js';
import { createNavbar, showNotification, FormValidator } from '../../shared/utils/uiHelpers.js';

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
    this.validator = new FormValidator('loginForm', {
      username: {
        required: true,
        minLength: 3,
        message: 'El nombre de usuario debe tener al menos 3 caracteres'
      },
      password: {
        required: true,
        minLength: 6,
        message: 'La contraseña debe tener al menos 6 caracteres'
      }
    });
  }

  setupEventListeners() {
    const loginForm = document.getElementById('loginForm');
    const loginBtn = document.getElementById('loginBtn');

    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      if (!this.validator.validate()) {
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

      console.log('🔐 Intentando login con:', { username, password: '***' });
      console.log('📡 URL del endpoint:', window.location.hostname === 'localhost' ? 'http://localhost:8080/login' : 'https://docuflow-backend.onrender.com/login');

      // Call API for login
      const response = await docuFlowAPI.auth.login({ username, password });

      console.log('✅ Respuesta del servidor:', response);

      if (response.token) {
        // Crear objeto de usuario básico
        const userData = {
          username: username,
          role: 'colaborador' // Rol por defecto
        };

        // Store user data
        store.setState('user', {
          user: userData,
          isAuthenticated: true,
          token: response.token
        });

        // Store token for API client
        localStorage.setItem('authToken', response.token);
        localStorage.setItem('userData', JSON.stringify(userData));

        showNotification('¡Inicio de sesión exitoso!', 'success');

        // Redirect to dashboard after short delay
        setTimeout(() => {
          window.location.href = '../dashboard/dashboard.html';
        }, 1000);

      } else {
        throw new Error(response.error || 'Error en el inicio de sesión');
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
