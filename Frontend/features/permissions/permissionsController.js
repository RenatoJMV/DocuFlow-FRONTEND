import { docuFlowAPI } from '../../shared/services/apiClient.js';
import { store } from '../../shared/services/store.js';
import { createNavbar, showNotification, FormValidator } from '../../shared/utils/uiHelpers.js';

class PermissionsController {
  constructor() {
    this.users = [];
    this.roles = [];
    this.currentUser = null;
    this.availablePermissions = [
      { id: 'download', name: 'Descargar archivos', icon: 'bi-download', category: 'files' },
      { id: 'delete', name: 'Eliminar archivos', icon: 'bi-trash', category: 'files' },
      { id: 'comment', name: 'Comentar documentos', icon: 'bi-chat-text', category: 'collaboration' },
      { id: 'edit', name: 'Editar documentos', icon: 'bi-pencil-square', category: 'collaboration' },
      { id: 'share', name: 'Compartir documentos', icon: 'bi-share', category: 'collaboration' },
      { id: 'admin', name: 'Acceso administrativo', icon: 'bi-shield-check', category: 'administration' },
      { id: 'view_logs', name: 'Ver registros del sistema', icon: 'bi-list-ul', category: 'administration' },
      { id: 'manage_users', name: 'Gestionar usuarios', icon: 'bi-people', category: 'administration' }
    ];
    
    this.initializeComponents();
    this.setupEventListeners();
    this.loadData();
  }

  initializeComponents() {
    // Create navbar
    createNavbar('permissions');
    
    // Setup form validation
    this.setupFormValidation();
    
    // Render permission categories
    this.renderPermissionCategories();
  }

  setupFormValidation() {
    this.validator = new FormValidator('permissionsForm', {
      userSelect: {
        required: true,
        message: 'Debe seleccionar un usuario'
      }
    });
  }

  setupEventListeners() {
    // User selection
    const userSelect = document.getElementById('userSelect');
    if (userSelect) {
      userSelect.addEventListener('change', (e) => {
        this.loadUserData(e.target.value);
      });
    }

    // Role selection
    const roleSelect = document.getElementById('roleSelect');
    if (roleSelect) {
      roleSelect.addEventListener('change', (e) => {
        this.updateUserRole(e.target.value);
      });
    }

    // Quick actions
    const saveAllBtn = document.getElementById('saveAllPermissions');
    const resetBtn = document.getElementById('resetPermissions');
    const copyPermissionsBtn = document.getElementById('copyPermissions');

    if (saveAllBtn) {
      saveAllBtn.addEventListener('click', () => this.saveAllPermissions());
    }

    if (resetBtn) {
      resetBtn.addEventListener('click', () => this.resetPermissions());
    }

    if (copyPermissionsBtn) {
      copyPermissionsBtn.addEventListener('click', () => this.showCopyModal());
    }

    // Permission checkboxes
    this.setupPermissionListeners();
  }

