// Controller completo para gestión de perfiles de usuario
import { docuFlowAPI } from '../../shared/services/apiClient.js';
import { store } from '../../shared/services/store.js';
import { showNotification, showLoading, hideLoading } from '../../shared/utils/uiHelpers.js';

class ProfileController {
  constructor() {
    this.currentUser = null;
    this.profileData = null;
    this.activityHistory = [];
    this.preferences = {};
    this.avatarFile = null;
    this.isEditing = false;
    
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
      this.loadActivityHistory();
      this.loadUserPreferences();
      this.initializeProfileTabs();
    } catch (error) {
      console.error('Error initializing profile controller:', error);
      showNotification('Error al cargar el perfil de usuario', 'error');
    }
  }

  // Cargar perfil del usuario actual
  async loadUserProfile() {
    try {
      showLoading('Cargando perfil...');
      
      const response = await docuFlowAPI.profile.getCurrent();
      
      if (response.success) {
        this.profileData = response.data;
        this.currentUser = response.data.user;
        this.populateProfileForm();
        this.updateProfileDisplay();
      }
    } catch (error) {
      console.error('Error loading user profile:', error);
      showNotification('Error al cargar el perfil', 'error');
    } finally {
      hideLoading();
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

    // Actualizar información en el header
    const fullName = `${this.profileData.firstName || ''} ${this.profileData.lastName || ''}`.trim();
    
    const elements = {
      'user-name-display': fullName || this.profileData.username,
      'user-email-display': this.profileData.email,
      'user-role-display': this.profileData.role || 'Usuario',
      'user-department-display': this.profileData.department || 'Sin departamento',
      'user-last-login': this.formatDate(this.profileData.lastLogin),
      'user-member-since': this.formatDate(this.profileData.createdAt)
    };

    Object.entries(elements).forEach(([id, value]) => {
      const element = document.getElementById(id);
      if (element) {
        element.textContent = value;
      }
    });

    // Actualizar estadísticas del usuario
    this.updateUserStats();
  }

  // Actualizar estadísticas del usuario
  updateUserStats() {
    if (!this.profileData.stats) return;

    const stats = this.profileData.stats;
    const elements = {
      'stats-files-uploaded': stats.filesUploaded || 0,
      'stats-comments-made': stats.commentsMade || 0,
      'stats-total-storage': this.formatFileSize(stats.totalStorageUsed || 0),
      'stats-login-count': stats.loginCount || 0,
      'stats-last-activity': this.formatDate(stats.lastActivity)
    };

    Object.entries(elements).forEach(([id, value]) => {
      const element = document.getElementById(id);
      if (element) {
        element.textContent = value;
      }
    });
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
    
    avatarElements.forEach(element => {
      if (avatarUrl) {
        element.src = avatarUrl;
        element.style.display = 'block';
      } else {
        // Mostrar iniciales como fallback
        const initials = this.getUserInitials();
        element.style.display = 'none';
        
        // Crear elemento de iniciales si no existe
        let initialsElement = element.nextElementSibling;
        if (!initialsElement || !initialsElement.classList.contains('user-initials')) {
          initialsElement = document.createElement('div');
          initialsElement.className = 'user-initials';
          element.parentNode.insertBefore(initialsElement, element.nextSibling);
        }
        
        initialsElement.textContent = initials;
        initialsElement.style.display = 'flex';
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
    this.isEditing = !this.isEditing;
    
    const editableFields = document.querySelectorAll('.profile-field input, .profile-field textarea, .profile-field select');
    const editBtn = document.getElementById('edit-profile-btn');
    const cancelBtn = document.getElementById('cancel-edit-btn');
    const submitBtn = document.getElementById('save-profile-btn');
    
    editableFields.forEach(field => {
      field.disabled = !this.isEditing;
    });
    
    if (editBtn) editBtn.style.display = this.isEditing ? 'none' : 'inline-block';
    if (cancelBtn) cancelBtn.style.display = this.isEditing ? 'inline-block' : 'none';
    if (submitBtn) submitBtn.style.display = this.isEditing ? 'inline-block' : 'none';
    
    if (this.isEditing) {
      showNotification('Modo de edición activado', 'info');
    }
  }

  // Cancelar edición
  cancelEdit() {
    this.isEditing = false;
    this.populateProfileForm(); // Restaurar datos originales
    this.toggleEditMode();
    showNotification('Cambios cancelados', 'info');
  }

  // Manejar actualización del perfil
  async handleProfileUpdate(event) {
    event.preventDefault();
    
    if (!this.isEditing) return;
    
    try {
      showLoading('Actualizando perfil...');
      
      const formData = new FormData(this.profileForm);
      const profileData = Object.fromEntries(formData.entries());
      
      const response = await docuFlowAPI.profile.update(profileData);
      
      if (response.success) {
        this.profileData = { ...this.profileData, ...profileData };
        this.updateProfileDisplay();
        this.toggleEditMode();
        showNotification('Perfil actualizado exitosamente', 'success');
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      showNotification('Error al actualizar el perfil', 'error');
    } finally {
      hideLoading();
    }
  }

  // Cargar historial de actividad
  async loadActivityHistory() {
    try {
      const response = await docuFlowAPI.profile.getActivity();
      
      if (response.success) {
        this.activityHistory = response.data;
        this.renderActivityHistory();
      }
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
  async loadUserPreferences() {
    try {
      const response = await docuFlowAPI.profile.getPreferences();
      
      if (response.success) {
        this.preferences = response.data;
        this.populatePreferencesForm();
      }
    } catch (error) {
      console.error('Error loading preferences:', error);
    }
  }

  // Poblar formulario de preferencias
  populatePreferencesForm() {
    const elements = {
      'pref-language': this.preferences.language || 'es',
      'pref-timezone': this.preferences.timezone || 'UTC-5',
      'pref-theme': this.preferences.theme || 'light',
      'pref-notifications': this.preferences.emailNotifications || false,
      'pref-sound': this.preferences.soundNotifications || false,
      'pref-auto-save': this.preferences.autoSave || true,
      'pref-file-preview': this.preferences.filePreview || true
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
      
      // Procesar datos del formulario
      for (let [key, value] of formData.entries()) {
        preferences[key.replace('pref-', '')] = value;
      }
      
      // Procesar checkboxes
      const checkboxes = this.preferencesForm.querySelectorAll('input[type="checkbox"]');
      checkboxes.forEach(checkbox => {
        const key = checkbox.id.replace('pref-', '');
        preferences[key] = checkbox.checked;
      });
      
      const response = await docuFlowAPI.profile.updatePreferences(preferences);
      
      if (response.success) {
        this.preferences = { ...this.preferences, ...preferences };
        showNotification('Preferencias actualizadas exitosamente', 'success');
        
        // Aplicar cambios inmediatamente
        this.applyPreferences();
      }
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
    
    // Aplicar configuración de notificaciones
    if (window.notificationController) {
      window.notificationController.setSoundEnabled(this.preferences.soundNotifications);
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
    await this.loadUserProfile();
    await this.loadActivityHistory();
    await this.loadUserPreferences();
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