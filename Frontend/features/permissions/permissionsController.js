import {
  initializeNavbar,
  showNotification,
  FormValidator,
  validators,
  debounce,
  formatDate,
  formatRelativeTime
} from '../../shared/utils/uiHelpers.js';
import { enforcePageAuth } from '../../shared/utils/authGuard.js';
import {
  apiGetUsers,
  apiGetRoles,
  apiGetUserPermissions,
  apiSetUserPermissions,
  apiSetUserRole,
  apiCreateUser,
  apiUpdateUser,
  apiDeleteUser,
  apiResetUserPassword,
  apiGetPermissionCatalog,
  apiGetRolePermissionTemplates
} from '../../shared/services/userService.js';

class PermissionsController {
  constructor() {
    if (!enforcePageAuth({
      message: 'Inicia sesión para administrar permisos y roles.'
    })) {
      return;
    }

    this.users = [];
    this.filteredUsers = [];
    this.roles = [];
    this.permissionCatalog = [];
    this.permissionTemplates = {};
    this.permissionLookup = new Map();
    this.searchQuery = '';
    this.currentUser = null;
    this.selectedUserId = null;
    this.tableSelection = new Set();
    this.loadingInitialData = false;
    this.editingUserId = null;
    this.passwordTargetUserId = null;
    this.importInput = null;

    this.modals = { addUser: null, changePassword: null };
    this.forms = {};
    this.validators = {};

    this.initializeComponents();
    this.setupEventListeners();
    this.loadInitialData();
  }

  initializeComponents() {
    initializeNavbar('permissions');

    this.forms.permission = document.getElementById('permissionForm');
    this.forms.addUser = document.getElementById('addUserForm');
    this.forms.changePassword = document.getElementById('changePasswordForm');

    this.setupValidators();
    this.setupModals();
    this.setTableLoading(true);
  }

  setupValidators() {
    this.validators.permission = new FormValidator('permissionForm');
    this.validators.permission
      .addRule('userSelect', validators.required, 'Selecciona un usuario')
      .addRule('roleSelect', validators.required, 'Selecciona un rol');

    this.validators.user = new FormValidator('addUserForm');
    this.validators.user
      .addRule('userName', validators.required, 'El nombre de usuario es obligatorio')
      .addRule('userEmail', (value) => validators.required(value) && validators.email(value), 'Ingresa un correo válido')
      .addRule('userRole', validators.required, 'Selecciona un rol');

    this.validators.password = new FormValidator('changePasswordForm');
    this.validators.password
      .addRule('newPassword', validators.minLength(8), 'La contraseña debe tener al menos 8 caracteres')
      .addRule('confirmNewPassword', (value) => value === document.getElementById('newPassword')?.value, 'Las contraseñas no coinciden');
  }

  setupModals() {
    if (!window.bootstrap?.Modal) {
      return;
    }

    const addUserModalEl = document.getElementById('addUserModal');
    if (addUserModalEl) {
      this.modals.addUser = window.bootstrap.Modal.getOrCreateInstance(addUserModalEl);
      addUserModalEl.addEventListener('hidden.bs.modal', () => {
        this.editingUserId = null;
        this.clearAddUserForm();
      });
    }

    const changePasswordModalEl = document.getElementById('changePasswordModal');
    if (changePasswordModalEl) {
      this.modals.changePassword = window.bootstrap.Modal.getOrCreateInstance(changePasswordModalEl);
      changePasswordModalEl.addEventListener('hidden.bs.modal', () => {
        this.passwordTargetUserId = null;
        this.clearPasswordForm();
      });
    }
  }

