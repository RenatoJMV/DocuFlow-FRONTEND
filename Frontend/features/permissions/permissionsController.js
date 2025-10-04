import { initializeNavbar, showNotification, FormValidator } from '../../shared/utils/uiHelpers.js';
import {
  apiGetUsers,
  apiGetRoles,
  apiGetUserPermissions,
  apiSetUserPermissions,
  apiSetUserRole
} from '../../shared/services/userService.js';

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
    initializeNavbar('permissions');
    
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
      const [usersResult, rolesResult] = await Promise.all([
        apiGetUsers().catch(error => ({ success: false, users: [], error })),
        apiGetRoles().catch(error => ({ success: false, roles: [], error }))
      ]);

      const normalizedUsers = this.normalizeUsers(usersResult?.users || []);
      const normalizedRoles = this.normalizeRoles(rolesResult?.roles || []);

      this.users = normalizedUsers;
      this.roles = normalizedRoles;

      if (!usersResult?.success) {
        console.warn('No se pudieron obtener los usuarios desde el backend', usersResult?.error);
        showNotification('No se pudieron obtener los usuarios. Verifique la API.', 'warning');
      }

      if (!rolesResult?.success) {
        console.warn('No se pudieron obtener los roles desde el backend', rolesResult?.error);
        showNotification('No se pudieron obtener los roles. Verifique la API.', 'warning');
      }

      this.renderUserSelect();
      this.renderRoleSelect();

      if (this.users.length === 0) {
        showNotification('No hay usuarios disponibles. Crea usuarios en el backend.', 'info');
        this.clearPermissions();
        this.currentUser = null;
        this.updateUserInfo(null);
        return;
      }

      await this.loadUserData(this.users[0].id);
    } catch (error) {
      console.error('Error loading data:', error);
      this.users = [];
      this.roles = [];
      this.renderUserSelect();
      this.renderRoleSelect();
      this.clearPermissions();
      showNotification('Error al cargar los datos desde el servidor', 'error');
    }
  }

  renderUserSelect() {
    const userSelect = document.getElementById('userSelect');
    if (!userSelect) return;

    if (this.users.length === 0) {
      userSelect.innerHTML = '<option value="">No hay usuarios disponibles</option>';
      return;
    }

    userSelect.innerHTML = `
      <option value="">Seleccionar usuario...</option>
      ${this.users.map(user => `
        <option value="${user.id}">
          ${user.name} (${user.username}) - ${user.role || 'sin rol'}
        </option>
      `).join('')}
    `;
  }

  renderRoleSelect() {
    const roleSelect = document.getElementById('roleSelect');
    if (!roleSelect) return;

    if (this.roles.length === 0) {
      roleSelect.innerHTML = '<option value="">No hay roles disponibles</option>';
      return;
    }

    roleSelect.innerHTML = `
      <option value="">Seleccionar rol...</option>
      ${this.roles.map(role => `
        <option value="${role.id}">
          ${role.name} ${role.description ? `- ${role.description}` : ''}
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
      if (!user) {
        console.warn('Usuario no encontrado en lista local, reintentando cargar');
        await this.reloadUsers();
        return;
      }

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
    try {
      const response = await apiGetUserPermissions(userId);
      if (response?.success && Array.isArray(response.permissions)) {
        return response.permissions;
      }

      if (Array.isArray(response)) {
        return response;
      }

      if (Array.isArray(response?.data)) {
        return response.data;
      }

      if (!response?.success) {
        showNotification('No se pudieron obtener los permisos del usuario', 'warning');
      }
    } catch (error) {
      console.error('Error obteniendo permisos del usuario:', error);
      showNotification('Error al cargar permisos del usuario', 'error');
    }

    return [];
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

    if (!user) {
      userInfoContainer.innerHTML = `
        <div class="user-info-card text-muted">
          <p class="mb-0">Selecciona un usuario para ver sus detalles.</p>
        </div>
      `;
      return;
    }

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

    const previousRole = this.currentUser.role;

    try {
      const response = await apiSetUserRole(this.currentUser.id, roleId);
      if (response?.success !== false) {
        this.currentUser.role = roleId;
        const role = this.roles.find(r => r.id === roleId);
        if (role) {
          this.updatePermissionsDisplay(role.permissions || []);
        }
        showNotification('Rol actualizado correctamente', 'success');
        return;
      }

      throw new Error(response?.error || 'Respuesta inválida del servidor');
    } catch (error) {
      console.error('Error updating role:', error);
      this.currentUser.role = previousRole;
      const roleSelect = document.getElementById('roleSelect');
      if (roleSelect) {
        roleSelect.value = previousRole || '';
      }
      showNotification('Error al actualizar el rol del usuario', 'error');
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

      const response = await apiSetUserPermissions(this.currentUser.id, selectedPermissions);

      if (response?.success !== false) {
        showNotification('Permisos guardados correctamente', 'success');
        return;
      }

      throw new Error(response?.error || 'Respuesta inválida del servidor');
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

  async reloadUsers() {
    try {
      const response = await apiGetUsers();
      const normalizedUsers = this.normalizeUsers(response?.users || []);
      if (normalizedUsers.length > 0) {
        this.users = normalizedUsers;
        this.renderUserSelect();
      }
    } catch (error) {
      console.error('Error recargando usuarios:', error);
    }
  }

  normalizeUsers(users) {
    if (!Array.isArray(users)) {
      return [];
    }

    return users.map((user, index) => {
      const id = user?.id || user?._id || user?.userId || user?.uuid || user?.email || `user-${index}`;
      const username = user?.username || user?.email || user?.userName || user?.login || id;
      const name = user?.name || user?.fullName || user?.displayName || username;
      const role = user?.role || (Array.isArray(user?.roles) ? user.roles[0] : undefined) || '';
      const status = typeof user?.status === 'string'
        ? user.status.toLowerCase()
        : user?.active === false ? 'inactive' : 'active';

      return {
        id: String(id),
        username: String(username),
        name: String(name),
        role: role ? String(role) : '',
        status,
        lastLogin: user?.lastLogin || user?.last_login || user?.lastAccessAt || user?.last_access_at || null
      };
    });
  }

  normalizeRoles(roles) {
    if (!Array.isArray(roles)) {
      return [];
    }

    return roles.map((role, index) => {
      if (typeof role === 'string') {
        return {
          id: role,
          name: role,
          description: ''
        };
      }

      const id = role?.id || role?._id || role?.roleId || role?.name || `role-${index}`;
      return {
        id: String(id),
        name: role?.name || role?.displayName || String(id),
  description: role?.description || role?.details || '',
        permissions: Array.isArray(role?.permissions) ? role.permissions : []
      };
    });
  }
}

// Initialize controller and make it globally available
let permissionsController;
document.addEventListener('DOMContentLoaded', () => {
  permissionsController = new PermissionsController();
});