  setupPermissionListeners() {
    const permissionsContainer = document.getElementById('permissionsContainer');
    if (permissionsContainer) {
      permissionsContainer.addEventListener('change', (e) => {
        if (e.target.type === 'checkbox') {
          this.handlePermissionChange(e.target);
        }
      });
    }

    // Category toggles
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('category-toggle')) {
        this.toggleCategoryPermissions(e.target);
      }
    });
  }

  async loadData() {
    try {
      // Load users and roles
      const [usersResponse, rolesResponse] = await Promise.all([
        this.getDemoUsers(),
        this.getDemoRoles()
      ]);

      this.users = usersResponse;
      this.roles = rolesResponse;

      this.renderUserSelect();
      this.renderRoleSelect();

      // Load first user by default
      if (this.users.length > 0) {
        await this.loadUserData(this.users[0].id);
      }

    } catch (error) {
      console.error('Error loading data:', error);
      showNotification('Error al cargar los datos', 'error');
    }
  }

  getDemoUsers() {
    // Demo users for development
    return [
      {
        id: '1',
        username: 'admin@docuflow.com',
        name: 'Administrador',
        role: 'admin',
        status: 'active',
        lastLogin: '2024-03-15T10:30:00Z'
      },
      {
        id: '2',
        username: 'editor@docuflow.com',
        name: 'Editor Principal',
        role: 'editor',
        status: 'active',
        lastLogin: '2024-03-15T09:15:00Z'
      },
      {
        id: '3',
        username: 'viewer@docuflow.com',
        name: 'Usuario Viewer',
        role: 'viewer',
        status: 'active',
        lastLogin: '2024-03-14T16:45:00Z'
      },
      {
        id: '4',
        username: 'guest@docuflow.com',
        name: 'Invitado',
        role: 'guest',
        status: 'inactive',
        lastLogin: '2024-03-10T14:20:00Z'
      }
    ];
  }

  getDemoRoles() {
    return [
      {
        id: 'admin',
        name: 'Administrador',
        description: 'Acceso completo al sistema',
        permissions: ['download', 'delete', 'comment', 'edit', 'share', 'admin', 'view_logs', 'manage_users']
      },
      {
        id: 'editor',
        name: 'Editor',
        description: 'Puede crear, editar y compartir documentos',
        permissions: ['download', 'comment', 'edit', 'share']
      },
      {
        id: 'viewer',
        name: 'Visualizador',
        description: 'Solo puede ver y comentar documentos',
        permissions: ['download', 'comment']
      },
      {
        id: 'guest',
        name: 'Invitado',
        description: 'Acceso limitado solo para visualizar',
        permissions: ['download']
      }
    ];
  }

  renderUserSelect() {
    const userSelect = document.getElementById('userSelect');
    if (!userSelect) return;

    userSelect.innerHTML = `
      <option value="">Seleccionar usuario...</option>
      ${this.users.map(user => `
        <option value="${user.id}">
          ${user.name} (${user.username}) - ${user.role}
        </option>
      `).join('')}
    `;
  }

  renderRoleSelect() {
    const roleSelect = document.getElementById('roleSelect');
    if (!roleSelect) return;

    roleSelect.innerHTML = `
      <option value="">Seleccionar rol...</option>
      ${this.roles.map(role => `
        <option value="${role.id}">
          ${role.name} - ${role.description}
        </option>
      `).join('')}
    `;
  }

  renderPermissionCategories() {
    const container = document.getElementById('permissionsContainer');
    if (!container) return;

    const categories = [...new Set(this.availablePermissions.map(p => p.category))];
    
    container.innerHTML = categories.map(category => {
      const categoryPermissions = this.availablePermissions.filter(p => p.category === category);
      const categoryName = this.getCategoryName(category);
      
      return `
        <div class="permission-category mb-4">
          <div class="category-header d-flex justify-content-between align-items-center mb-3">
            <h6 class="category-title mb-0">
              <i class="bi bi-${this.getCategoryIcon(category)} me-2"></i>
              ${categoryName}
            </h6>
            <div class="category-actions">
              <button class="btn btn-sm btn-outline-primary category-toggle" 
                      data-category="${category}" 
                      data-action="toggle">
                <i class="bi bi-check-square me-1"></i>
                Alternar todos
              </button>
            </div>
          </div>
          <div class="row">
            ${categoryPermissions.map(permission => `
              <div class="col-md-6 col-lg-4 mb-2">
                <div class="form-check permission-item">
                  <input class="form-check-input" 
                         type="checkbox" 
                         id="perm-${permission.id}" 
                         value="${permission.id}"
                         data-category="${category}">
                  <label class="form-check-label" for="perm-${permission.id}">
                    <i class="bi ${permission.icon} me-2"></i>
                    ${permission.name}
                  </label>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }).join('');
  }

  getCategoryName(category) {
    const names = {
      files: 'Gestión de Archivos',
      collaboration: 'Colaboración',
      administration: 'Administración'
    };
    return names[category] || category;
  }

  getCategoryIcon(category) {
    const icons = {
      files: 'folder',
      collaboration: 'people',
      administration: 'gear'
    };
    return icons[category] || 'circle';
  }

  async loadUserData(userId) {
    if (!userId) {
      this.currentUser = null;
      this.clearPermissions();
      return;
    }

    try {
      const user = this.users.find(u => u.id === userId);
      if (!user) return;

      this.currentUser = user;
      
      // Set role
      const roleSelect = document.getElementById('roleSelect');
      if (roleSelect) {
        roleSelect.value = user.role;
      }

      // Get user permissions
      const permissions = await this.getUserPermissions(userId);
      this.updatePermissionsDisplay(permissions);
      
      // Update user info
      this.updateUserInfo(user);

    } catch (error) {
      console.error('Error loading user data:', error);
      showNotification('Error al cargar datos del usuario', 'error');
    }
  }

  async getUserPermissions(userId) {
    // In a real app, this would be an API call
    const user = this.users.find(u => u.id === userId);
    const role = this.roles.find(r => r.id === user?.role);
    return role?.permissions || [];
  }

  updatePermissionsDisplay(permissions) {
    this.availablePermissions.forEach(permission => {
      const checkbox = document.getElementById(`perm-${permission.id}`);
      if (checkbox) {
        checkbox.checked = permissions.includes(permission.id);
      }
    });
  }

  updateUserInfo(user) {
    const userInfoContainer = document.getElementById('userInfo');
    if (!userInfoContainer) return;

    userInfoContainer.innerHTML = `
      <div class="user-info-card">
        <div class="d-flex align-items-center gap-3">
          <div class="user-avatar">
            <i class="bi bi-person-circle fs-1"></i>
          </div>
          <div class="user-details">
            <h6 class="mb-1">${user.name}</h6>
            <p class="text-muted mb-1">${user.username}</p>
            <span class="badge bg-${this.getStatusColor(user.status)}">${user.status === 'active' ? 'Activo' : 'Inactivo'}</span>
            ${user.lastLogin ? `<p class="text-muted small mt-1">Último acceso: ${this.formatDate(user.lastLogin)}</p>` : ''}
          </div>
        </div>
      </div>
    `;
  }

  getStatusColor(status) {
    return status === 'active' ? 'success' : 'secondary';
  }

  formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  clearPermissions() {
    this.availablePermissions.forEach(permission => {
      const checkbox = document.getElementById(`perm-${permission.id}`);
      if (checkbox) {
        checkbox.checked = false;
      }
    });
  }

  async updateUserRole(roleId) {
    if (!this.currentUser || !roleId) return;

    try {
      // Update role
      this.currentUser.role = roleId;
      
      // Update permissions based on role
      const role = this.roles.find(r => r.id === roleId);
      if (role) {
        this.updatePermissionsDisplay(role.permissions);
      }

      showNotification('Rol actualizado correctamente', 'success');
    } catch (error) {
      console.error('Error updating role:', error);
      showNotification('Error al actualizar el rol', 'error');
    }
  }

  handlePermissionChange(checkbox) {
    // Here you could implement logic to handle permission dependencies
    // For example, if admin is unchecked, uncheck all admin-related permissions
    if (checkbox.value === 'admin' && !checkbox.checked) {
      ['view_logs', 'manage_users'].forEach(permId => {
        const permCheckbox = document.getElementById(`perm-${permId}`);
        if (permCheckbox) {
          permCheckbox.checked = false;
        }
      });
    }
  }

  toggleCategoryPermissions(button) {
    const category = button.dataset.category;
    const categoryCheckboxes = document.querySelectorAll(`input[data-category="${category}"]`);
    
    // Check if any checkbox in category is unchecked
    const hasUnchecked = Array.from(categoryCheckboxes).some(cb => !cb.checked);
    
    // Toggle all checkboxes in category
    categoryCheckboxes.forEach(checkbox => {
      checkbox.checked = hasUnchecked;
      this.handlePermissionChange(checkbox);
    });
  }

  async saveAllPermissions() {
    if (!this.currentUser) {
      showNotification('Debe seleccionar un usuario', 'warning');
      return;
    }

    try {
      const selectedPermissions = Array.from(
        document.querySelectorAll('input[type="checkbox"]:checked')
      ).map(cb => cb.value);

      // In a real app, make API call here
      console.log('Saving permissions for user:', this.currentUser.id, selectedPermissions);

      showNotification('Permisos guardados correctamente', 'success');
    } catch (error) {
      console.error('Error saving permissions:', error);
      showNotification('Error al guardar los permisos', 'error');
    }
  }

  resetPermissions() {
    if (!this.currentUser) return;

    if (confirm('¿Restablecer permisos a los valores por defecto del rol?')) {
      const role = this.roles.find(r => r.id === this.currentUser.role);
      if (role) {
        this.updatePermissionsDisplay(role.permissions);
        showNotification('Permisos restablecidos', 'info');
      }
    }
  }

  showCopyModal() {
    // Simple implementation - in a real app, you'd use a proper modal
    const sourceUserId = prompt('ID del usuario desde el cual copiar permisos:');
    if (sourceUserId && this.users.find(u => u.id === sourceUserId)) {
      this.copyPermissionsFrom(sourceUserId);
    }
  }

  async copyPermissionsFrom(sourceUserId) {
    try {
      const sourcePermissions = await this.getUserPermissions(sourceUserId);
      this.updatePermissionsDisplay(sourcePermissions);
      showNotification('Permisos copiados correctamente', 'success');
    } catch (error) {
      console.error('Error copying permissions:', error);
      showNotification('Error al copiar permisos', 'error');
    }
  }
}

// Initialize controller and make it globally available
let permissionsController;
document.addEventListener('DOMContentLoaded', () => {
  permissionsController = new PermissionsController();
});

