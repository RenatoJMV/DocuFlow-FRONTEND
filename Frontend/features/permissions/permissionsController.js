// permissionsControllerSimple.js - Controlador simplificado para gestión de permisos
import { docuFlowAPI } from '../../shared/services/apiClientSimple.js';
import authService from '../../shared/services/authServiceSimple.js';
import { showNotification } from '../../shared/utils/uiHelpers.js';

class SimplePermissionsController {
  constructor() {
    this.permissions = [];
    this.users = [];
    this.files = [];
    this.init();
  }

  async init() {
    if (!authService.isLoggedIn()) {
      window.location.href = '../auth/login.html';
      return;
    }

    if (!authService.isAdmin()) {
      showNotification('Solo los administradores pueden gestionar permisos', 'error');
      window.location.href = '../dashboard/dashboard.html';
      return;
    }

    this.setupEventListeners();
    await this.loadData();
    this.updateUI();
  }

  setupEventListeners() {
    // Formulario de nuevo permiso
    const permissionForm = document.getElementById('permissionForm');
    if (permissionForm) {
      permissionForm.addEventListener('submit', (e) => this.handleSubmitPermission(e));
    }

    // Filtros
    const userFilter = document.getElementById('userFilter');
    if (userFilter) {
      userFilter.addEventListener('change', (e) => this.filterByUser(e.target.value));
    }

    const fileFilter = document.getElementById('fileFilter');
    if (fileFilter) {
      fileFilter.addEventListener('change', (e) => this.filterByFile(e.target.value));
    }

    const permissionFilter = document.getElementById('permissionFilter');
    if (permissionFilter) {
      permissionFilter.addEventListener('change', (e) => this.filterByPermission(e.target.value));
    }

    // Refresh
    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => this.loadData());
    }

    // Limpiar filtros
    const clearFiltersBtn = document.getElementById('clearFiltersBtn');
    if (clearFiltersBtn) {
      clearFiltersBtn.addEventListener('click', () => this.clearFilters());
    }
  }

  async loadData() {
    try {
      showNotification('Cargando datos...', 'info', 1000);

      // Cargar permisos, usuarios y archivos (en modo demo)
      const [permissionsResponse, usersResponse, filesResponse] = await Promise.all([
        docuFlowAPI.permissions.list(),
        this.getDemoUsers(),
        docuFlowAPI.files.list()
      ]);

      if (permissionsResponse.success) {
        this.permissions = permissionsResponse.data.permissions || [];
      }

      this.users = usersResponse;
      this.files = filesResponse.success ? filesResponse.data.files || [] : [];

      this.renderPermissionsList();
      this.populateSelects();
      this.updateStats();

    } catch (error) {
      console.error('Error cargando datos:', error);
      showNotification('Error cargando datos', 'error');
    }
  }

  getDemoUsers() {
    // Usuarios de demostración
    return [
      { id: 1, email: 'admin@docuflow.com', name: 'Administrador', role: 'admin' },
      { id: 2, email: 'user@docuflow.com', name: 'Usuario Regular', role: 'user' },
      { id: 3, email: 'guest@docuflow.com', name: 'Invitado', role: 'guest' }
    ];
  }

  async handleSubmitPermission(event) {
    event.preventDefault();

    const userId = document.getElementById('selectUser').value;
    const fileId = document.getElementById('selectFile').value;
    const permission = document.getElementById('selectPermission').value;

    if (!userId || !fileId || !permission) {
      showNotification('Todos los campos son obligatorios', 'error');
      return;
    }

    // Verificar si el permiso ya existe
    const existingPermission = this.permissions.find(p => 
      p.userId == userId && p.fileId == fileId && p.permission === permission
    );

    if (existingPermission) {
      showNotification('Este permiso ya existe', 'warning');
      return;
    }

    const permissionData = {
      userId: parseInt(userId),
      fileId: parseInt(fileId),
      permission,
      grantedBy: authService.getCurrentUser().email,
      grantedAt: new Date().toISOString()
    };

    try {
      const response = await docuFlowAPI.permissions.grant(permissionData);
      
      if (response.success) {
        showNotification('Permiso otorgado correctamente', 'success');
        
        // Limpiar formulario
        document.getElementById('permissionForm').reset();
        
        // Recargar permisos
        await this.loadData();
      }

    } catch (error) {
      console.error('Error otorgando permiso:', error);
      showNotification('Error otorgando permiso', 'error');
    }
  }

  async revokePermission(permissionId) {
    if (!confirm('¿Estás seguro de revocar este permiso?')) return;

    try {
      const response = await docuFlowAPI.permissions.revoke(permissionId);
      
      if (response.success) {
        showNotification('Permiso revocado correctamente', 'success');
        await this.loadData();
      }

    } catch (error) {
      console.error('Error revocando permiso:', error);
      showNotification('Error revocando permiso', 'error');
    }
  }

  filterByUser(userId) {
    if (userId === 'all') {
      this.renderPermissionsList();
    } else {
      const filtered = this.permissions.filter(p => p.userId == userId);
      this.renderPermissionsList(filtered);
    }
  }

  filterByFile(fileId) {
    if (fileId === 'all') {
      this.renderPermissionsList();
    } else {
      const filtered = this.permissions.filter(p => p.fileId == fileId);
      this.renderPermissionsList(filtered);
    }
  }

  filterByPermission(permission) {
    if (permission === 'all') {
      this.renderPermissionsList();
    } else {
      const filtered = this.permissions.filter(p => p.permission === permission);
      this.renderPermissionsList(filtered);
    }
  }

  clearFilters() {
    const userFilter = document.getElementById('userFilter');
    const fileFilter = document.getElementById('fileFilter');
    const permissionFilter = document.getElementById('permissionFilter');
    
    if (userFilter) userFilter.value = 'all';
    if (fileFilter) fileFilter.value = 'all';
    if (permissionFilter) permissionFilter.value = 'all';

    this.renderPermissionsList();
    showNotification('Filtros limpiados', 'info', 2000);
  }

  renderPermissionsList(permissionsToRender = this.permissions) {
    const container = document.getElementById('permissionsList');
    if (!container) return;

    if (permissionsToRender.length === 0) {
      container.innerHTML = `
        <div class="text-center py-5">
          <i class="bi bi-shield-x" style="font-size: 3rem; color: #ccc;"></i>
          <p class="text-muted mt-3">No hay permisos para mostrar</p>
        </div>
      `;
      return;
    }

    container.innerHTML = permissionsToRender.map(permission => {
      const user = this.users.find(u => u.id === permission.userId);
      const file = this.files.find(f => f.id === permission.fileId);
      
      return `
        <div class="permission-item card mb-2">
          <div class="card-body d-flex align-items-center">
            <div class="permission-icon me-3">
              <i class="bi ${this.getPermissionIcon(permission.permission)} ${this.getPermissionColor(permission.permission)}" style="font-size: 1.5rem;"></i>
            </div>
            <div class="permission-info flex-grow-1">
              <div class="d-flex justify-content-between align-items-start">
                <div>
                  <h6 class="mb-1">
                    <strong>${user?.name || 'Usuario desconocido'}</strong>
                    <span class="text-muted">puede</span>
                    <span class="badge bg-primary">${this.getPermissionText(permission.permission)}</span>
                  </h6>
                  <p class="mb-1 text-muted">
                    <i class="bi bi-file-earmark me-1"></i>
                    ${file?.name || 'Archivo desconocido'}
                  </p>
                  <small class="text-muted">
                    Otorgado por: ${permission.grantedBy} • 
                    ${permission.grantedAt ? this.formatDate(permission.grantedAt) : 'Fecha desconocida'}
                  </small>
                </div>
                <div class="permission-actions">
                  <button class="btn btn-sm btn-outline-danger" onclick="permissionsController.revokePermission(${permission.id})">
                    <i class="bi bi-x-circle"></i> Revocar
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  populateSelects() {
    // Poblar select de usuarios
    const userSelect = document.getElementById('selectUser');
    if (userSelect) {
      userSelect.innerHTML = '<option value="">Selecciona un usuario</option>' + 
        this.users.map(user => `<option value="${user.id}">${user.name} (${user.email})</option>`).join('');
    }

    // Poblar select de archivos
    const fileSelect = document.getElementById('selectFile');
    if (fileSelect) {
      fileSelect.innerHTML = '<option value="">Selecciona un archivo</option>' + 
        this.files.map(file => `<option value="${file.id}">${file.name}</option>`).join('');
    }

    // Poblar filtros
    const userFilter = document.getElementById('userFilter');
    if (userFilter) {
      userFilter.innerHTML = '<option value="all">Todos los usuarios</option>' + 
        this.users.map(user => `<option value="${user.id}">${user.name}</option>`).join('');
    }

    const fileFilter = document.getElementById('fileFilter');
    if (fileFilter) {
      fileFilter.innerHTML = '<option value="all">Todos los archivos</option>' + 
        this.files.map(file => `<option value="${file.id}">${file.name}</option>`).join('');
    }
  }

  updateStats() {
    const totalPermissions = this.permissions.length;
    const readPermissions = this.permissions.filter(p => p.permission === 'read').length;
    const writePermissions = this.permissions.filter(p => p.permission === 'write').length;
    const deletePermissions = this.permissions.filter(p => p.permission === 'delete').length;

    const statsContainer = document.getElementById('permissionsStats');
    if (statsContainer) {
      statsContainer.innerHTML = `
        <div class="row">
          <div class="col-md-3">
            <div class="stat-card">
              <h6>Total Permisos</h6>
              <span class="stat-number">${totalPermissions}</span>
            </div>
          </div>
          <div class="col-md-3">
            <div class="stat-card">
              <h6>Lectura</h6>
              <span class="stat-number text-info">${readPermissions}</span>
            </div>
          </div>
          <div class="col-md-3">
            <div class="stat-card">
              <h6>Escritura</h6>
              <span class="stat-number text-warning">${writePermissions}</span>
            </div>
          </div>
          <div class="col-md-3">
            <div class="stat-card">
              <h6>Eliminación</h6>
              <span class="stat-number text-danger">${deletePermissions}</span>
            </div>
          </div>
        </div>
      `;
    }
  }

  updateUI() {
    const user = authService.getCurrentUser();
    const userInfo = document.getElementById('userInfo');
    
    if (userInfo) {
      userInfo.innerHTML = `
        <span>Bienvenido, ${user.name} (Administrador)</span>
        <button class="btn btn-sm btn-outline-secondary ms-2" onclick="authService.logout().then(() => location.href = '../auth/login.html')">
          Cerrar Sesión
        </button>
      `;
    }
  }

  // Utilidades
  getPermissionIcon(permission) {
    const icons = {
      read: 'bi-eye',
      write: 'bi-pencil',
      delete: 'bi-trash'
    };
    return icons[permission] || 'bi-question-circle';
  }

  getPermissionColor(permission) {
    const colors = {
      read: 'text-info',
      write: 'text-warning',
      delete: 'text-danger'
    };
    return colors[permission] || 'text-muted';
  }

  getPermissionText(permission) {
    const texts = {
      read: 'Leer',
      write: 'Escribir',
      delete: 'Eliminar'
    };
    return texts[permission] || permission;
  }

  formatDate(dateString) {
    return new Date(dateString).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
}

// Instancia global
const permissionsController = new SimplePermissionsController();

// Hacer disponible globalmente
window.permissionsController = permissionsController;

export default permissionsController;