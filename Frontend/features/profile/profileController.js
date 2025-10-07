// Controller completo para gestión de perfiles de usuario
import { docuFlowAPI } from '../../shared/services/apiClient.js';
import { store } from '../../shared/services/store.js';
import { authService } from '../../shared/services/authService.js';
import { enforcePageAuth, setAuthRedirectContext } from '../../shared/utils/authGuard.js';
import { showNotification, showLoading, hideLoading } from '../../shared/utils/uiHelpers.js';

class ProfileController {
  constructor() {
    if (!enforcePageAuth({
      message: 'Inicia sesión para revisar tu perfil de DocuFlow.'
    })) {
      return;
    }

    this.currentUser = null;
    this.profileData = null;
    this.activityHistory = [];
    this.preferences = {};
    this.avatarFile = null;
    this.isEditing = false;
  this.statsLoaded = false;
    
    // Elementos del DOM
    this.profileForm = null;
    this.avatarPreview = null;
    this.avatarInput = null;
    this.activityContainer = null;
    this.preferencesForm = null;
    
    this.initializeController();
  }

  // Inicializar el controlador
  async initializeController() {
    try {
      await this.loadUserProfile();
      this.initializeEventListeners();
      this.setupAvatarUpload();
      await this.loadActivityHistory();
      await this.loadUserPreferences();
      this.initializeProfileTabs();
    } catch (error) {
      console.error('Error initializing profile controller:', error);
      showNotification('Error al cargar el perfil de usuario', 'error');
    }
  }

  // Cargar perfil del usuario actual
  async loadUserProfile({ forceRefresh = false, suppressLoader = false } = {}) {
    const loaderMessage = forceRefresh ? 'Actualizando perfil...' : 'Cargando perfil...';

    try {
      if (!suppressLoader) {
        showLoading(loaderMessage);
      }

  const response = await docuFlowAPI.profile.getCurrent({ showLoading: false });
      const payload = response?.data ?? response;

      if (response?.success === false && (!payload || Object.keys(payload).length === 0 || (!payload.user && !payload.username))) {
        throw new Error(response?.message || 'No se pudo obtener el perfil del usuario');
      }

      if (!payload) {
        throw new Error('Perfil no disponible');
      }

  this.profileData = this.normalizeProfileData(payload);
  this.preferences = this.normalizePreferences(this.profileData.preferences || this.preferences || {});
  this.profileData.preferences = this.preferences;
  this.statsLoaded = this.hasMeaningfulStats(this.profileData.stats);
  this.applyPreferences();
      this.currentUser = this.extractCurrentUser(this.profileData);

      if (this.currentUser) {
        try {
          localStorage.setItem('user', JSON.stringify(this.currentUser));
        } catch (storageError) {
          console.warn('No se pudo persistir el usuario actualizado:', storageError);
        }
        store.setUser(this.currentUser);
      }

      this.populateProfileForm();
      this.updateProfileDisplay();
      await this.ensureProfileStats(forceRefresh);

      return this.profileData;
    } catch (error) {
      console.error('Error loading user profile:', error);
      showNotification('Error al cargar el perfil', 'error');
      throw error;
    } finally {
      if (!suppressLoader) {
        hideLoading();
      }
    }
  }

  // Poblar formulario con datos del perfil
  populateProfileForm() {
    if (!this.profileData) return;

    const elements = {
      'profile-username': this.profileData.username,
      'profile-email': this.profileData.email,
      'profile-firstName': this.profileData.firstName || '',
      'profile-lastName': this.profileData.lastName || '',
      'profile-phone': this.profileData.phone || '',
      'profile-department': this.profileData.department || '',
      'profile-position': this.profileData.position || '',
      'profile-bio': this.profileData.bio || '',
      'profile-location': this.profileData.location || '',
      'profile-timezone': this.profileData.timezone || 'UTC-5'
    };

    Object.entries(elements).forEach(([id, value]) => {
      const element = document.getElementById(id);
      if (element) {
        element.value = value;
      }
    });

    // Actualizar avatar
    this.updateAvatarDisplay();
  }

