// utils/uiHelpers.js

// Funciones de alerta existentes (mantenidas por compatibilidad)
export function showSuccess(elementId, message) {
  const el = document.getElementById(elementId);
  if (el) {
    el.textContent = message;
    el.style.display = "block";
    el.classList.remove("alert-danger");
    el.classList.add("alert-success");
  }
}

export function showError(elementId, message) {
  const el = document.getElementById(elementId);
  if (el) {
    el.textContent = message;
    el.style.display = "block";
    el.classList.remove("alert-success");
    el.classList.add("alert-danger");
  }
}

// Sistema moderno de notificaciones
export function showNotification(message, type = 'info', duration = 4000) {
  const notification = document.createElement('div');
  notification.className = `notification notification-${type}`;
  notification.innerHTML = `
    <div class="notification-content">
      <i class="bi bi-${getIconForType(type)}"></i>
      <span>${message}</span>
      <button class="notification-close" aria-label="Cerrar">&times;</button>
    </div>
  `;
  
  document.body.appendChild(notification);
  
  // Auto remove
  const timeoutId = setTimeout(() => {
    if (notification.parentNode) {
      notification.remove();
    }
  }, duration);
  
  // Manual close
  notification.querySelector('.notification-close').onclick = () => {
    clearTimeout(timeoutId);
    notification.style.animation = 'slideOut 0.3s ease-in';
    setTimeout(() => {
      if (notification.parentNode) {
        notification.remove();
      }
    }, 300);
  };
}

function getIconForType(type) {
  const icons = {
    success: 'check-circle-fill',
    error: 'exclamation-triangle-fill',
    warning: 'exclamation-circle-fill',
    info: 'info-circle-fill'
  };
  return icons[type] || 'info-circle-fill';
}

// Loading global
export function showLoading(show = true) {
  let loader = document.getElementById('global-loader');
  if (!loader && show) {
    loader = document.createElement('div');
    loader.id = 'global-loader';
    loader.className = 'global-loader';
    loader.innerHTML = '<div class="spinner"></div>';
    document.body.appendChild(loader);
  } else if (loader && !show) {
    loader.remove();
  }
}

// Sistema de navegación moderno
export function createNavbar(currentPage = '') {
  return `
    <nav class="navbar navbar-expand-lg navbar-light bg-white shadow-sm rounded-pill px-4 mb-4 modern-nav">
      <div class="container-fluid">
        <a class="navbar-brand d-flex align-items-center gap-2" href="../dashboard/dashboard.html">
          <img src="https://cdn-icons-png.flaticon.com/512/3064/3064197.png" alt="DocuFlow Logo" class="logo">
          <span class="fw-bold text-primary">DocuFlow</span>
        </a>
        
        <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav">
          <span class="navbar-toggler-icon"></span>
        </button>
        
        <div class="collapse navbar-collapse" id="navbarNav">
          <div class="navbar-nav ms-auto gap-2">
            ${createNavItem('dashboard', 'Dashboard', 'speedometer2', currentPage)}
            ${createNavItem('files', 'Archivos', 'cloud-arrow-up', currentPage)}
            ${createNavItem('comments', 'Comentarios', 'chat-dots', currentPage)}
            ${createNavItem('permissions', 'Permisos', 'people', currentPage)}
            ${createNavItem('logs', 'Logs', 'clipboard-data', currentPage)}
            <div class="nav-item dropdown">
              <a class="nav-link dropdown-toggle d-flex align-items-center gap-2" href="#" role="button" data-bs-toggle="dropdown">
                <i class="bi bi-person-circle"></i>
                <span class="d-none d-md-inline">Usuario</span>
              </a>
              <ul class="dropdown-menu dropdown-menu-end">
                <li><h6 class="dropdown-header">Mi Cuenta</h6></li>
                <li><a class="dropdown-item" href="#"><i class="bi bi-person me-2"></i>Perfil</a></li>
                <li><a class="dropdown-item" href="#"><i class="bi bi-gear me-2"></i>Configuración</a></li>
                <li><hr class="dropdown-divider"></li>
                <li><a class="dropdown-item text-danger" href="#" onclick="logout()"><i class="bi bi-box-arrow-right me-2"></i>Cerrar sesión</a></li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </nav>
  `;
}

function createNavItem(page, title, icon, currentPage) {
  const isActive = currentPage === page ? 'active' : '';
  const href = page === 'dashboard' ? '../dashboard/dashboard.html' : `../${page}/${page}.html`;
  return `
    <a class="nav-link ${isActive}" href="${href}">
      <i class="bi bi-${icon}"></i>
      <span class="d-none d-md-inline">${title}</span>
    </a>
  `;
}

// Función de logout global
window.logout = function() {
  showNotification('Cerrando sesión...', 'info', 1000);
  setTimeout(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '../auth/login.html';
  }, 1000);
}

// Función para inicializar navbar en una página
export function initializeNavbar(currentPage) {
  const navbarContainer = document.getElementById('navbar-container');
  if (navbarContainer) {
    navbarContainer.innerHTML = createNavbar(currentPage);
  } else {
    // Si no existe el contenedor, lo creamos después del body
    const navbar = document.createElement('div');
    navbar.id = 'navbar-container';
    navbar.innerHTML = createNavbar(currentPage);
    document.body.insertBefore(navbar, document.body.firstChild);
  }
}

