import { docuFlowAPI } from '../../shared/services/apiClient.js';
import { appStore } from '../../shared/services/store.js';
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

    // Handle demo login buttons
    const demoButtons = document.querySelectorAll('[data-demo-user]');
    demoButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const userType = e.target.dataset.demoUser;
        this.fillDemoCredentials(userType);
      });
    });
  }

  fillDemoCredentials(userType) {
    const credentials = {
      admin: { username: 'admin@docuflow.com', password: 'admin123' },
      user: { username: 'user@docuflow.com', password: 'user123' },
      guest: { username: 'guest@docuflow.com', password: 'guest123' }
    };

    const cred = credentials[userType];
    if (cred) {
      document.getElementById('username').value = cred.username;
      document.getElementById('password').value = cred.password;
      
      showNotification(`Credenciales de ${userType} cargadas`, 'info');
    }
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

      // Call API for login
      const response = await docuFlowAPI.auth.login({ username, password });

      if (response.success) {
        // Store user data
        appStore.setState({
          user: response.user,
          isAuthenticated: true,
          token: response.token
        });

        // Store token for API client
        localStorage.setItem('authToken', response.token);
        localStorage.setItem('userData', JSON.stringify(response.user));

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
}

// Initialize controller when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new LoginController();
});