  // Actualizar visualización del perfil
  updateProfileDisplay() {
    if (!this.profileData) return;

    const fullName = this.profileData.fullName || `${this.profileData.firstName || ''} ${this.profileData.lastName || ''}`.trim() || this.profileData.username || 'Usuario';
    const roleLabel = this.getRoleDisplayName(this.profileData.role);

    this.updateElementText('user-name-display', fullName);
    this.updateElementText('user-email-display', this.profileData.email || 'Sin correo');
    this.updateElementText('user-role-display', roleLabel);
    const roleBadge = document.getElementById('user-role-display');
    if (roleBadge) {
      roleBadge.dataset.role = (this.profileData.role || '').toString().toLowerCase();
    }
    this.updateElementText('user-department-display', this.profileData.department || 'Sin departamento');
    this.updateElementText('user-last-login', this.formatDateDisplayObject(this.profileData.lastLogin));
    this.updateElementText('user-member-since', this.formatDateDisplayObject(this.profileData.createdAt));
    this.updateElementText('stats-last-activity', this.formatDateDisplayObject(this.profileData.lastActivity || this.profileData.stats?.lastActivity));

    this.updateNavIdentity(fullName);
    this.updateAvatarDisplay();
    this.updateUserStats();
  }

  // Actualizar estadísticas del usuario
  updateUserStats() {
    if (!this.profileData) return;

    const stats = this.normalizeStats(this.profileData.stats || {});
    this.profileData.stats = stats;

    if (stats.lastActivity && !this.profileData.lastActivity) {
      this.profileData.lastActivity = stats.lastActivity;
    }

    const combinedInteractions = (stats.commentsMade || 0) + (stats.tasksCreated || 0) + (stats.tasksCompleted || 0);

    this.updateElementText('stats-files-uploaded', stats.filesUploaded ?? 0);
    this.updateElementText('stats-comments-made', combinedInteractions);
    this.updateElementText('stats-total-storage', this.formatFileSize(stats.totalStorageUsed || 0));
    this.updateElementText('stats-login-count', stats.loginCount ?? 0);
    this.updateElementText('stats-last-activity', this.formatDateDisplayObject(stats.lastActivity || this.profileData.lastActivity));
  }

  // Inicializar event listeners
  initializeEventListeners() {
    // Formulario de perfil
    this.profileForm = document.getElementById('profile-form');
    if (this.profileForm) {
      this.profileForm.addEventListener('submit', this.handleProfileUpdate.bind(this));
    }

    // Botones de acción
    const editBtn = document.getElementById('edit-profile-btn');
    if (editBtn) {
      editBtn.addEventListener('click', this.toggleEditMode.bind(this));
    }

    const cancelBtn = document.getElementById('cancel-edit-btn');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', this.cancelEdit.bind(this));
    }

    const changePasswordBtn = document.getElementById('change-password-btn');
    if (changePasswordBtn) {
      changePasswordBtn.addEventListener('click', this.showChangePasswordModal.bind(this));
    }