  setupEventListeners() {
    const searchInput = document.getElementById('searchUsers');
    if (searchInput) {
      this.handleSearchDebounced = debounce((value) => this.applyUserSearch(value), 200);
      searchInput.addEventListener('input', (event) => this.handleSearchDebounced(event.target.value));
    }

    const addUserBtn = document.getElementById('addUserBtn');
    if (addUserBtn) {
      addUserBtn.addEventListener('click', () => this.openCreateUserModal());
    }

    const saveUserBtn = document.getElementById('saveUserBtn');
    if (saveUserBtn) {
      saveUserBtn.addEventListener('click', () => this.handleSaveUser());
    }

    const usersTable = document.getElementById('usersTable');
    if (usersTable) {
      usersTable.addEventListener('click', (event) => this.handleUsersTableClick(event));
      usersTable.addEventListener('change', (event) => this.handleUsersTableChange(event));
    }

    const userSelect = document.getElementById('userSelect');
    if (userSelect) {
      userSelect.addEventListener('change', (event) => this.selectUser(event.target.value, { scrollIntoView: true }));
    }

    const roleSelect = document.getElementById('roleSelect');
    if (roleSelect) {
      roleSelect.addEventListener('change', (event) => this.handleRoleChange(event.target.value));
    }

    if (this.forms.permission) {
      this.forms.permission.addEventListener('submit', (event) => {
        event.preventDefault();
        this.handlePermissionsSave();
      });
    }

    const permissionsList = document.getElementById('permissionsList');
    if (permissionsList) {
      permissionsList.addEventListener('change', (event) => {
        if (event.target.matches('.permission-checkbox')) {
          this.updatePermissionPreview(this.getPermissionsFromForm());
        }
      });
    }

    const selectAll = document.getElementById('selectAll');
    if (selectAll) {
      selectAll.addEventListener('change', (event) => this.handleSelectAllChange(event.target.checked));
    }

    const refreshBtn = document.getElementById('refreshPermissions');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => this.loadInitialData({ keepSelection: true }));
    }

    const exportBtn = document.getElementById('exportPermissions');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => this.handleExportPermissions());
    }

    const importBtn = document.getElementById('importPermissions');
    if (importBtn) {
      importBtn.addEventListener('click', () => this.handleImportPermissions());
    }

    const addRoleBtn = document.getElementById('addRoleBtn');
    if (addRoleBtn) {
      addRoleBtn.addEventListener('click', () => {
        showNotification('La creación de roles desde la interfaz estará disponible próximamente.', 'info');
      });
    }

    const changePasswordBtn = document.getElementById('confirmPasswordChangeBtn');
    if (changePasswordBtn) {
      changePasswordBtn.addEventListener('click', () => this.handlePasswordChange());
    }

    const templatesContainer = document.querySelector('.permission-templates');
    if (templatesContainer) {
      templatesContainer.addEventListener('click', (event) => {
        const item = event.target.closest('.template-item');
        if (!item) return;
        this.applyPermissionTemplate(item.dataset.template);
      });
    }
  }

  async loadInitialData({ keepSelection = false } = {}) {
    if (this.loadingInitialData) {
      return;
    }

    this.loadingInitialData = true;
    const previousUserId = keepSelection ? this.selectedUserId : null;
    this.setTableLoading(true);

    try {
      const [usersRes, rolesRes, catalogRes, templatesRes] = await Promise.all([
        apiGetUsers().catch((error) => ({ success: false, users: [], error })),
        apiGetRoles().catch((error) => ({ success: false, roles: [], error })),
        apiGetPermissionCatalog().catch((error) => ({ success: false, catalog: [], error })),
        apiGetRolePermissionTemplates().catch((error) => ({ success: false, templates: {}, error }))
      ]);

      this.users = this.normalizeUsers(usersRes?.users || []);
      this.roles = this.normalizeRoles(rolesRes?.roles || []);
      const catalogSource = catalogRes?.catalog ?? catalogRes?.modules ?? catalogRes;
      this.permissionCatalog = this.normalizePermissionCatalog(catalogSource);
      const templatesSource = templatesRes?.templates ?? templatesRes;
      this.permissionTemplates = this.normalizePermissionTemplates(templatesSource);
      this.buildPermissionLookup();

      this.filterUsers();
      this.renderUsersTable();
      this.renderUserSelect();
      this.renderRoleSelect();
      this.renderPermissionCatalog();
      this.renderRolesGrid();
      this.updateStats();

      if (!usersRes?.success) {
        console.warn('No se pudieron obtener los usuarios desde el backend', usersRes?.error);
        showNotification('No se pudieron obtener los usuarios. Verifica la API.', 'warning');
      }

      if (!rolesRes?.success) {
        console.warn('No se pudieron obtener los roles desde el backend', rolesRes?.error);
        showNotification('No se pudieron obtener los roles. Verifica la API.', 'warning');
      }

      if (!catalogRes?.success && this.permissionCatalog.length === 0) {
        console.warn('Catálogo de permisos no disponible', catalogRes?.error);
      }

      if (!templatesRes?.success) {
        console.warn('Plantillas de permisos no disponibles', templatesRes?.error);
      }

      const initialUserId = this.resolveInitialUserId(previousUserId);
      if (initialUserId) {
        await this.selectUser(initialUserId);
      } else {
        this.resetPermissionForm();
      }
    } catch (error) {
      console.error('Error al cargar los datos de permisos:', error);
      showNotification('Error al cargar los datos desde el servidor', 'error');
      this.users = [];
      this.filteredUsers = [];
      this.renderUsersTable();
      this.renderUserSelect();
      this.updateStats();
      this.resetPermissionForm();
    } finally {
      this.setTableLoading(false);
      this.loadingInitialData = false;
    }
  }

  setTableLoading(isLoading) {
    const tableBody = document.getElementById('usersTable');
    if (!tableBody) return;

    if (isLoading) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="7" class="text-center py-5">
            <div class="spinner-border text-primary" role="status">
              <span class="visually-hidden">Cargando...</span>
            </div>
          </td>
        </tr>
      `;
    }
  }

  renderUsersTable() {
    const tableBody = document.getElementById('usersTable');
    const emptyState = document.getElementById('usersEmptyState');
    const showingCount = document.getElementById('showingUsersCount');
    const totalCount = document.getElementById('totalUsersCount');

    if (!tableBody) {
      return;
    }

    const validSelections = new Set();
    this.filteredUsers.forEach((user) => {
      if (this.tableSelection.has(user.id)) {
        validSelections.add(user.id);
      }
    });
    this.tableSelection = validSelections;

    if (this.filteredUsers.length === 0) {
      tableBody.innerHTML = '';
      emptyState?.classList.remove('d-none');
    } else {
      emptyState?.classList.add('d-none');
      tableBody.innerHTML = this.filteredUsers.map((user) => this.renderUserRow(user)).join('');
    }

    if (showingCount) {
      showingCount.textContent = this.filteredUsers.length;
    }
    if (totalCount) {
      totalCount.textContent = this.users.length;
    }

    this.syncSelectAllCheckbox();
    this.highlightSelectedRow(this.selectedUserId);
  }

  renderUserRow(user) {
    const isSelected = user.id === this.selectedUserId;
    const roleLabel = this.getRoleDisplayName(user.role);
    const statusBadge = this.getStatusBadge(user.status);
    const lastLoginLabel = user.lastLogin
      ? `${formatDate(user.lastLogin)} · ${formatRelativeTime(user.lastLogin)}`
      : '—';

    return `
      <tr data-user-id="${user.id}" class="${isSelected ? 'table-active' : ''}">
        <td>
          <input type="checkbox" class="form-check-input user-row-checkbox" data-user-id="${user.id}" ${
            this.tableSelection.has(user.id) ? 'checked' : ''
          }>
        </td>
        <td>
          <div class="d-flex align-items-center gap-2">
            <div class="avatar bg-light rounded-circle d-flex align-items-center justify-content-center">
              <i class="bi bi-person"></i>
            </div>
            <div>
              <div class="fw-semibold text-gray-800">${user.name || user.username}</div>
              <div class="text-muted small">@${user.username || 'sin-usuario'}</div>
            </div>
          </div>
        </td>
        <td>${user.email || '—'}</td>
        <td><span class="badge bg-light text-dark fw-semibold">${roleLabel}</span></td>
        <td>${statusBadge}</td>
        <td class="text-muted small">${lastLoginLabel}</td>
        <td class="user-actions-column">
          <div class="user-row-actions">
            <button class="btn btn-outline-primary btn-sm" data-action="assign" data-user-id="${user.id}" title="Asignar permisos">
              <i class="bi bi-shield-check"></i>
            </button>
            <button class="btn btn-outline-secondary btn-sm" data-action="edit" data-user-id="${user.id}" title="Editar usuario">
              <i class="bi bi-pencil"></i>
            </button>
            <button class="btn btn-outline-warning btn-sm" data-action="password" data-user-id="${user.id}" title="Cambiar contraseña">
              <i class="bi bi-key"></i>
            </button>
            <button class="btn btn-outline-danger btn-sm" data-action="delete" data-user-id="${user.id}" title="Eliminar usuario">
              <i class="bi bi-trash"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  }

  getRoleDisplayName(roleId) {
    if (!roleId) {
      return 'Sin rol';
    }
    const match = this.roles.find((role) => String(role.id) === String(roleId));
    return match?.name || this.formatModuleName(roleId);
  }

  getStatusBadge(status) {
    const normalized = (status || '').toLowerCase();
    if (['inactive', 'inactivo', 'disabled', 'suspended'].includes(normalized)) {
      return '<span class="badge bg-secondary">Inactivo</span>';
    }
    return '<span class="badge bg-success">Activo</span>';
  }

  renderUserSelect() {
    const userSelect = document.getElementById('userSelect');
    if (!userSelect) {
      return;
    }

    if (this.users.length === 0) {
      userSelect.innerHTML = '<option value="">No hay usuarios disponibles</option>';
      return;
    }

    userSelect.innerHTML = `
      <option value="">Seleccionar usuario...</option>
      ${this.users
        .map(
          (user) => `
            <option value="${user.id}">
              ${user.name || user.username} (${user.email || user.username})
            </option>
          `
        )
        .join('')}
    `;

    if (this.selectedUserId) {
      userSelect.value = this.selectedUserId;
    }
  }

  renderRoleSelect() {
    const roleSelect = document.getElementById('roleSelect');
    const userRoleSelect = document.getElementById('userRole');

    const options = this.roles.length
      ? `<option value="">Seleccionar rol...</option>${this.roles
          .map((role) => `<option value="${role.id}">${role.name}</option>`)
          .join('')}`
      : '<option value="">No hay roles disponibles</option>';

    if (roleSelect) {
      roleSelect.innerHTML = options;
      if (this.selectedUserId) {
        roleSelect.value = this.currentUser?.role || '';
      }
    }

    if (userRoleSelect) {
      userRoleSelect.innerHTML = options;
    }
  }

  renderPermissionCatalog() {
    const list = document.getElementById('permissionsList');
    if (!list) {
      return;
    }

    if (this.permissionCatalog.length === 0) {
      list.innerHTML = `
        <div class="alert alert-light border text-muted">
          No se pudo obtener el catálogo de permisos desde la API. Intenta nuevamente más tarde.
        </div>
      `;
      return;
    }

    list.innerHTML = this.permissionCatalog
      .map(
        (module) => `
          <div class="permission-module mb-4" data-module="${module.id}">
            <div class="d-flex align-items-center justify-content-between mb-2">
              <h6 class="text-gray-700 mb-0">
                <i class="bi bi-folder-check me-2"></i>${module.label}
              </h6>
              <button type="button" class="btn btn-sm btn-outline-primary" data-module-toggle="${module.id}">
                Alternar módulo
              </button>
            </div>
            <div class="module-permissions row g-2">
              ${module.permissions.map((permission) => this.renderPermissionCheckbox(permission)).join('')}
            </div>
          </div>
        `
      )
      .join('');

    list.querySelectorAll('[data-module-toggle]').forEach((button) => {
      button.addEventListener('click', () => this.toggleModulePermissions(button.dataset.moduleToggle));
    });

    this.updatePermissionPreview(this.getPermissionsFromForm());
  }

  renderPermissionCheckbox(permission) {
    const checkboxId = this.buildPermissionDomId(permission.id);
    return `
      <div class="col-12">
        <div class="form-check modern-permission-option">
          <input class="form-check-input permission-checkbox" type="checkbox" value="${permission.id}" id="${checkboxId}">
          <label class="form-check-label" for="${checkboxId}">
            <span class="fw-semibold">${permission.label}</span>
            ${permission.description ? `<small class="text-muted d-block">${permission.description}</small>` : ''}
          </label>
        </div>
      </div>
    `;
  }

  buildPermissionDomId(permissionId) {
    return `perm-${String(permissionId).replace(/[^a-zA-Z0-9_-]/g, '-')}`;
  }

  renderRolesGrid() {
    const grid = document.getElementById('rolesGrid');
    if (!grid) {
      return;
    }

    if (this.roles.length === 0) {
      grid.innerHTML = `
        <div class="alert alert-light border text-muted">
          No hay roles configurados. Crea roles desde el backend para gestionarlos aquí.
        </div>
      `;
      return;
    }

    grid.innerHTML = this.roles
      .map((role) => {
        const templateKey = String(role.id).toLowerCase();
        const templatePermissions = this.permissionTemplates?.[templateKey] || [];
        const samplePermissions = templatePermissions
          .slice(0, 4)
          .map((permissionId) => {
            const label = this.permissionLookup.get(String(permissionId))?.label || this.formatPermissionName(permissionId);
            return `<span class="badge bg-light text-dark border">${label}</span>`;
          })
          .join('');
        const extra = templatePermissions.length > 4
          ? `<span class="badge bg-light text-muted border">+${templatePermissions.length - 4}</span>`
          : '';

        return `
          <div class="role-card card-modern p-3" data-role-id="${role.id}">
            <h6 class="mb-1">${role.name}</h6>
            <p class="text-muted small mb-2">${role.description || 'Sin descripción'}</p>
            <div class="d-flex flex-wrap gap-2 mb-2">
              ${samplePermissions}${extra}
            </div>
            <div class="d-flex justify-content-between align-items-center">
              <span class="badge bg-primary-subtle text-primary">${role.permissions?.length || 0} permisos</span>
              <button class="btn btn-sm btn-outline-primary" data-role-template="${role.id}">Aplicar</button>
            </div>
          </div>
        `;
      })
      .join('');

    grid.querySelectorAll('[data-role-template]').forEach((button) => {
      button.addEventListener('click', (event) => {
        const roleId = event.currentTarget.dataset.roleTemplate;
        this.applyPermissionTemplate(roleId);
      });
    });
  }

  updateStats() {
    const usersCount = document.getElementById('usersCount');
    const rolesCount = document.getElementById('rolesCount');
    const permissionsCount = document.getElementById('permissionsCount');

    if (usersCount) {
      usersCount.textContent = this.users.length;
    }
    if (rolesCount) {
      rolesCount.textContent = this.roles.length;
    }
    if (permissionsCount) {
      permissionsCount.textContent = this.getTotalPermissionsCount();
    }
  }

  getTotalPermissionsCount() {
    const unique = new Set();
    this.permissionCatalog.forEach((module) => {
      module.permissions.forEach((permission) => unique.add(String(permission.id)));
    });
    return unique.size;
  }

  filterUsers() {
    if (!this.searchQuery) {
      this.filteredUsers = [...this.users];
      return;
    }

    const query = this.searchQuery.toLowerCase();
    this.filteredUsers = this.users.filter((user) => {
      return [user.name, user.username, user.email, this.getRoleDisplayName(user.role)]
        .filter(Boolean)
        .some((field) => field.toLowerCase().includes(query));
    });
  }

  applyUserSearch(value) {
    this.searchQuery = (value || '').trim();
    this.filterUsers();
    this.renderUsersTable();
  }

  async selectUser(userId, { scrollIntoView = false } = {}) {
    if (!userId) {
      this.currentUser = null;
      this.selectedUserId = null;
      this.resetPermissionForm();
      return;
    }

    const user = this.users.find((item) => item.id === userId);
    if (!user) {
      showNotification('Usuario no encontrado en la lista actual.', 'warning');
      return;
    }

    this.currentUser = user;
    this.selectedUserId = userId;

    this.setSelectValue('userSelect', userId);
    this.setSelectValue('roleSelect', user.role || '');
    this.highlightSelectedRow(userId);

    await this.loadUserPermissions(userId);

    if (scrollIntoView) {
      const row = Array.from(document.querySelectorAll('tr[data-user-id]')).find((element) => element.dataset.userId === userId);
      row?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  setSelectValue(selectId, value) {
    const select = document.getElementById(selectId);
    if (select) {
      select.value = value ?? '';
    }
  }

  highlightSelectedRow(userId) {
    document.querySelectorAll('tr[data-user-id]').forEach((row) => {
      row.classList.toggle('table-active', row.dataset.userId === userId);
    });
  }

  async loadUserPermissions(userId) {
    try {
      this.showPermissionsLoading(true);
      const response = await apiGetUserPermissions(userId);
      const permissions = Array.isArray(response?.permissions)
        ? response.permissions
        : Array.isArray(response)
          ? response
          : [];
      this.updatePermissionsDisplay(permissions.map(String));
    } catch (error) {
      console.error('Error obteniendo permisos del usuario:', error);
      showNotification('No se pudieron cargar los permisos del usuario.', 'error');
      this.updatePermissionsDisplay([]);
    } finally {
      this.showPermissionsLoading(false);
    }
  }

  showPermissionsLoading(isLoading) {
    const saveBtn = document.getElementById('savePermissionsBtn');
    if (!saveBtn) return;

    if (isLoading) {
      saveBtn.disabled = true;
      saveBtn.dataset.originalText = saveBtn.dataset.originalText || saveBtn.innerHTML;
      saveBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>Procesando...';
    } else {
      saveBtn.disabled = false;
      if (saveBtn.dataset.originalText) {
        saveBtn.innerHTML = saveBtn.dataset.originalText;
      }
    }
  }

  updatePermissionsDisplay(permissions) {
    const permissionsSet = new Set((permissions || []).map(String));
    document.querySelectorAll('.permission-checkbox').forEach((checkbox) => {
      checkbox.checked = permissionsSet.has(checkbox.value);
    });
    this.updatePermissionPreview([...permissionsSet]);
  }

  updatePermissionPreview(permissionIds) {
    const preview = document.getElementById('permissionPreview');
    if (!preview) return;
    const content = preview.querySelector('.preview-content');
    if (!content) return;

    if (!permissionIds || permissionIds.length === 0) {
      preview.style.display = 'none';
      content.innerHTML = '';
      return;
    }

    const chips = permissionIds
      .map((permissionId) => {
        const label = this.permissionLookup.get(String(permissionId))?.label || this.formatPermissionName(permissionId);
        return `<span class="badge bg-light text-dark border">${label}</span>`;
      })
      .join('');

    content.innerHTML = `<div class="d-flex flex-wrap gap-2">${chips}</div>`;
    preview.style.display = '';
  }

  resetPermissionForm() {
    document.querySelectorAll('.permission-checkbox').forEach((checkbox) => {
      checkbox.checked = false;
    });
    this.updatePermissionPreview([]);
    this.setSelectValue('roleSelect', '');
    this.setSelectValue('userSelect', '');
  }

  getPermissionsFromForm() {
    return Array.from(document.querySelectorAll('.permission-checkbox:checked')).map((checkbox) => checkbox.value);
  }

  toggleModulePermissions(moduleId) {
    if (!moduleId) return;
    const module = this.permissionCatalog.find((item) => String(item.id) === String(moduleId));
    if (!module) return;

    const currentPermissions = new Set(this.getPermissionsFromForm().map(String));
    const modulePermissionIds = module.permissions.map((permission) => String(permission.id));
    const hasUnchecked = modulePermissionIds.some((id) => !currentPermissions.has(id));

    document.querySelectorAll('.permission-checkbox').forEach((checkbox) => {
      if (modulePermissionIds.includes(checkbox.value)) {
        checkbox.checked = hasUnchecked;
      }
    });

    this.updatePermissionPreview(this.getPermissionsFromForm());
  }

  async handlePermissionsSave() {
    if (!this.currentUser) {
      showNotification('Selecciona un usuario antes de guardar los permisos.', 'warning');
      return;
    }

    const validation = this.validators.permission?.validate();
    if (validation && !validation.isValid) {
      showNotification('Revisa los campos marcados en el formulario.', 'warning');
      return;
    }

    const selectedPermissions = this.getPermissionsFromForm();

    try {
      this.showPermissionsLoading(true);
      const response = await apiSetUserPermissions(this.currentUser.id, selectedPermissions);
      if (response?.success === false) {
        throw new Error(response.error || 'Respuesta inválida del servidor');
      }
      showNotification('Permisos guardados correctamente.', 'success');
    } catch (error) {
      console.error('Error guardando permisos:', error);
      showNotification('Error al guardar los permisos del usuario.', 'error');
    } finally {
      this.showPermissionsLoading(false);
    }
  }

  async handleRoleChange(roleId, { skipApi = false } = {}) {
    if (!this.currentUser) {
      showNotification('Selecciona un usuario para actualizar su rol.', 'warning');
      return;
    }

    if (!roleId) {
      return;
    }

    if (skipApi) {
      this.currentUser.role = roleId;
      this.applyRoleTemplateIfAvailable(roleId, { silent: true });
      return;
    }

    const previousRole = this.currentUser.role;
    try {
      const response = await apiSetUserRole(this.currentUser.id, roleId);
      if (response?.success === false) {
        throw new Error(response.error || 'Respuesta inválida del servidor');
      }
      this.currentUser.role = roleId;
      this.applyRoleTemplateIfAvailable(roleId);
      showNotification('Rol actualizado correctamente.', 'success');
      this.renderUsersTable();
      this.renderUserSelect();
    } catch (error) {
      console.error('Error actualizando el rol:', error);
      showNotification('No se pudo actualizar el rol del usuario.', 'error');
      this.currentUser.role = previousRole;
      this.setSelectValue('roleSelect', previousRole);
    }
  }

  applyRoleTemplateIfAvailable(roleId, { silent = false } = {}) {
    if (!roleId) return;
    const template = this.permissionTemplates?.[String(roleId).toLowerCase()];
    if (!Array.isArray(template) || template.length === 0) {
      return;
    }

    const permissionsSet = new Set(template.map(String));
    document.querySelectorAll('.permission-checkbox').forEach((checkbox) => {
      checkbox.checked = permissionsSet.has(checkbox.value);
    });
    this.updatePermissionPreview([...permissionsSet]);

    if (!silent) {
      showNotification('Permisos base del rol aplicados como plantilla.', 'info');
    }
  }

  applyPermissionTemplate(templateKey) {
    if (!templateKey) {
      return;
    }

    const normalizedKey = String(templateKey).toLowerCase();
    const template = this.permissionTemplates?.[normalizedKey] || this.permissionTemplates?.[templateKey];

    if (!Array.isArray(template) || template.length === 0) {
      showNotification('No hay permisos asociados a esta plantilla.', 'warning');
      return;
    }

    const permissionsSet = new Set(template.map(String));
    document.querySelectorAll('.permission-checkbox').forEach((checkbox) => {
      checkbox.checked = permissionsSet.has(checkbox.value);
    });
    this.updatePermissionPreview([...permissionsSet]);
    showNotification('Plantilla de permisos aplicada. Guarda los cambios para confirmar.', 'success');
  }

  handleUsersTableClick(event) {
    const actionButton = event.target.closest('[data-action]');
    if (actionButton) {
      const userId = actionButton.dataset.userId;
      const action = actionButton.dataset.action;

      switch (action) {
        case 'assign':
          this.selectUser(userId, { scrollIntoView: false });
          break;
        case 'edit':
          this.openEditUserModal(userId);
          break;
        case 'password':
          this.openChangePasswordModal(userId);
          break;
        case 'delete':
          this.handleDeleteUser(userId);
          break;
        default:
          break;
      }
      return;
    }

    const row = event.target.closest('tr[data-user-id]');
    if (row && !event.target.closest('input[type="checkbox"]')) {
      this.selectUser(row.dataset.userId, { scrollIntoView: false });
    }
  }

  handleUsersTableChange(event) {
    if (!event.target.matches('.user-row-checkbox')) {
      return;
    }

    const userId = event.target.dataset.userId;
    if (event.target.checked) {
      this.tableSelection.add(userId);
    } else {
      this.tableSelection.delete(userId);
    }
    this.syncSelectAllCheckbox();
  }

  handleSelectAllChange(checked) {
    const checkboxes = document.querySelectorAll('.user-row-checkbox');
    if (checkboxes.length === 0) {
      return;
    }

    checkboxes.forEach((checkbox) => {
      checkbox.checked = checked;
      if (checked) {
        this.tableSelection.add(checkbox.dataset.userId);
      } else {
        this.tableSelection.delete(checkbox.dataset.userId);
      }
    });

    this.syncSelectAllCheckbox();
  }

  syncSelectAllCheckbox() {
    const selectAll = document.getElementById('selectAll');
    if (!selectAll) {
      return;
    }

    const checkboxes = Array.from(document.querySelectorAll('.user-row-checkbox'));
    if (checkboxes.length === 0) {
      selectAll.checked = false;
      selectAll.indeterminate = false;
      return;
    }

    const checkedCount = checkboxes.filter((checkbox) => checkbox.checked).length;
    selectAll.checked = checkedCount === checkboxes.length;
    selectAll.indeterminate = checkedCount > 0 && checkedCount < checkboxes.length;
  }

  async handleSaveUser() {
    if (!this.forms.addUser) {
      return;
    }

    const validation = this.validators.user?.validate();
    if (validation && !validation.isValid) {
      showNotification('Revisa los campos marcados en el formulario.', 'warning');
      return;
    }

    const username = document.getElementById('userName')?.value.trim();
    const email = document.getElementById('userEmail')?.value.trim();
    const password = document.getElementById('userPassword')?.value.trim();
    const confirmPassword = document.getElementById('userConfirmPassword')?.value.trim();
    const role = document.getElementById('userRole')?.value;
    const status = document.getElementById('userStatus')?.value || 'active';

    if (!username || !email || !role) {
      showNotification('Completa los campos obligatorios.', 'warning');
      return;
    }

    if (!this.editingUserId && (!password || password.length < 8)) {
      showNotification('La contraseña debe tener al menos 8 caracteres.', 'warning');
      return;
    }

    if (password && password !== confirmPassword) {
      showNotification('Las contraseñas no coinciden.', 'warning');
      return;
    }

    const payload = {
      username,
      name: username,
      email,
      role,
      status,
      active: status !== 'inactive'
    };

    if (password) {
      payload.password = password;
    }

    try {
      let response;
      if (this.editingUserId) {
        response = await apiUpdateUser(this.editingUserId, payload);
      } else {
        response = await apiCreateUser(payload);
      }

      if (response?.success === false) {
        throw new Error(response.error || 'Respuesta inválida del servidor');
      }

      const message = this.editingUserId
        ? 'Usuario actualizado correctamente.'
        : 'Usuario creado exitosamente.';
      showNotification(message, 'success');

      const targetUserId = this.editingUserId || response?.user?.id || response?.user?._id || null;
      this.modals.addUser?.hide();
      await this.fetchUsers({ selectUserId: targetUserId });
    } catch (error) {
      console.error('Error guardando usuario:', error);
      showNotification('No se pudo guardar el usuario. Revisa los detalles en la consola.', 'error');
    }
  }

  async fetchUsers({ selectUserId = null } = {}) {
    try {
      const response = await apiGetUsers();
      this.users = this.normalizeUsers(response?.users || []);
      this.filterUsers();
      this.renderUsersTable();
      this.renderUserSelect();
      this.updateStats();

      const nextUserId = selectUserId && this.users.some((user) => user.id === String(selectUserId))
        ? String(selectUserId)
        : this.selectedUserId && this.users.some((user) => user.id === this.selectedUserId)
          ? this.selectedUserId
          : this.users[0]?.id;

      if (nextUserId) {
        await this.selectUser(nextUserId);
      } else {
        this.selectedUserId = null;
        this.currentUser = null;
        this.resetPermissionForm();
      }
    } catch (error) {
      console.error('Error actualizando la lista de usuarios:', error);
      showNotification('No se pudieron actualizar los usuarios desde la API.', 'error');
    }
  }

  openCreateUserModal() {
    this.editingUserId = null;
    const modalTitle = document.querySelector('#addUserModal .modal-title');
    if (modalTitle) {
      modalTitle.textContent = 'Agregar Nuevo Usuario';
    }
    this.clearAddUserForm();
    this.modals.addUser?.show();
  }

  openEditUserModal(userId) {
    const user = this.users.find((item) => item.id === userId);
    if (!user) {
      showNotification('No encontramos los datos del usuario seleccionado.', 'warning');
      return;
    }

    this.editingUserId = userId;
    const modalTitle = document.querySelector('#addUserModal .modal-title');
    if (modalTitle) {
      modalTitle.textContent = 'Editar Usuario';
    }

    this.clearAddUserForm();
    document.getElementById('userName').value = user.name || user.username || '';
    document.getElementById('userEmail').value = user.email || '';
    document.getElementById('userPassword').value = '';
    document.getElementById('userConfirmPassword').value = '';
    document.getElementById('userRole').value = user.role || '';
    document.getElementById('userStatus').value = user.status === 'inactive' ? 'inactive' : 'active';

    this.modals.addUser?.show();
  }

  clearAddUserForm() {
    if (!this.forms.addUser) return;
    this.forms.addUser.reset();
    this.validators.user?.clearAllErrors();
  }

  openChangePasswordModal(userId) {
    this.passwordTargetUserId = userId;
    this.clearPasswordForm();
    this.modals.changePassword?.show();
  }

  clearPasswordForm() {
    if (!this.forms.changePassword) return;
    this.forms.changePassword.reset();
    this.validators.password?.clearAllErrors();
  }

  async handlePasswordChange() {
    if (!this.passwordTargetUserId) {
      showNotification('Selecciona un usuario para actualizar su contraseña.', 'warning');
      return;
    }

    const validation = this.validators.password?.validate();
    if (validation && !validation.isValid) {
      showNotification('Revisa los campos de contraseña.', 'warning');
      return;
    }

    const newPassword = document.getElementById('newPassword')?.value.trim();
    const confirmPassword = document.getElementById('confirmNewPassword')?.value.trim();

    if (!newPassword) {
      showNotification('La nueva contraseña es obligatoria.', 'warning');
      return;
    }

    if (newPassword !== confirmPassword) {
      showNotification('Las contraseñas no coinciden.', 'warning');
      return;
    }

    try {
      const response = await apiResetUserPassword(this.passwordTargetUserId, newPassword);
      if (response?.success === false) {
        throw new Error(response.error || 'Respuesta inválida del servidor');
      }
      showNotification('Contraseña actualizada correctamente.', 'success');
      this.modals.changePassword?.hide();
    } catch (error) {
      console.error('Error actualizando contraseña:', error);
      showNotification('No se pudo actualizar la contraseña.', 'error');
    }
  }

  async handleDeleteUser(userId) {
    const user = this.users.find((item) => item.id === userId);
    if (!user) {
      showNotification('No se encontró el usuario que deseas eliminar.', 'warning');
      return;
    }

    const confirmed = window.confirm(`¿Eliminar al usuario ${user.name || user.username}? Esta acción no se puede deshacer.`);
    if (!confirmed) {
      return;
    }

    try {
      const response = await apiDeleteUser(userId);
      if (response?.success === false) {
        throw new Error(response.error || 'Respuesta inválida del servidor');
      }
      showNotification('Usuario eliminado correctamente.', 'success');

      const nextUserId = this.selectedUserId === userId ? null : this.selectedUserId;
      await this.fetchUsers({ selectUserId: nextUserId });
    } catch (error) {
      console.error('Error eliminando usuario:', error);
      showNotification('No se pudo eliminar el usuario.', 'error');
    }
  }

  handleImportPermissions() {
    if (!this.importInput) {
      this.importInput = document.createElement('input');
      this.importInput.type = 'file';
      this.importInput.accept = 'application/json';
      this.importInput.classList.add('d-none');
      this.importInput.addEventListener('change', async (event) => {
        const file = event.target.files?.[0];
        if (!file) {
          return;
        }

        try {
          const text = await file.text();
          const data = JSON.parse(text);
          const permissions = Array.isArray(data?.permissions) ? data.permissions.map(String) : [];
          if (permissions.length === 0) {
            showNotification('El archivo no contiene permisos válidos.', 'warning');
            return;
          }

          const permissionsSet = new Set(permissions);
          document.querySelectorAll('.permission-checkbox').forEach((checkbox) => {
            checkbox.checked = permissionsSet.has(checkbox.value);
          });
          this.updatePermissionPreview([...permissionsSet]);
          showNotification('Permisos importados. Guarda los cambios para aplicarlos.', 'info');
        } catch (error) {
          console.error('Error importando permisos:', error);
          showNotification('No se pudo importar el archivo de permisos.', 'error');
        } finally {
          event.target.value = '';
        }
      });
      document.body.appendChild(this.importInput);
    }

    this.importInput.click();
  }

  handleExportPermissions() {
    if (!this.currentUser) {
      showNotification('Selecciona un usuario para exportar sus permisos.', 'warning');
      return;
    }

    const payload = {
      userId: this.currentUser.id,
      username: this.currentUser.username,
      role: this.currentUser.role,
      permissions: this.getPermissionsFromForm()
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `permisos-${this.currentUser.username || this.currentUser.id}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showNotification('Permisos exportados en un archivo JSON.', 'success');
  }

  resolveInitialUserId(previousUserId) {
    if (previousUserId && this.users.some((user) => user.id === previousUserId)) {
      return previousUserId;
    }
    return this.users[0]?.id || null;
  }

  formatPermissionName(value) {
    if (!value) return '';
    return String(value)
      .replace(/[_\.]/g, ' ')
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  formatModuleName(value) {
    return this.formatPermissionName(value);
  }

  normalizeUsers(users) {
    if (!Array.isArray(users)) {
      return [];
    }

    return users.map((user, index) => {
      const id = user?.id || user?._id || user?.userId || user?.uuid || user?.email || `user-${index}`;
      const username = user?.username || user?.userName || user?.login || user?.email || `usuario${index}`;
      const name = user?.name || user?.fullName || user?.displayName || username;
      const email = user?.email || user?.contactEmail || user?.mail || '';
      const role = user?.role || (Array.isArray(user?.roles) ? user.roles[0] : '') || '';
      const status = typeof user?.status === 'string'
        ? user.status.toLowerCase()
        : user?.active === false ? 'inactive' : 'active';

      return {
        id: String(id),
        username: String(username),
        name: String(name),
        email: email ? String(email) : '',
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
          name: this.formatModuleName(role),
          description: '',
          permissions: []
        };
      }

      const id = role?.id || role?._id || role?.roleId || role?.key || role?.name || `role-${index}`;
      const permissions = Array.isArray(role?.permissions)
        ? role.permissions.map(String)
        : this.normalizePermissionEntries(role?.permissions || role?.scopes || role?.actions || [], id).map((item) => item.id);

      return {
        id: String(id),
        name: role?.name || role?.displayName || this.formatModuleName(id),
        description: role?.description || role?.details || '',
        permissions
      };
    });
  }

  normalizePermissionCatalog(raw) {
    if (!raw) {
      return [];
    }

    const modules = [];

    const pushModule = (moduleKey, label, permissions) => {
      if (!permissions || permissions.length === 0) {
        return;
      }
      modules.push({
        id: String(moduleKey),
        label: label || this.formatModuleName(moduleKey),
        permissions
      });
    };

    if (Array.isArray(raw)) {
      raw.forEach((entry, index) => {
        if (!entry) return;
        if (typeof entry === 'string') {
          pushModule('general', 'Permisos Generales', this.normalizePermissionEntries([entry], 'general'));
          return;
        }

        const moduleKey = entry.module || entry.key || entry.id || entry.name || `module-${index}`;
        const label = entry.name || entry.label || this.formatModuleName(moduleKey);
        const permissions = this.normalizePermissionEntries(
          entry.permissions ?? entry.actions ?? entry.scopes ?? entry.allowed ?? entry,
          moduleKey
        );
        pushModule(moduleKey, label, permissions);
      });
      return modules;
    }

    if (typeof raw === 'object') {
      Object.entries(raw).forEach(([moduleKey, descriptor]) => {
        if (!descriptor) return;
        if (Array.isArray(descriptor)) {
          pushModule(moduleKey, this.formatModuleName(moduleKey), this.normalizePermissionEntries(descriptor, moduleKey));
          return;
        }

        const label = descriptor.name || descriptor.label || this.formatModuleName(moduleKey);
        const permissions = this.normalizePermissionEntries(
          descriptor.permissions ?? descriptor.actions ?? descriptor.scopes ?? descriptor,
          moduleKey
        );
        pushModule(moduleKey, label, permissions);
      });
    }

    return modules;
  }

  normalizePermissionEntries(entries, moduleKey = 'general') {
    const result = [];

    if (!entries) {
      return result;
    }

    const addPermission = (id, label, description = '') => {
      if (!id) return;
      const normalizedId = String(id);
      result.push({
        id: normalizedId,
        label: label || this.formatPermissionName(normalizedId),
        description: description || ''
      });
    };

    if (Array.isArray(entries)) {
      entries.forEach((entry, index) => {
        if (!entry) return;
        if (typeof entry === 'string') {
          addPermission(entry, this.formatPermissionName(entry));
          return;
        }
        if (typeof entry === 'object') {
          const permId = entry.id || entry.permission || entry.code || entry.key || entry.name || `${moduleKey}-${index}`;
          const fullId = entry.fullName || entry.fullname || entry.identifier || entry.value || permId;
          addPermission(fullId, entry.name || entry.label || this.formatPermissionName(permId), entry.description || entry.details);
        }
      });
    } else if (typeof entries === 'object') {
      Object.entries(entries).forEach(([key, value]) => {
        if (value === false || value === null || value === undefined) {
          return;
        }
        if (Array.isArray(value)) {
          value.forEach((entry) => {
            if (!entry) return;
            if (typeof entry === 'string') {
              addPermission(entry, this.formatPermissionName(entry));
            } else if (typeof entry === 'object') {
              const permId = entry.id || entry.permission || entry.code || entry.key || entry.name || `${moduleKey}.${key}`;
              addPermission(permId, entry.name || entry.label || this.formatPermissionName(permId), entry.description || entry.details);
            }
          });
        } else if (typeof value === 'object') {
          const permId = value.id || value.permission || value.code || value.key || key;
          addPermission(permId, value.name || value.label || this.formatPermissionName(permId), value.description || value.details);
        } else if (value === true || value === 'true' || value === 1) {
          addPermission(`${moduleKey}.${key}`, this.formatPermissionName(key));
        } else if (typeof value === 'string') {
          addPermission(value.includes('.') ? value : `${moduleKey}.${value}`, this.formatPermissionName(value));
        }
      });
    } else if (typeof entries === 'string') {
      addPermission(entries, this.formatPermissionName(entries));
    }

    const seen = new Set();
    return result.filter((permission) => {
      if (seen.has(permission.id)) return false;
      seen.add(permission.id);
      return true;
    });
  }

  normalizePermissionTemplates(raw) {
    const templates = {};

    if (!raw) {
      return templates;
    }

    if (Array.isArray(raw)) {
      raw.forEach((template, index) => {
        if (!template) return;
        const key = template.id || template.key || template.role || template.name || `template-${index}`;
        const permissionsSource = template.permissions ?? template.scopes ?? template.allowed ?? template.values;
        templates[String(key).toLowerCase()] = this.normalizePermissionEntries(permissionsSource, key).map((item) => item.id);
      });
      return templates;
    }

    if (typeof raw === 'object') {
      Object.entries(raw).forEach(([key, value]) => {
        if (!value) return;
        if (Array.isArray(value)) {
          templates[String(key).toLowerCase()] = value.map(String);
        } else if (typeof value === 'object') {
          const permissionsSource = value.permissions ?? value.scopes ?? value.allowed ?? value;
          templates[String(key).toLowerCase()] = this.normalizePermissionEntries(permissionsSource, key).map((item) => item.id);
        }
      });
    }

    return templates;
  }

  buildPermissionLookup() {
    this.permissionLookup = new Map();
    this.permissionCatalog.forEach((module) => {
      module.permissions.forEach((permission) => {
        this.permissionLookup.set(String(permission.id), {
          label: permission.label || permission.name || permission.id,
          module: module.label,
          description: permission.description || ''
        });
      });
    });
  }
}

function bootstrapPermissionsController() {
  let permissionsController;
  document.addEventListener('DOMContentLoaded', () => {
    permissionsController = new PermissionsController();
    window.permissionsController = permissionsController;
  });
}

bootstrapPermissionsController();
import { initializeNavbar, showNotification, FormValidator } from '../../shared/utils/uiHelpers.js';
import { enforcePageAuth } from '../../shared/utils/authGuard.js';
import {
  apiGetUsers,
  apiGetRoles,
  apiGetUserPermissions,
  apiSetUserPermissions,
  apiSetUserRole
} from '../../shared/services/userService.js';

class PermissionsController {
  constructor() {
    if (!enforcePageAuth({
      message: 'Inicia sesión para administrar permisos y roles.'
    })) {
      return;
    }

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

