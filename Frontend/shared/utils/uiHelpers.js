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
          <div class="navbar-nav ms-auto gap-2 d-flex flex-row align-items-center">
            ${createNavItem('dashboard', 'Dashboard', 'speedometer2', currentPage)}
            ${createNavItem('upload', 'Archivos', 'cloud-arrow-up', currentPage)}
            ${createNavItem('comments', 'Comentarios', 'chat-dots', currentPage)}
            ${createNavItem('permissions', 'Permisos', 'people', currentPage)}
            ${createNavItem('logs', 'Logs', 'clipboard-data', currentPage)}
            
            <!-- Widget de Estado del Sistema -->
            <div class="nav-item">
              <a class="nav-link position-relative d-flex align-items-center" href="#" onclick="showSystemHealth()" title="Estado del sistema">
                <i class="bi bi-heart-pulse"></i>
                <span class="status-dot status-down" id="system-status-indicator"></span>
              </a>
            </div>

            <!-- Widget de Notificaciones -->
            <div class="nav-item dropdown">
              <a class="nav-link position-relative d-flex align-items-center" href="#" role="button" data-bs-toggle="dropdown" title="Notificaciones">
                <i class="bi bi-bell"></i>
                <span class="badge bg-danger position-absolute top-0 start-100 translate-middle" 
                      id="notification-badge" style="display: none;">0</span>
              </a>
              <ul class="dropdown-menu dropdown-menu-end notification-dropdown">
                <li><h6 class="dropdown-header">Notificaciones</h6></li>
                <div id="navbar-notifications" class="notification-list">
                  <li class="dropdown-item-text text-muted">No hay notificaciones</li>
                </div>
                <li><hr class="dropdown-divider"></li>
                <li><a class="dropdown-item" href="../notifications/notifications.html">Ver todas</a></li>
              </ul>
            </div>
            
            <div class="nav-item dropdown">
              <a class="nav-link dropdown-toggle d-flex align-items-center gap-2" href="#" role="button" data-bs-toggle="dropdown">
                <i class="bi bi-person-circle"></i>
                <span class="d-none d-md-inline">Usuario</span>
              </a>
              <ul class="dropdown-menu dropdown-menu-end">
                <li><h6 class="dropdown-header">Mi Cuenta</h6></li>
                <li><a class="dropdown-item" href="../profile/profile.html"><i class="bi bi-person me-2"></i>Perfil</a></li>
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
  
  let href;
  if (page === 'dashboard') {
    href = '../dashboard/dashboard.html';
  } else if (page === 'upload') {
    href = '../files/upload.html'; // Caso especial: upload.html está en la carpeta files
  } else {
    href = `../${page}/${page}.html`;
  }
  
  return `
    <a class="nav-link ${isActive}" href="${href}">
      <i class="bi bi-${icon}"></i>
      <span class="d-none d-md-inline">${title}</span>
    </a>
  `;
}

// Función de logout global
window.logout = async function() {
  showNotification('Cerrando sesión...', 'info', 1000);
  try {
    const { authService } = await import('../services/authService.js');
    await authService.logout();
  } catch (error) {
    console.warn('❌ Error al cerrar sesión:', error);
  } finally {
    setTimeout(() => {
      window.location.href = '../auth/login.html';
    }, 600);
  }
};

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
  constructor(containerOrId, options = {}) {
    this.container = typeof containerOrId === 'string'
      ? document.getElementById(containerOrId)
      : containerOrId;
    this.itemsPerPage = options.itemsPerPage || 10;
    this.currentPage = options.currentPage || 1;
    this.onPageChange = options.onPageChange || (() => {});
    this.maxPagesToShow = options.maxPagesToShow || 5;
  }

  render(totalItems) {
    if (!this.container) return;

    const totalPages = Math.max(1, Math.ceil(totalItems / this.itemsPerPage));
    this.container.innerHTML = '';

    if (totalPages <= 1) {
      this.totalPages = totalPages;
      return;
    }

    this.totalPages = totalPages;
    this.currentPage = Math.min(this.currentPage, totalPages);

    const nav = document.createElement('nav');
    const list = document.createElement('ul');
    list.className = 'pagination justify-content-center';

    list.appendChild(this.createPageButton('&laquo;', this.currentPage > 1, () => this.goToPage(this.currentPage - 1)));

    this.createPageNumbers(totalPages).forEach(item => list.appendChild(item));

    list.appendChild(this.createPageButton('&raquo;', this.currentPage < totalPages, () => this.goToPage(this.currentPage + 1)));

    nav.appendChild(list);
    this.container.appendChild(nav);
  }

  createPageButton(label, enabled, onClick, active = false) {
    const listItem = document.createElement('li');
    listItem.className = 'page-item';
    if (!enabled) listItem.classList.add('disabled');
    if (active) listItem.classList.add('active');

    const link = document.createElement('a');
    link.className = 'page-link';
    link.href = '#';
    link.innerHTML = label;

    if (enabled) {
      link.addEventListener('click', (event) => {
        event.preventDefault();
        onClick();
      });
    } else {
      link.setAttribute('tabindex', '-1');
      link.setAttribute('aria-disabled', 'true');
    }

    listItem.appendChild(link);
    return listItem;
  }

  createPageNumbers(totalPages) {
    const pages = [];
    const halfRange = Math.floor(this.maxPagesToShow / 2);
    let startPage = Math.max(1, this.currentPage - halfRange);
    let endPage = startPage + this.maxPagesToShow - 1;

    if (endPage > totalPages) {
      endPage = totalPages;
      startPage = Math.max(1, endPage - this.maxPagesToShow + 1);
    }

    for (let page = startPage; page <= endPage; page++) {
      pages.push(this.createPageButton(String(page), true, () => this.goToPage(page), page === this.currentPage));
    }

    return pages;
  }

  goToPage(page) {
    const targetPage = Math.min(Math.max(1, page), this.totalPages || 1);
    if (targetPage === this.currentPage) return;

    this.currentPage = targetPage;
    if (typeof this.onPageChange === 'function') {
      this.onPageChange(targetPage);
    }
  }

  getCurrentPage() {
    return this.currentPage;
  }

  getItemsPerPage() {
    return this.itemsPerPage;
  }

  setItemsPerPage(itemsPerPage) {
    this.itemsPerPage = Math.max(1, itemsPerPage);
  }
}
