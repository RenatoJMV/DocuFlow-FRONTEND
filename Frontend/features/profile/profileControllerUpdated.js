import { docuFlowAPI } from '../../shared/services/apiClient.js';
import { initializeNavbar, showNotification, FormValidator, validators } from '../../shared/utils/uiHelpers.js';

class ProfileController {
  constructor() {
    this.currentUser = JSON.parse(localStorage.getItem('user') || '{}');
    this.isEditing = false;
    
    this.initializeComponents();
    this.setupEventListeners();
    this.loadProfile();
  }

  initializeComponents() {
    initializeNavbar('profile');
    this.setupFormValidation();
  }

  setupFormValidation() {
    this.profileValidator = new FormValidator('profileForm');
    this.profileValidator
      .addRule('fullName', validators.required, 'El nombre es requerido')
      .addRule('email', validators.email, 'Email inválido')
      .addRule('phone', (value) => !value || /^[\d\s\-\+\(\)]+$/.test(value), 'Teléfono inválido');

    this.passwordValidator = new FormValidator('changePasswordForm');
    this.passwordValidator
      .addRule('currentPassword', validators.required, 'Contraseña actual requerida')
      .addRule('newPassword', validators.password, 'La contraseña debe tener al menos 8 caracteres')
      .addRule('confirmPassword', (value, formData) => {
        return value === formData.newPassword;
      }, 'Las contraseñas no coinciden');
  }

