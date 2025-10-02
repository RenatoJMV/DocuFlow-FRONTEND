import { docuFlowAPI } from '../../shared/services/apiClient.js';
import { initializeNavbar, showNotification, formatDate, Pagination } from '../../shared/utils/uiHelpers.js';

class PermissionsController {
  constructor() {
    this.permissions = [];
    this.files = [];
    this.users = [];
    this.currentPage = 1;
    this.itemsPerPage = 15;
    this.currentUser = JSON.parse(localStorage.getItem('user') || '{}');
    
    this.pagination = new Pagination('paginationContainer', {
      itemsPerPage: this.itemsPerPage,
      onPageChange: (page) => {
        this.currentPage = page;
        this.renderPermissions();
      }
    });
    
    this.initializeComponents();
    this.setupEventListeners();
    this.loadInitialData();
  }

  initializeComponents() {
    initializeNavbar('permissions');
    this.setupFormValidation();
  }

  setupFormValidation() {
    const form = document.getElementById('assignPermissionForm');
    if (form) {
      form.addEventListener('submit', (e) => this.handleAssignPermission(e));
    }
  }

  setupEventListeners() {
    // Botón de refrescar
    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => this.loadPermissions());
    }

    // Filtros
    const fileFilter = document.getElementById('fileFilter');
    if (fileFilter) {
      fileFilter.addEventListener('change', () => this.applyFilters());
    }

    const userFilter = document.getElementById('userFilter');
    if (userFilter) {
      userFilter.addEventListener('change', () => this.applyFilters());
    }

    const permissionTypeFilter = document.getElementById('permissionTypeFilter');
    if (permissionTypeFilter) {
      permissionTypeFilter.addEventListener('change', () => this.applyFilters());
    }

    // Botón de limpiar filtros
    const clearFiltersBtn = document.getElementById('clearFiltersBtn');
    if (clearFiltersBtn) {
      clearFiltersBtn.addEventListener('click', () => this.clearFilters());
    }

    // Modal de asignar permisos
    const assignPermissionBtn = document.getElementById('assignPermissionBtn');
    if (assignPermissionBtn) {
      assignPermissionBtn.addEventListener('click', () => this.showAssignPermissionModal());
    }
  }

  async loadInitialData() {
    try {
      await Promise.all([
        this.loadFiles(),
        this.loadUsers(),
        this.loadPermissions()
      ]);
      this.populateSelects();
      this.updateStats();
    } catch (error) {
      console.error('Error loading initial data:', error);
      showNotification('Error al cargar datos iniciales', 'error');
    }
  }

  async loadFiles() {
    try {
      const files = await docuFlowAPI.files.getAll();
      this.files = files.data || files || [];
    } catch (error) {
      console.error('Error loading files:', error);
      this.files = [
        { id: 1, title: 'Documento Demo 1', fileName: 'demo1.pdf' },
        { id: 2, title: 'Documento Demo 2', fileName: 'demo2.pdf' }
      ];
    }
  }

  async loadUsers() {
    try {
      // Si es admin, cargar todos los usuarios
      if (this.isAdmin()) {
        const users = await docuFlowAPI.admin.users.getAll();
        this.users = users.data || users || [];
      } else {
        // Si no es admin, solo mostrar el usuario actual
        this.users = [this.currentUser];
      }
    } catch (error) {
      console.error('Error loading users:', error);
      this.users = [
        { id: 1, name: 'Usuario Demo 1', email: 'demo1@example.com' },
        { id: 2, name: 'Usuario Demo 2', email: 'demo2@example.com' }
      ];
    }
  }

  async loadPermissions() {
    try {
      this.showLoading(true);
      
      // Cargar permisos según el rol del usuario
      if (this.isAdmin()) {
        // Admin ve todos los permisos
        this.permissions = await this.loadAllPermissions();
      } else {
        // Usuario normal solo ve sus permisos
        const userPermissions = await docuFlowAPI.permissions.getUserPermissions(this.currentUser.id);
        this.permissions = userPermissions.data || userPermissions || [];
      }
      
      this.applyFilters();
      
    } catch (error) {
      console.error('Error loading permissions:', error);
      showNotification('Error al cargar permisos', 'error');
      this.loadDemoPermissions();
    } finally {
      this.showLoading(false);
    }
  }

  async loadAllPermissions() {
    // Cargar permisos para todos los archivos
    const allPermissions = [];
    
    for (const file of this.files) {
      try {
        const filePermissions = await docuFlowAPI.permissions.getFilePermissions(file.id);
        const permissions = filePermissions.data || filePermissions || [];
        
        permissions.forEach(permission => {
          allPermissions.push({
            ...permission,
            fileName: file.title || file.fileName,
            fileId: file.id
          });
        });
      } catch (error) {
        console.warn(`Error loading permissions for file ${file.id}:`, error);
      }
    }
    
    return allPermissions;
  }

  loadDemoPermissions() {
    this.permissions = [
      {
        id: 1,
        fileId: 1,
        fileName: 'Documento Demo 1',
        userId: this.currentUser.id,
        userName: this.currentUser.name || 'Usuario Demo',
        userEmail: this.currentUser.email || 'demo@example.com',
        permissionType: 'READ',
        grantedBy: 'admin@example.com',
        grantedAt: new Date(Date.now() - 86400000).toISOString(),
        expiresAt: null
      },
      {
        id: 2,
        fileId: 1,
        fileName: 'Documento Demo 1',
        userId: 2,
        userName: 'Ana García',
        userEmail: 'ana@example.com',
        permissionType: 'WRITE',
        grantedBy: this.currentUser.email,
        grantedAt: new Date(Date.now() - 3600000).toISOString(),
        expiresAt: new Date(Date.now() + 30 * 86400000).toISOString() // 30 días
      },
      {
        id: 3,
        fileId: 2,
        fileName: 'Documento Demo 2',
        userId: this.currentUser.id,
        userName: this.currentUser.name || 'Usuario Demo',
        userEmail: this.currentUser.email || 'demo@example.com',
        permissionType: 'ADMIN',
        grantedBy: 'system',
        grantedAt: new Date(Date.now() - 172800000).toISOString(),
        expiresAt: null
      }
    ];
    
    this.applyFilters();
  }

  populateSelects() {
    // Populate file selects
    const fileSelects = document.querySelectorAll('.file-select');
    fileSelects.forEach(select => {
      select.innerHTML = '<option value="">Todos los archivos</option>';
      this.files.forEach(file => {
        const option = document.createElement('option');
        option.value = file.id;
        option.textContent = file.title || file.fileName || `Archivo ${file.id}`;
        select.appendChild(option);
      });
    });

    // Populate user selects
    const userSelects = document.querySelectorAll('.user-select');
    userSelects.forEach(select => {
      select.innerHTML = '<option value="">Todos los usuarios</option>';
      this.users.forEach(user => {
        const option = document.createElement('option');
        option.value = user.id;
        option.textContent = `${user.name || 'Usuario'} (${user.email || 'Sin email'})`;
        select.appendChild(option);
      });
    });

    // Populate permission type selects
    const permissionSelects = document.querySelectorAll('.permission-type-select');
    permissionSelects.forEach(select => {
      select.innerHTML = `
        <option value="">Todos los tipos</option>
        <option value="READ">Lectura</option>
        <option value="WRITE">Escritura</option>
        <option value="DELETE">Eliminación</option>
        <option value="ADMIN">Administrador</option>
        <option value="SHARE">Compartir</option>
      `;
    });
  }

  applyFilters() {
    let filtered = [...this.permissions];

    // Filtrar por archivo
    const fileFilter = document.getElementById('fileFilter');
    if (fileFilter && fileFilter.value) {
      filtered = filtered.filter(p => p.fileId == fileFilter.value);
    }

    // Filtrar por usuario
    const userFilter = document.getElementById('userFilter');
    if (userFilter && userFilter.value) {
      filtered = filtered.filter(p => p.userId == userFilter.value);
    }

    // Filtrar por tipo de permiso
    const permissionTypeFilter = document.getElementById('permissionTypeFilter');
    if (permissionTypeFilter && permissionTypeFilter.value) {
      filtered = filtered.filter(p => p.permissionType === permissionTypeFilter.value);
    }

    // Ordenar por fecha de creación (más recientes primero)
    filtered.sort((a, b) => new Date(b.grantedAt) - new Date(a.grantedAt));

    this.filteredPermissions = filtered;
    this.pagination.updateData(this.filteredPermissions);
    this.renderPermissions();
    this.updateFilteredCount();
  }

  renderPermissions() {
    const container = document.getElementById('permissionsContainer');
    if (!container) return;

    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const endIndex = startIndex + this.itemsPerPage;
    const permissionsToShow = this.filteredPermissions.slice(startIndex, endIndex);

    if (permissionsToShow.length === 0) {
      container.innerHTML = `
        <div class="text-center text-muted py-4">
          <i class="bi bi-shield-lock fs-1 mb-3"></i>
          <p>No se encontraron permisos.</p>
          <small>Los permisos asignados aparecerán aquí.</small>
        </div>
      `;
      return;
    }

    container.innerHTML = permissionsToShow.map(permission => 
      this.renderPermissionItem(permission)
    ).join('');
    
    this.setupPermissionActions();
  }

  renderPermissionItem(permission) {
    const permissionTypeInfo = this.getPermissionTypeInfo(permission.permissionType);
    const isExpired = permission.expiresAt && new Date(permission.expiresAt) < new Date();
    const canManage = this.canManagePermission(permission);
    
    return `
      <div class="permission-item mb-2" data-permission-id="${permission.id}">
        <div class="card ${isExpired ? 'border-danger' : ''}">
          <div class="card-body">
            <div class="row align-items-center">
              <div class="col-auto">
                <div class="permission-icon ${permissionTypeInfo.colorClass}">
                  <i class="bi ${permissionTypeInfo.icon}"></i>
                </div>
                ${isExpired ? '<div class="expired-indicator">EXPIRADO</div>' : ''}
              </div>
              <div class="col">
                <div class="d-flex justify-content-between align-items-start">
                  <div class="flex-grow-1">
                    <h6 class="mb-1">
                      <i class="bi bi-file-text me-1"></i>
                      ${this.escapeHtml(permission.fileName)}
                    </h6>
                    <p class="mb-1 text-muted">
                      <i class="bi bi-person me-1"></i>
                      ${this.escapeHtml(permission.userName)} 
                      <small>(${this.escapeHtml(permission.userEmail)})</small>
                    </p>
                    <div class="d-flex flex-wrap gap-2 align-items-center">
                      <span class="badge ${permissionTypeInfo.badgeClass}">
                        <i class="bi ${permissionTypeInfo.icon} me-1"></i>
                        ${permissionTypeInfo.label}
                      </span>
                      <small class="text-muted">
                        <i class="bi bi-clock me-1"></i>
                        Otorgado: ${formatDate(permission.grantedAt)}
                      </small>
                      ${permission.expiresAt ? `
                        <small class="text-muted">
                          <i class="bi bi-calendar-x me-1"></i>
                          Expira: ${formatDate(permission.expiresAt)}
                        </small>
                      ` : `
                        <small class="text-success">
                          <i class="bi bi-infinity me-1"></i>
                          Permanente
                        </small>
                      `}
                    </div>
                    ${permission.grantedBy ? `
                      <small class="text-muted d-block mt-1">
                        Otorgado por: ${this.escapeHtml(permission.grantedBy)}
                      </small>
                    ` : ''}
                  </div>
                  ${canManage ? `
                    <div class="permission-actions">
                      <button class="btn btn-sm btn-outline-danger revoke-permission-btn" 
                              data-permission-id="${permission.id}" 
                              title="Revocar permiso">
                        <i class="bi bi-x-circle"></i>
                      </button>
                    </div>
                  ` : ''}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  getPermissionTypeInfo(type) {
    const types = {
      'READ': {
        icon: 'bi-eye',
        label: 'Lectura',
        colorClass: 'text-info',
        badgeClass: 'bg-info'
      },
      'WRITE': {
        icon: 'bi-pencil',
        label: 'Escritura',
        colorClass: 'text-primary',
        badgeClass: 'bg-primary'
      },
      'DELETE': {
        icon: 'bi-trash',
        label: 'Eliminación',
        colorClass: 'text-danger',
        badgeClass: 'bg-danger'
      },
      'ADMIN': {
        icon: 'bi-gear',
        label: 'Administrador',
        colorClass: 'text-dark',
        badgeClass: 'bg-dark'
      },
      'SHARE': {
        icon: 'bi-share',
        label: 'Compartir',
        colorClass: 'text-success',
        badgeClass: 'bg-success'
      }
    };
    
    return types[type] || {
      icon: 'bi-shield',
      label: type,
      colorClass: 'text-secondary',
      badgeClass: 'bg-secondary'
    };
  }

  setupPermissionActions() {
    // Botones de revocar permiso
    document.querySelectorAll('.revoke-permission-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const permissionId = e.target.closest('[data-permission-id]').dataset.permissionId;
        this.revokePermission(permissionId);
      });
    });
  }

  showAssignPermissionModal() {
    const modal = document.getElementById('assignPermissionModal');
    if (modal) {
      const bootstrapModal = new bootstrap.Modal(modal);
      bootstrapModal.show();
    }
  }

  async handleAssignPermission(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const permissionData = {
      fileId: parseInt(formData.get('fileId')),
      userId: parseInt(formData.get('userId')),
      permissionType: formData.get('permissionType'),
      expiresAt: formData.get('expiresAt') || null
    };

    if (!permissionData.fileId || !permissionData.userId || !permissionData.permissionType) {
      showNotification('Por favor, completa todos los campos requeridos', 'warning');
      return;
    }

    try {
      this.setSubmitLoading(true);
      
      await docuFlowAPI.permissions.assign(permissionData);
      
      showNotification('Permiso asignado exitosamente', 'success');
      
      // Cerrar modal
      const modal = bootstrap.Modal.getInstance(document.getElementById('assignPermissionModal'));
      if (modal) modal.hide();
      
      // Limpiar formulario
      e.target.reset();
      
      // Recargar permisos
      await this.loadPermissions();
      
    } catch (error) {
      console.error('Error assigning permission:', error);
      showNotification('Error al asignar permiso', 'error');
    } finally {
      this.setSubmitLoading(false);
    }
  }

  async revokePermission(permissionId) {
    const permission = this.permissions.find(p => p.id == permissionId);
    if (!permission) return;

    if (!confirm(`¿Estás seguro de que deseas revocar el permiso de ${permission.permissionType} para ${permission.userName}?`)) {
      return;
    }

    try {
      const revokeData = {
        fileId: permission.fileId,
        userId: permission.userId,
        permissionType: permission.permissionType
      };

      await docuFlowAPI.permissions.revoke(revokeData);
      
      showNotification('Permiso revocado exitosamente', 'success');
      await this.loadPermissions();
      
    } catch (error) {
      console.error('Error revoking permission:', error);
      showNotification('Error al revocar permiso', 'error');
    }
  }

  canManagePermission(permission) {
    return this.isAdmin() || 
           permission.grantedBy === this.currentUser.email ||
           permission.userId === this.currentUser.id;
  }

  clearFilters() {
    document.getElementById('fileFilter').value = '';
    document.getElementById('userFilter').value = '';
    document.getElementById('permissionTypeFilter').value = '';
    
    this.applyFilters();
  }

  updateStats() {
    const totalPermissions = this.permissions.length;
    const myPermissions = this.permissions.filter(p => p.userId === this.currentUser.id).length;
    const expiredPermissions = this.permissions.filter(p => 
      p.expiresAt && new Date(p.expiresAt) < new Date()
    ).length;
    
    this.updateStatCard('totalPermissions', totalPermissions);
    this.updateStatCard('myPermissions', myPermissions);
    this.updateStatCard('expiredPermissions', expiredPermissions);
  }

  updateStatCard(elementId, value) {
    const element = document.getElementById(elementId);
    if (element) {
      element.textContent = value;
    }
  }

  updateFilteredCount() {
    const countElement = document.getElementById('filteredCount');
    if (countElement) {
      countElement.textContent = `${this.filteredPermissions.length} de ${this.permissions.length} permisos`;
    }
  }

  setSubmitLoading(isLoading) {
    const submitBtn = document.getElementById('assignPermissionSubmitBtn');
    if (submitBtn) {
      submitBtn.disabled = isLoading;
      submitBtn.innerHTML = isLoading 
        ? '<span class="spinner-border spinner-border-sm me-2"></span>Asignando...' 
        : 'Asignar Permiso';
    }
  }

  showLoading(show) {
    const container = document.getElementById('permissionsContainer');
    if (show && container) {
      container.innerHTML = `
        <div class="text-center py-4">
          <div class="spinner-border text-primary" role="status">
            <span class="visually-hidden">Cargando...</span>
          </div>
          <p class="mt-2">Cargando permisos...</p>
        </div>
      `;
    }
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  isAdmin() {
    return this.currentUser.role === 'ADMIN' || this.currentUser.isAdmin;
  }
}

// Inicializar controlador cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
  new PermissionsController();
});

export default PermissionsController;