// Validador de formularios moderno
export class FormValidator {
  constructor(formId) {
    this.form = document.getElementById(formId);
    this.rules = new Map();
  }

  addRule(fieldId, validator, message) {
    this.rules.set(fieldId, { validator, message });
    return this;
  }

  validate() {
    let isValid = true;
    const errors = [];

    this.rules.forEach(({ validator, message }, fieldId) => {
      const field = document.getElementById(fieldId);
      if (field && !validator(field.value, field)) {
        isValid = false;
        errors.push({ field: fieldId, message });
        this.showFieldError(field, message);
      } else if (field) {
        this.clearFieldError(field);
      }
    });

    return { isValid, errors };
  }

  showFieldError(field, message) {
    field.classList.add('is-invalid');
    let feedback = field.parentNode.querySelector('.invalid-feedback');
    if (!feedback) {
      feedback = document.createElement('div');
      feedback.className = 'invalid-feedback';
      field.parentNode.appendChild(feedback);
    }
    feedback.textContent = message;
  }

  clearFieldError(field) {
    field.classList.remove('is-invalid');
    const feedback = field.parentNode.querySelector('.invalid-feedback');
    if (feedback) feedback.remove();
  }

  clearAllErrors() {
    this.rules.forEach((_, fieldId) => {
      const field = document.getElementById(fieldId);
      if (field) {
        this.clearFieldError(field);
      }
    });
  }
}

// Validadores comunes
export const validators = {
  required: (value) => value && value.trim() !== '',
  minLength: (min) => (value) => value && value.length >= min,
  maxLength: (max) => (value) => value && value.length <= max,
  email: (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
  fileSize: (maxMB) => (value, field) => {
    const file = field.files?.[0];
    return !file || file.size <= maxMB * 1024 * 1024;
  },
  fileType: (allowedTypes) => (value, field) => {
    const file = field.files?.[0];
    return !file || allowedTypes.includes(file.type);
  },
  numeric: (value) => /^\d+$/.test(value),
  alphanumeric: (value) => /^[a-zA-Z0-9]+$/.test(value),
  strongPassword: (value) => {
    // Al menos 8 caracteres, una mayúscula, una minúscula, un número
    return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]{8,}$/.test(value);
  }
};

// Utilidades para manejo de fechas
export function formatDate(date, options = {}) {
  const defaultOptions = {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  };
  
  return new Intl.DateTimeFormat('es-ES', { ...defaultOptions, ...options })
    .format(new Date(date));
}

export function formatRelativeTime(date) {
  const now = new Date();
  const diff = now - new Date(date);
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `hace ${days} día${days > 1 ? 's' : ''}`;
  if (hours > 0) return `hace ${hours} hora${hours > 1 ? 's' : ''}`;
  if (minutes > 0) return `hace ${minutes} minuto${minutes > 1 ? 's' : ''}`;
  return 'hace un momento';
}

// Utilidad para formatear tamaños de archivo
export function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Debounce utility
export function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Componente de paginación reutilizable
export class Pagination {
  constructor(containerId, options = {}) {
    this.container = document.getElementById(containerId);
    this.itemsPerPage = options.itemsPerPage || 10;
    this.currentPage = 1;
    this.onPageChange = options.onPageChange || (() => {});
  }

  render(totalItems) {
    const totalPages = Math.ceil(totalItems / this.itemsPerPage);
    if (!this.container) return;
    
    this.container.innerHTML = '';

    if (totalPages <= 1) return;

    const nav = document.createElement('nav');
    nav.innerHTML = `
      <ul class="pagination justify-content-center">
        ${this.createPageButton('&laquo;', this.currentPage > 1, () => this.goToPage(this.currentPage - 1))}
        ${this.createPageNumbers(totalPages)}
        ${this.createPageButton('&raquo;', this.currentPage < totalPages, () => this.goToPage(this.currentPage + 1))}
      </ul>
    `;
    
    this.container.appendChild(nav);
  }

  createPageButton(text, enabled, onClick, active = false) {
    const disabled = enabled ? '' : 'disabled';
    const activeClass = active ? 'active' : '';
    return `
      <li class="page-item ${disabled} ${activeClass}">
        <a class="page-link" href="#" ${enabled ? `onclick="event.preventDefault(); (${onClick})();"` : ''}>
          ${text}
        </a>
      </li>
    `;
  }

  createPageNumbers(totalPages) {
    const startPage = Math.max(1, this.currentPage - 2);
    const endPage = Math.min(totalPages, this.currentPage + 2);
    let html = '';
    
    for (let i = startPage; i <= endPage; i++) {
      html += this.createPageButton(i, true, () => this.goToPage(i), i === this.currentPage);
    }
    
    return html;
  }

  goToPage(page) {
    this.currentPage = page;
    this.onPageChange(page);
  }

  getCurrentPage() {
    return this.currentPage;
  }

  getItemsPerPage() {
    return this.itemsPerPage;
  }
}