    const deleteAccountBtn = document.getElementById('delete-account-btn');
    if (deleteAccountBtn) {
      deleteAccountBtn.addEventListener('click', this.showDeleteAccountModal.bind(this));
    }

    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', (event) => this.handleProfileLogout(event));
    }

    const extraLogoutLinks = document.querySelectorAll('[data-nav-action="logout"], [data-action="logout"]');
    extraLogoutLinks.forEach(link => {
      link.addEventListener('click', (event) => this.handleProfileLogout(event));
    });

    // Formulario de preferencias
    this.preferencesForm = document.getElementById('preferences-form');
    if (this.preferencesForm) {
      this.preferencesForm.addEventListener('submit', this.handlePreferencesUpdate.bind(this));
    }

    // Formulario de cambio de contraseña
    const passwordForm = document.getElementById('change-password-form');
    if (passwordForm) {
      passwordForm.addEventListener('submit', this.handlePasswordChange.bind(this));
    }
  }

  async handleProfileLogout(event) {
    event?.preventDefault();
    try {
      showNotification('Cerrando sesión...', 'info', 1500);
      await authService.logout();

      setAuthRedirectContext({
        message: 'Tu sesión se cerró correctamente. Vuelve a iniciar sesión para continuar.',
        reason: 'manual_logout',
        redirectUrl: '../dashboard/dashboard.html'
      });

      setTimeout(() => {
        window.location.href = '../auth/access-portal.html';
      }, 600);
    } catch (error) {
      console.error('Error al cerrar sesión desde el perfil:', error);
      showNotification('No se pudo cerrar sesión. Intenta nuevamente.', 'error');
    }
  }

  // Configurar subida de avatar
  setupAvatarUpload() {
    this.avatarInput = document.getElementById('avatar-input');
    this.avatarPreview = document.getElementById('avatar-preview');
    
    if (this.avatarInput) {
      this.avatarInput.addEventListener('change', this.handleAvatarChange.bind(this));
    }

    const avatarUploadBtn = document.getElementById('avatar-upload-btn');
    if (avatarUploadBtn) {
      avatarUploadBtn.addEventListener('click', () => {
        this.avatarInput?.click();
      });
    }

    const removeAvatarBtn = document.getElementById('remove-avatar-btn');
    if (removeAvatarBtn) {
      removeAvatarBtn.addEventListener('click', this.removeAvatar.bind(this));
    }
  }

  // Manejar cambio de avatar
  async handleAvatarChange(event) {
    const file = event.target.files[0];
    if (!file) return;

    // Validar tipo de archivo
    if (!file.type.startsWith('image/')) {
      showNotification('Por favor selecciona un archivo de imagen válido', 'error');
      return;
    }

    // Validar tamaño (máximo 5MB)
    if (file.size > 5 * 1024 * 1024) {
      showNotification('La imagen debe ser menor a 5MB', 'error');
      return;
    }

    // Previsualizar imagen
    const reader = new FileReader();
    reader.onload = (e) => {
      if (this.avatarPreview) {
        this.avatarPreview.src = e.target.result;
      }
    };
    reader.readAsDataURL(file);

    // Guardar archivo para subir
    this.avatarFile = file;

    // Subir automáticamente
    await this.uploadAvatar();
  }

  // Subir avatar
  async uploadAvatar() {
    if (!this.avatarFile) return;

    try {
      showLoading('Subiendo avatar...');
      
      const response = await docuFlowAPI.profile.uploadAvatar(this.avatarFile);
      
      if (response.success) {
        this.profileData.avatarUrl = response.data.avatarUrl;
        this.updateAvatarDisplay();
        showNotification('Avatar actualizado exitosamente', 'success');
        this.avatarFile = null;
      }
    } catch (error) {
      console.error('Error uploading avatar:', error);
      showNotification('Error al subir el avatar', 'error');
    } finally {
      hideLoading();
    }
  }

  // Actualizar visualización del avatar
  updateAvatarDisplay() {
    const avatarElements = document.querySelectorAll('.user-avatar, #avatar-preview');
    const avatarUrl = this.profileData?.avatarUrl;
    const initials = this.getUserInitials();

    avatarElements.forEach(element => {
      const isLargeAvatar = element.classList.contains('user-avatar-large') || element.id === 'avatar-preview';

      if (!element.dataset.defaultAvatar) {
        element.dataset.defaultAvatar = element.getAttribute('data-default-avatar') || element.getAttribute('src') || '../../shared/assets/default-avatar.png';
      }

      const defaultSrc = element.dataset.defaultAvatar;
      const initialsElement = element.closest('.avatar-container')?.querySelector('.user-initials');

      if (avatarUrl) {
        element.src = avatarUrl;
        element.style.display = 'block';
        if (initialsElement) {
          initialsElement.style.display = 'none';
        }
      } else {
        if (isLargeAvatar) {
          element.style.display = 'none';
          if (initialsElement) {
            initialsElement.textContent = initials;
            initialsElement.style.display = 'flex';
          }
        } else {
          element.src = defaultSrc;
          element.style.display = 'block';
        }
      }
    });
  }

  // Obtener iniciales del usuario
  getUserInitials() {
    if (!this.profileData) return 'U';
    
    const firstName = this.profileData.firstName || '';
    const lastName = this.profileData.lastName || '';
    
    if (firstName && lastName) {
      return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
    } else if (firstName) {
      return firstName.charAt(0).toUpperCase();
    } else {
      return this.profileData.username?.charAt(0).toUpperCase() || 'U';
    }
  }

  // Remover avatar
  async removeAvatar() {
    try {
      showLoading('Removiendo avatar...');
      
      const response = await docuFlowAPI.profile.removeAvatar();
      
      if (response.success) {
        this.profileData.avatarUrl = null;
        this.updateAvatarDisplay();
        showNotification('Avatar removido exitosamente', 'success');
      }
    } catch (error) {
      console.error('Error removing avatar:', error);
      showNotification('Error al remover el avatar', 'error');
    } finally {
      hideLoading();
    }
  }

  // Alternar modo de edición
  toggleEditMode() {
    this.setEditMode(!this.isEditing);

    if (this.isEditing) {
      showNotification('Modo de edición activado', 'info');
    }
  }

  setEditMode(isEditing) {
    this.isEditing = Boolean(isEditing);

    const editableFields = document.querySelectorAll('.profile-field input, .profile-field textarea, .profile-field select');
    const editBtn = document.getElementById('edit-profile-btn');
    const cancelBtn = document.getElementById('cancel-edit-btn');
    const submitBtn = document.getElementById('save-profile-btn');

    editableFields.forEach(field => {
      field.disabled = !this.isEditing;
      if (!this.isEditing) {
        field.blur();
      }
    });

    if (editBtn) editBtn.style.display = this.isEditing ? 'none' : 'inline-block';
    if (cancelBtn) cancelBtn.style.display = this.isEditing ? 'inline-block' : 'none';
    if (submitBtn) submitBtn.style.display = this.isEditing ? 'inline-block' : 'none';
  }

  // Cancelar edición
  cancelEdit() {
    this.populateProfileForm(); // Restaurar datos originales
    this.setEditMode(false);
    showNotification('Cambios cancelados', 'info');
  }

  // Manejar actualización del perfil
  async handleProfileUpdate(event) {
    event.preventDefault();
    
    if (!this.isEditing) return;
    
    try {
      showLoading('Actualizando perfil...');
      
      const formData = new FormData(this.profileForm);
      const profileData = this.buildProfileUpdatePayload(formData);

      const response = await docuFlowAPI.profile.update(profileData);

      if (response?.success === false) {
        throw new Error(response?.message || 'No se pudo actualizar el perfil');
      }

      await this.loadUserProfile({ forceRefresh: true, suppressLoader: true });
      this.setEditMode(false);
      showNotification('Perfil actualizado exitosamente', 'success');
    } catch (error) {
      console.error('Error updating profile:', error);
      showNotification(error?.message || 'Error al actualizar el perfil', 'error');
    } finally {
      hideLoading();
    }
  }

  // Cargar historial de actividad
  async loadActivityHistory(forceRefresh = false) {
    try {
      if (!forceRefresh && Array.isArray(this.profileData?.activityHistory) && this.profileData.activityHistory.length) {
        this.activityHistory = this.profileData.activityHistory;
        this.renderActivityHistory();
        return;
      }

      const response = await docuFlowAPI.profile.getActivity({}, { showLoading: false });
      const activity = response?.data ?? response ?? [];

      this.activityHistory = Array.isArray(activity) ? activity : [];
      if (this.profileData) {
        this.profileData.activityHistory = this.activityHistory;
      }

      this.renderActivityHistory();
    } catch (error) {
      console.error('Error loading activity history:', error);
    }
  }

  // Renderizar historial de actividad
  renderActivityHistory() {
    this.activityContainer = document.getElementById('activity-history');
    if (!this.activityContainer) return;

    if (this.activityHistory.length === 0) {
      this.activityContainer.innerHTML = `
        <div class="text-center py-4">
          <i class="fas fa-history text-muted mb-3" style="font-size: 2rem;"></i>
          <p class="text-muted">No hay actividad reciente</p>
        </div>
      `;
      return;
    }

    const activitiesHTML = this.activityHistory.map(activity => `
      <div class="activity-item">
        <div class="activity-icon">
          <i class="fas ${this.getActivityIcon(activity.type)}"></i>
        </div>
        <div class="activity-content">
          <div class="activity-title">${activity.title}</div>
          <div class="activity-description">${activity.description}</div>
          <div class="activity-time">
            <i class="fas fa-clock"></i>
            ${this.formatRelativeTime(activity.timestamp)}
          </div>
        </div>
      </div>
    `).join('');

    this.activityContainer.innerHTML = activitiesHTML;
  }

  // Obtener icono para tipo de actividad
  getActivityIcon(type) {
    const icons = {
      login: 'fa-sign-in-alt',
      logout: 'fa-sign-out-alt',
      upload: 'fa-cloud-upload-alt',
      download: 'fa-cloud-download-alt',
      comment: 'fa-comment',
      profile_update: 'fa-user-edit',
      password_change: 'fa-key',
      file_delete: 'fa-trash',
      permission_change: 'fa-shield-alt'
    };
    
    return icons[type] || 'fa-circle';
  }

  // Cargar preferencias del usuario
  async loadUserPreferences(forceRefresh = false) {
    try {
      if (!forceRefresh && this.preferences && Object.keys(this.preferences).length > 0) {
        this.populatePreferencesForm();
        this.applyPreferences();
        return;
      }

      const response = await docuFlowAPI.profile.getPreferences({ showLoading: false });
      const preferences = response?.data ?? response ?? {};

      this.preferences = this.normalizePreferences(preferences, this.preferences);
      if (this.profileData) {
        this.profileData.preferences = this.preferences;
      }

      this.populatePreferencesForm();
      this.applyPreferences();
    } catch (error) {
      console.error('Error loading preferences:', error);
      if (this.preferences && Object.keys(this.preferences).length > 0) {
        this.populatePreferencesForm();
      }
    }
  }

  // Poblar formulario de preferencias
  populatePreferencesForm() {
    if (!this.preferences) return;

    const elements = {
      'pref-language': this.preferences.language || 'es',
      'pref-theme': this.preferences.theme || 'light',
      'pref-notifications': Boolean(this.preferences.emailNotifications),
      'pref-sound': Boolean(this.preferences.soundNotifications),
      'pref-auto-save': this.preferences.autoSave !== false,
      'pref-file-preview': this.preferences.filePreview !== false
    };

    Object.entries(elements).forEach(([id, value]) => {
      const element = document.getElementById(id);
      if (element) {
        if (element.type === 'checkbox') {
          element.checked = value;
        } else {
          element.value = value;
        }
      }
    });
  }

  // Manejar actualización de preferencias
  async handlePreferencesUpdate(event) {
    event.preventDefault();
    
    try {
      showLoading('Actualizando preferencias...');
      
      const formData = new FormData(this.preferencesForm);
      const preferences = {};

      const mapPreferenceKey = (rawKey) => {
        const normalized = rawKey.replace('pref-', '');
        const dictionary = {
          language: 'language',
          theme: 'theme',
          notifications: 'emailNotifications',
          sound: 'soundNotifications',
          'auto-save': 'autoSave',
          'file-preview': 'filePreview'
        };
        return dictionary[normalized] || normalized;
      };

      for (const [key, value] of formData.entries()) {
        const mappedKey = mapPreferenceKey(key);
        if (['emailNotifications', 'soundNotifications', 'autoSave', 'filePreview'].includes(mappedKey)) {
          continue;
        }
        preferences[mappedKey] = typeof value === 'string' ? value.trim() : value;
      }

      const checkboxes = this.preferencesForm.querySelectorAll('input[type="checkbox"]');
      checkboxes.forEach(checkbox => {
        const mappedKey = mapPreferenceKey(checkbox.id);
        preferences[mappedKey] = checkbox.checked;
      });
      
      const response = await docuFlowAPI.profile.updatePreferences(preferences);
      
      if (response?.success === false) {
        throw new Error(response?.message || 'No se pudieron actualizar las preferencias');
      }

      this.preferences = this.normalizePreferences({ ...this.preferences, ...preferences });
      if (this.profileData) {
        this.profileData.preferences = this.preferences;
      }

      showNotification('Preferencias actualizadas exitosamente', 'success');
      
      // Aplicar cambios inmediatamente
      this.applyPreferences();
    } catch (error) {
      console.error('Error updating preferences:', error);
      showNotification('Error al actualizar las preferencias', 'error');
    } finally {
      hideLoading();
    }
  }

  // Aplicar preferencias
  applyPreferences() {
    // Aplicar tema
    if (this.preferences.theme) {
      document.documentElement.setAttribute('data-theme', this.preferences.theme);
    }
    
    if (this.preferences.language) {
      document.documentElement.setAttribute('lang', this.preferences.language);
    }
    
    // Aplicar configuración de notificaciones
    if (window.notificationController) {
      window.notificationController.setSoundEnabled(this.preferences.soundNotifications);
    }

    if (store?.setPreference) {
      store.setPreference('autoSave', this.preferences.autoSave !== false);
      store.setPreference('filePreview', this.preferences.filePreview !== false);
      if (this.preferences.timezone) {
        store.setPreference('timezone', this.preferences.timezone);
      }
    }
    
    // Guardar en localStorage para persistencia
    localStorage.setItem('userPreferences', JSON.stringify(this.preferences));
  }

  // Mostrar modal de cambio de contraseña
  showChangePasswordModal() {
    const modal = document.getElementById('change-password-modal');
    if (modal) {
      const bootstrapModal = new bootstrap.Modal(modal);
      bootstrapModal.show();
    }
  }

  // Manejar cambio de contraseña
  async handlePasswordChange(event) {
    event.preventDefault();
    
    const form = event.target;
    const formData = new FormData(form);
    
    const currentPassword = formData.get('current-password');
    const newPassword = formData.get('new-password');
    const confirmPassword = formData.get('confirm-password');
    
    // Validaciones
    if (newPassword !== confirmPassword) {
      showNotification('Las contraseñas no coinciden', 'error');
      return;
    }
    
    if (newPassword.length < 8) {
      showNotification('La contraseña debe tener al menos 8 caracteres', 'error');
      return;
    }
    
    try {
      showLoading('Cambiando contraseña...');
      
      const response = await docuFlowAPI.profile.changePassword({
        currentPassword,
        newPassword
      });
      
      if (response.success) {
        showNotification('Contraseña cambiada exitosamente', 'success');
        form.reset();
        
        // Cerrar modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('change-password-modal'));
        modal?.hide();
      }
    } catch (error) {
      console.error('Error changing password:', error);
      showNotification('Error al cambiar la contraseña', 'error');
    } finally {
      hideLoading();
    }
  }

  // Mostrar modal de eliminación de cuenta
  showDeleteAccountModal() {
    const modal = document.getElementById('delete-account-modal');
    if (modal) {
      const bootstrapModal = new bootstrap.Modal(modal);
      bootstrapModal.show();
    }
  }

  // Inicializar tabs del perfil
  initializeProfileTabs() {
    const tabButtons = document.querySelectorAll('.profile-tab-btn');
    const tabContents = document.querySelectorAll('.profile-tab-content');
    
    tabButtons.forEach(button => {
      button.addEventListener('click', (e) => {
        e.preventDefault();
        
        const targetTab = button.getAttribute('data-tab');
        
        // Actualizar botones
        tabButtons.forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');
        
        // Actualizar contenido
        tabContents.forEach(content => {
          if (content.id === `${targetTab}-tab`) {
            content.classList.add('active');
          } else {
            content.classList.remove('active');
          }
        });
      });
    });
  }

  getRoleDisplayName(role) {
    if (!role) return 'Usuario';

    const normalized = role.toString().toUpperCase();
    const dictionary = {
      ADMIN: 'Administrador',
      ADMINISTRATOR: 'Administrador',
      SUPERADMIN: 'Super Administrador',
      USER: 'Usuario',
      STUDENT: 'Estudiante',
      ESTUDIANTE: 'Estudiante',
      MODERATOR: 'Moderador',
      MANAGER: 'Manager',
      ANALYST: 'Analista'
    };

    return dictionary[normalized] || role;
  }

  updateElementText(id, value) {
    const element = document.getElementById(id);
    if (!element) return;

    if (value && typeof value === 'object') {
      const text = value.text ?? value.value ?? 'N/A';
      element.textContent = text;
      if (value.title) {
        element.setAttribute('title', value.title);
      } else {
        element.removeAttribute('title');
      }
    } else {
      element.textContent = value ?? 'N/A';
      element.removeAttribute('title');
    }
  }

  formatDateDisplayObject(date) {
    if (!date) {
      return { text: 'N/A', title: 'Sin registro' };
    }

    return {
      text: this.formatDate(date),
      title: this.formatRelativeTime(date)
    };
  }

  normalizePreferences(raw = {}, fallback = {}) {
    return {
      language: raw.language || raw.locale || fallback.language || 'es',
      theme: raw.theme || raw.colorScheme || fallback.theme || 'light',
      emailNotifications: raw.emailNotifications ?? raw.notifications ?? raw.email_notifications ?? fallback.emailNotifications ?? false,
      soundNotifications: raw.soundNotifications ?? raw.sound_notifications ?? raw.sounds ?? fallback.soundNotifications ?? false,
      autoSave: raw.autoSave ?? raw.auto_save ?? fallback.autoSave ?? true,
      filePreview: raw.filePreview ?? raw.file_preview ?? fallback.filePreview ?? true,
      timezone: raw.timezone || raw.timeZone || fallback.timezone || 'UTC-5'
    };
  }

  normalizeStats(raw = {}) {
    const filesUploaded = raw.filesUploaded ?? raw.files_count ?? raw.totalFiles ?? 0;
    const commentsMade = raw.commentsMade ?? raw.comments_count ?? raw.totalComments ?? 0;
    const tasksCreated = raw.tasksCreated ?? raw.tasks_count ?? raw.totalTasks ?? raw.tasks ?? 0;
    const tasksCompleted = raw.tasksCompleted ?? raw.tasks_completed ?? raw.completedTasks ?? 0;
    const loginCount = raw.loginCount ?? raw.successfulLogins ?? raw.login_count ?? raw.logins ?? 0;
    const totalStorageUsed = raw.totalStorageUsed ?? raw.storageUsed ?? raw.totalStorage ?? raw.storage ?? 0;
    const lastActivity = raw.lastActivity ?? raw.lastActivityAt ?? raw.lastActionAt ?? raw.lastInteractionAt ?? null;

    return {
      ...raw,
      filesUploaded: Number(filesUploaded) || 0,
      commentsMade: Number(commentsMade) || 0,
      tasksCreated: Number(tasksCreated) || 0,
      tasksCompleted: Number(tasksCompleted) || 0,
      loginCount: Number(loginCount) || 0,
      totalStorageUsed: Number(totalStorageUsed) || 0,
      lastActivity
    };
  }

  normalizeProfileData(raw = {}) {
    const user = raw.user || raw.profile || raw || {};
    const stats = this.normalizeStats(raw.stats || user.stats || raw.activityStats || {});
    const preferences = this.normalizePreferences(raw.preferences || user.preferences || {}, this.preferences || {});
    const activityHistory = Array.isArray(raw.activityHistory) ? raw.activityHistory : Array.isArray(raw.activity) ? raw.activity : [];

    let fullName = raw.fullName || user.fullName || `${user.firstName || ''} ${user.lastName || ''}`.trim();
    const username = user.username || raw.username || (user.email ? user.email.split('@')[0] : '');

    if (!fullName) {
      fullName = username || user.email || 'Usuario';
    }

    const normalized = {
      id: user.id ?? raw.id ?? null,
      username,
      email: user.email || raw.email || '',
      firstName: user.firstName || raw.firstName || '',
      lastName: user.lastName || raw.lastName || '',
      fullName,
      phone: user.phone || raw.phone || '',
      department: user.department || raw.department || '',
      position: user.position || raw.position || '',
      location: user.location || raw.location || '',
      bio: user.bio || raw.bio || '',
      timezone: user.timezone || raw.timezone || preferences.timezone || 'UTC-5',
      role: user.role || raw.role || 'Usuario',
      avatarUrl: user.avatarUrl || user.avatar || raw.avatarUrl || null,
      createdAt: user.createdAt || raw.createdAt || raw.registeredAt || null,
      lastLogin: user.lastLogin || raw.lastLogin || raw.lastAccessAt || user.lastAccessAt || null,
      lastActivity: raw.lastActivity || stats.lastActivity || user.lastActivity || raw.lastActionAt || user.lastActionAt || null,
      stats,
      preferences,
      activityHistory,
      sessions: Array.isArray(raw.sessions) ? raw.sessions : []
    };

    normalized.user = {
      ...user,
      stats
    };
    normalized.preferences = preferences;
    normalized.raw = raw;

    return normalized;
  }

  extractCurrentUser(profile = {}) {
    if (!profile) return null;
    const fullName = profile.fullName || `${profile.firstName || ''} ${profile.lastName || ''}`.trim();

    return {
      id: profile.id,
      username: profile.username,
      email: profile.email,
      name: fullName || profile.username || profile.email || 'Usuario',
      role: profile.role,
      avatarUrl: profile.avatarUrl,
      department: profile.department,
      lastLogin: profile.lastLogin,
      createdAt: profile.createdAt
    };
  }

  hasMeaningfulStats(stats = {}) {
    return Boolean(
      stats.filesUploaded ||
      stats.commentsMade ||
      stats.tasksCreated ||
      stats.tasksCompleted ||
      stats.loginCount ||
      stats.totalStorageUsed ||
      stats.lastActivity
    );
  }

  async ensureProfileStats(forceRefresh = false) {
    if (!this.profileData) return;

    if (!forceRefresh && this.statsLoaded && this.hasMeaningfulStats(this.profileData.stats)) {
      this.updateUserStats();
      return;
    }

    try {
      const response = await docuFlowAPI.profile.getStats({ showLoading: false });
      const statsPayload = response?.data ?? response;

      if (statsPayload) {
        this.profileData.stats = this.normalizeStats(statsPayload);
        this.statsLoaded = true;
      }
    } catch (error) {
      if (forceRefresh) {
        console.warn('No se pudieron actualizar las estadísticas del perfil:', error);
      }
    } finally {
      this.updateUserStats();
    }
  }

  updateNavIdentity(displayName) {
    const navName = document.getElementById('nav-username');
    const navRole = document.getElementById('nav-role');

    if (navName) {
      navName.textContent = displayName || this.profileData?.username || 'Usuario';
    }

    if (navRole) {
      navRole.textContent = this.getRoleDisplayName(this.profileData?.role);
    }
  }

  buildProfileUpdatePayload(formData) {
    const payload = {};

    for (const [key, value] of formData.entries()) {
      if (typeof value === 'string') {
        const trimmed = value.trim();
        payload[key] = trimmed === '' ? null : trimmed;
      } else {
        payload[key] = value;
      }
    }

    if (!payload.username && this.profileData?.username) {
      payload.username = this.profileData.username;
    }

    if (!payload.timezone && this.profileData?.timezone) {
      payload.timezone = this.profileData.timezone;
    }

    return payload;
  }

  // Formatear fecha
  formatDate(dateString) {
    if (!dateString) return 'N/A';
    
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  // Formatear tiempo relativo
  formatRelativeTime(dateString) {
    if (!dateString) return 'N/A';
    
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);
    
    if (diffInSeconds < 60) return 'Hace un momento';
    if (diffInSeconds < 3600) return `Hace ${Math.floor(diffInSeconds / 60)} minutos`;
    if (diffInSeconds < 86400) return `Hace ${Math.floor(diffInSeconds / 3600)} horas`;
    if (diffInSeconds < 2592000) return `Hace ${Math.floor(diffInSeconds / 86400)} días`;
    
    return this.formatDate(dateString);
  }

  // Formatear tamaño de archivo
  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  // Refrescar datos del perfil
  async refreshProfile() {
    await this.loadUserProfile({ forceRefresh: true });
    await this.loadActivityHistory(true);
    await this.loadUserPreferences(true);
    showNotification('Perfil actualizado', 'success');
  }

  // Destruir controlador
  destroy() {
    // Limpiar event listeners si es necesario
    this.profileForm?.removeEventListener('submit', this.handleProfileUpdate);
    this.preferencesForm?.removeEventListener('submit', this.handlePreferencesUpdate);
    this.avatarInput?.removeEventListener('change', this.handleAvatarChange);
  }
}

// Exportar controlador
export default ProfileController;

// Inicializar controlador cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
  window.profileController = new ProfileController();
});