  setupEventListeners() {
    // Botón de editar perfil
    const editBtn = document.getElementById('editProfileBtn');
    if (editBtn) {
      editBtn.addEventListener('click', () => this.toggleEditMode());
    }

    // Botón de cancelar edición
    const cancelBtn = document.getElementById('cancelEditBtn');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => this.cancelEdit());
    }

    // Formulario de perfil
    const profileForm = document.getElementById('profileForm');
    if (profileForm) {
      profileForm.addEventListener('submit', (e) => this.handleProfileUpdate(e));
    }

    // Formulario de cambio de contraseña
    const passwordForm = document.getElementById('changePasswordForm');
    if (passwordForm) {
      passwordForm.addEventListener('submit', (e) => this.handlePasswordChange(e));
    }

    // Subida de avatar
    const avatarInput = document.getElementById('avatarInput');
    if (avatarInput) {
      avatarInput.addEventListener('change', (e) => this.handleAvatarUpload(e));
    }

    // Botón de cambiar avatar
    const changeAvatarBtn = document.getElementById('changeAvatarBtn');
    if (changeAvatarBtn) {
      changeAvatarBtn.addEventListener('click', () => {
        document.getElementById('avatarInput').click();
      });
    }

    // Toggle para mostrar/ocultar contraseñas
    this.setupPasswordToggles();
  }

  setupPasswordToggles() {
    const toggleButtons = document.querySelectorAll('.password-toggle');
    toggleButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const input = btn.previousElementSibling;
        const icon = btn.querySelector('i');
        
        if (input.type === 'password') {
          input.type = 'text';
          icon.classList.remove('bi-eye');
          icon.classList.add('bi-eye-slash');
        } else {
          input.type = 'password';
          icon.classList.remove('bi-eye-slash');
          icon.classList.add('bi-eye');
        }
      });
    });
  }

  async loadProfile() {
    try {
      this.showLoading(true);
      const profile = await docuFlowAPI.profile.get();
      this.currentUser = profile.data || profile;
      this.renderProfile();
      
      // Actualizar localStorage
      localStorage.setItem('user', JSON.stringify(this.currentUser));
      
    } catch (error) {
      console.error('Error loading profile:', error);
      showNotification('Error al cargar perfil', 'error');
      this.renderProfile(); // Renderizar con datos del localStorage
    } finally {
      this.showLoading(false);
    }
  }

  renderProfile() {
    this.updateAvatar();
    this.updateProfileInfo();
    this.updateStats();
  }

  updateAvatar() {
    const avatarImg = document.getElementById('userAvatar');
    if (avatarImg) {
      const avatarUrl = this.currentUser.avatarUrl || 
                      this.currentUser.avatar || 
                      `https://ui-avatars.com/api/?name=${encodeURIComponent(this.currentUser.name || 'User')}&background=0d6efd&color=fff&size=150`;
      avatarImg.src = avatarUrl;
    }

    const avatarPreview = document.getElementById('avatarPreview');
    if (avatarPreview) {
      avatarPreview.src = avatarImg.src;
    }
  }

  updateProfileInfo() {
    // Información básica
    const nameElement = document.getElementById('userName');
    if (nameElement) nameElement.textContent = this.currentUser.name || 'Usuario';

    const emailElement = document.getElementById('userEmail');
    if (emailElement) emailElement.textContent = this.currentUser.email || 'No especificado';

    const roleElement = document.getElementById('userRole');
    if (roleElement) roleElement.textContent = this.getRoleDisplayName(this.currentUser.role);

    const joinDateElement = document.getElementById('joinDate');
    if (joinDateElement && this.currentUser.createdAt) {
      joinDateElement.textContent = new Date(this.currentUser.createdAt).toLocaleDateString('es-ES');
    }

    // Campos del formulario
    if (this.isEditing) {
      document.getElementById('fullName').value = this.currentUser.name || '';
      document.getElementById('email').value = this.currentUser.email || '';
      document.getElementById('phone').value = this.currentUser.phone || '';
      document.getElementById('bio').value = this.currentUser.bio || '';
    } else {
      document.getElementById('displayName').textContent = this.currentUser.name || 'Usuario';
      document.getElementById('displayEmail').textContent = this.currentUser.email || 'No especificado';
      document.getElementById('displayPhone').textContent = this.currentUser.phone || 'No especificado';
      document.getElementById('displayBio').textContent = this.currentUser.bio || 'Sin descripción';
    }
  }

  updateStats() {
    // Estadísticas del usuario (placeholder)
    const stats = {
      filesUploaded: this.currentUser.filesUploaded || 0,
      commentsCount: this.currentUser.commentsCount || 0,
      lastActivity: this.currentUser.lastLogin || this.currentUser.updatedAt
    };

    const filesCountElement = document.getElementById('filesCount');
    if (filesCountElement) filesCountElement.textContent = stats.filesUploaded;

    const commentsCountElement = document.getElementById('commentsCount');
    if (commentsCountElement) commentsCountElement.textContent = stats.commentsCount;

    const lastActivityElement = document.getElementById('lastActivity');
    if (lastActivityElement && stats.lastActivity) {
      lastActivityElement.textContent = new Date(stats.lastActivity).toLocaleDateString('es-ES');
    }
  }

  toggleEditMode() {
    this.isEditing = !this.isEditing;
    
    const viewMode = document.getElementById('profileViewMode');
    const editMode = document.getElementById('profileEditMode');
    const editBtn = document.getElementById('editProfileBtn');
    
    if (this.isEditing) {
      viewMode.style.display = 'none';
      editMode.style.display = 'block';
      editBtn.textContent = 'Guardar Cambios';
      editBtn.classList.remove('btn-outline-primary');
      editBtn.classList.add('btn-primary');
      
      this.updateProfileInfo(); // Llenar campos del formulario
    } else {
      viewMode.style.display = 'block';
      editMode.style.display = 'none';
      editBtn.textContent = 'Editar Perfil';
      editBtn.classList.remove('btn-primary');
      editBtn.classList.add('btn-outline-primary');
    }
  }

  cancelEdit() {
    this.isEditing = false;
    this.toggleEditMode();
    this.updateProfileInfo(); // Restaurar valores originales
  }

  async handleProfileUpdate(e) {
    e.preventDefault();
    
    if (!this.profileValidator.validate()) {
      showNotification('Por favor, corrige los errores en el formulario', 'warning');
      return;
    }

    try {
      this.setSubmitLoading('profileSubmitBtn', true);
      
      const formData = new FormData(e.target);
      const profileData = {
        name: formData.get('fullName'),
        email: formData.get('email'),
        phone: formData.get('phone'),
        bio: formData.get('bio')
      };

      const updatedProfile = await docuFlowAPI.profile.update(profileData);
      
      this.currentUser = { ...this.currentUser, ...(updatedProfile.data || updatedProfile) };
      localStorage.setItem('user', JSON.stringify(this.currentUser));
      
      showNotification('Perfil actualizado exitosamente', 'success');
      this.toggleEditMode();
      this.renderProfile();
      
    } catch (error) {
      console.error('Error updating profile:', error);
      showNotification('Error al actualizar perfil', 'error');
    } finally {
      this.setSubmitLoading('profileSubmitBtn', false);
    }
  }

  async handlePasswordChange(e) {
    e.preventDefault();
    
    if (!this.passwordValidator.validate()) {
      showNotification('Por favor, corrige los errores en el formulario', 'warning');
      return;
    }

    try {
      this.setSubmitLoading('passwordSubmitBtn', true);
      
      const formData = new FormData(e.target);
      const passwordData = {
        currentPassword: formData.get('currentPassword'),
        newPassword: formData.get('newPassword')
      };

      await docuFlowAPI.profile.changePassword(passwordData);
      
      showNotification('Contraseña cambiada exitosamente', 'success');
      e.target.reset();
      
      // Cerrar modal si existe
      const modal = document.getElementById('changePasswordModal');
      if (modal) {
        const bootstrapModal = bootstrap.Modal.getInstance(modal);
        if (bootstrapModal) bootstrapModal.hide();
      }
      
    } catch (error) {
      console.error('Error changing password:', error);
      showNotification('Error al cambiar contraseña', 'error');
    } finally {
      this.setSubmitLoading('passwordSubmitBtn', false);
    }
  }

  async handleAvatarUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    // Validar tipo de archivo
    if (!file.type.startsWith('image/')) {
      showNotification('Por favor, selecciona una imagen válida', 'warning');
      return;
    }

    // Validar tamaño (máximo 5MB)
    if (file.size > 5 * 1024 * 1024) {
      showNotification('La imagen debe ser menor a 5MB', 'warning');
      return;
    }

    try {
      this.setSubmitLoading('changeAvatarBtn', true);
      
      const formData = new FormData();
      formData.append('avatar', file);

      const result = await docuFlowAPI.profile.uploadAvatar(formData);
      
      this.currentUser.avatarUrl = result.avatarUrl || result.data?.avatarUrl;
      localStorage.setItem('user', JSON.stringify(this.currentUser));
      
      this.updateAvatar();
      showNotification('Avatar actualizado exitosamente', 'success');
      
    } catch (error) {
      console.error('Error uploading avatar:', error);
      showNotification('Error al subir avatar', 'error');
    } finally {
      this.setSubmitLoading('changeAvatarBtn', false);
    }
  }

  getRoleDisplayName(role) {
    const roles = {
      'ADMIN': 'Administrador',
      'USER': 'Usuario',
      'MODERATOR': 'Moderador',
      'GUEST': 'Invitado'
    };
    return roles[role] || role || 'Usuario';
  }

  setSubmitLoading(buttonId, isLoading) {
    const button = document.getElementById(buttonId);
    if (!button) return;

    if (isLoading) {
      button.disabled = true;
      const originalText = button.textContent;
      button.dataset.originalText = originalText;
      button.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Guardando...';
    } else {
      button.disabled = false;
      button.textContent = button.dataset.originalText || 'Guardar';
    }
  }

  showLoading(show) {
    const profileContainer = document.getElementById('profileContainer');
    const loadingContainer = document.getElementById('profileLoading');
    
    if (show) {
      if (profileContainer) profileContainer.style.display = 'none';
      if (loadingContainer) loadingContainer.style.display = 'block';
    } else {
      if (profileContainer) profileContainer.style.display = 'block';
      if (loadingContainer) loadingContainer.style.display = 'none';
    }
  }
}

// Inicializar controlador cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
  new ProfileController();
});

export default ProfileController;