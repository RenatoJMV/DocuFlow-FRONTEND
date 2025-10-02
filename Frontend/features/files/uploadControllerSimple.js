// uploadControllerSimple.js - Controlador simplificado para gestión de archivos
import { docuFlowAPI } from '../../shared/services/apiClientSimple.js';
import authService from '../../shared/services/authServiceSimple.js';
import { showNotification } from '../../shared/utils/uiHelpers.js';

class SimpleUploadController {
  constructor() {
    this.files = [];
    this.currentFilter = {};
    this.init();
  }

  async init() {
    if (!authService.isLoggedIn()) {
      window.location.href = '../auth/login.html';
      return;
    }

    this.setupEventListeners();
    await this.loadFiles();
    this.updateUI();
  }

  setupEventListeners() {
    // Upload de archivos
    const uploadBtn = document.getElementById('uploadBtn');
    const fileInput = document.getElementById('fileInput');
    
    if (uploadBtn) {
      uploadBtn.addEventListener('click', () => fileInput?.click());
    }

    if (fileInput) {
      fileInput.addEventListener('change', (e) => this.handleFileUpload(e));
    }

    // Búsqueda
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => this.handleSearch(e.target.value));
    }

    // Filtros
    this.setupFilters();

    // Refresh
    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => this.loadFiles());
    }
  }

  setupFilters() {
    // Filtro por tipo
    const typeFilter = document.getElementById('typeFilter');
    if (typeFilter) {
      typeFilter.addEventListener('change', (e) => {
        this.currentFilter.type = e.target.value;
        this.filterFiles();
      });
    }

    // Filtro por fecha
    const dateFilter = document.getElementById('dateFilter');
    if (dateFilter) {
      dateFilter.addEventListener('change', (e) => {
        this.currentFilter.date = e.target.value;
        this.filterFiles();
      });
    }

    // Filtro por usuario
    const userFilter = document.getElementById('userFilter');
    if (userFilter) {
      userFilter.addEventListener('change', (e) => {
        this.currentFilter.user = e.target.value;
        this.filterFiles();
      });
    }
  }

  async handleFileUpload(event) {
    const files = Array.from(event.target.files);
    if (files.length === 0) return;

    if (!authService.hasPermission('upload_files')) {
      showNotification('No tienes permisos para subir archivos', 'error');
      return;
    }

    for (const file of files) {
      await this.uploadFile(file);
    }

    // Limpiar input
    event.target.value = '';
    await this.loadFiles();
  }

  async uploadFile(file) {
    try {
      showNotification(`Subiendo ${file.name}...`, 'info');

      const formData = new FormData();
      formData.append('file', file);
      formData.append('uploadedBy', authService.getCurrentUser().email);

      const response = await docuFlowAPI.files.upload(formData);

      if (response.success) {
        showNotification(`${file.name} subido exitosamente`, 'success');
        
        // Log de la acción
        await this.logAction('file_upload', file.name);
      } else {
        throw new Error(response.error || 'Error subiendo archivo');
      }

    } catch (error) {
      console.error('Error subiendo archivo:', error);
      showNotification(`Error subiendo ${file.name}: ${error.message}`, 'error');
    }
  }

  async loadFiles() {
    try {
      const response = await docuFlowAPI.files.list();
      
      if (response.success) {
        this.files = response.data.files || [];
        this.renderFileList();
        this.updateStats();
      }

    } catch (error) {
      console.error('Error cargando archivos:', error);
      showNotification('Error cargando archivos', 'error');
    }
  }

  filterFiles() {
    const filtered = this.files.filter(file => {
      // Filtro por tipo
      if (this.currentFilter.type && this.currentFilter.type !== 'all') {
        if (!file.type.includes(this.currentFilter.type)) return false;
      }

      // Filtro por fecha
      if (this.currentFilter.date) {
        const fileDate = new Date(file.uploadedAt);
        const filterDate = new Date(this.currentFilter.date);
        if (fileDate.toDateString() !== filterDate.toDateString()) return false;
      }

      // Filtro por usuario
      if (this.currentFilter.user && this.currentFilter.user !== 'all') {
        if (file.uploadedBy !== this.currentFilter.user) return false;
      }

      return true;
    });

    this.renderFileList(filtered);
  }

  async handleSearch(query) {
    if (!query.trim()) {
      this.renderFileList();
      return;
    }

    const filtered = this.files.filter(file => 
      file.name.toLowerCase().includes(query.toLowerCase()) ||
      file.uploadedBy.toLowerCase().includes(query.toLowerCase())
    );

    this.renderFileList(filtered);
  }

  renderFileList(filesToRender = this.files) {
    const container = document.getElementById('filesList');
    if (!container) return;

    if (filesToRender.length === 0) {
      container.innerHTML = `
        <div class="text-center py-5">
          <i class="bi bi-folder2-open" style="font-size: 3rem; color: #ccc;"></i>
          <p class="text-muted mt-3">No hay archivos para mostrar</p>
        </div>
      `;
      return;
    }

    container.innerHTML = filesToRender.map(file => `
      <div class="file-item card mb-2">
        <div class="card-body d-flex align-items-center">
          <div class="file-icon me-3">
            <i class="bi ${this.getFileIcon(file.type)}" style="font-size: 1.5rem;"></i>
          </div>
          <div class="file-info flex-grow-1">
            <h6 class="mb-1">${file.name}</h6>
            <small class="text-muted">
              ${this.formatFileSize(file.size)} • 
              Subido por ${file.uploadedBy} • 
              ${this.formatDate(file.uploadedAt)}
            </small>
          </div>
          <div class="file-actions">
            <button class="btn btn-sm btn-outline-primary me-1" onclick="uploadController.downloadFile(${file.id})">
              <i class="bi bi-download"></i>
            </button>
            <button class="btn btn-sm btn-outline-info me-1" onclick="uploadController.showComments(${file.id})">
              <i class="bi bi-chat-dots"></i>
            </button>
            ${authService.hasPermission('delete_files') ? `
              <button class="btn btn-sm btn-outline-danger" onclick="uploadController.deleteFile(${file.id})">
                <i class="bi bi-trash"></i>
              </button>
            ` : ''}
          </div>
        </div>
      </div>
    `).join('');
  }

  async downloadFile(fileId) {
    try {
      const file = this.files.find(f => f.id === fileId);
      if (!file) return;

      showNotification(`Descargando ${file.name}...`, 'info');
      
      const response = await docuFlowAPI.files.download(fileId);
      
      if (response.success) {
        // En modo demo, solo simular descarga
        showNotification(`${file.name} descargado`, 'success');
        await this.logAction('file_download', file.name);
      }

    } catch (error) {
      console.error('Error descargando archivo:', error);
      showNotification('Error descargando archivo', 'error');
    }
  }

  async deleteFile(fileId) {
    if (!authService.hasPermission('delete_files')) {
      showNotification('No tienes permisos para eliminar archivos', 'error');
      return;
    }

    const file = this.files.find(f => f.id === fileId);
    if (!file) return;

    if (!confirm(`¿Estás seguro de eliminar "${file.name}"?`)) return;

    try {
      const response = await docuFlowAPI.files.delete(fileId);
      
      if (response.success) {
        showNotification(`${file.name} eliminado`, 'success');
        await this.logAction('file_delete', file.name);
        await this.loadFiles();
      }

    } catch (error) {
      console.error('Error eliminando archivo:', error);
      showNotification('Error eliminando archivo', 'error');
    }
  }

  showComments(fileId) {
    // Abrir modal de comentarios
    window.location.href = `../comments/comments.html?fileId=${fileId}`;
  }

  async logAction(action, target) {
    try {
      await docuFlowAPI.logs.create({
        action,
        user: authService.getCurrentUser().email,
        target,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.warn('Error registrando log:', error);
    }
  }

  updateStats() {
    const totalFiles = this.files.length;
    const totalSize = this.files.reduce((sum, file) => sum + file.size, 0);

    const statsContainer = document.getElementById('fileStats');
    if (statsContainer) {
      statsContainer.innerHTML = `
        <div class="row">
          <div class="col-md-6">
            <div class="stat-card">
              <h6>Total de Archivos</h6>
              <span class="stat-number">${totalFiles}</span>
            </div>
          </div>
          <div class="col-md-6">
            <div class="stat-card">
              <h6>Espacio Usado</h6>
              <span class="stat-number">${this.formatFileSize(totalSize)}</span>
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
        <span>Bienvenido, ${user.name}</span>
        <button class="btn btn-sm btn-outline-secondary ms-2" onclick="authService.logout().then(() => location.href = '../auth/login.html')">
          Cerrar Sesión
        </button>
      `;
    }

    // Mostrar/ocultar botones según permisos
    const uploadBtn = document.getElementById('uploadBtn');
    if (uploadBtn) {
      uploadBtn.style.display = authService.hasPermission('upload_files') ? 'block' : 'none';
    }
  }

  // Utilidades
  getFileIcon(type) {
    if (type.includes('pdf')) return 'bi-file-earmark-pdf';
    if (type.includes('image')) return 'bi-file-earmark-image';
    if (type.includes('text')) return 'bi-file-earmark-text';
    if (type.includes('word')) return 'bi-file-earmark-word';
    if (type.includes('excel')) return 'bi-file-earmark-excel';
    return 'bi-file-earmark';
  }

  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
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
const uploadController = new SimpleUploadController();

// Hacer disponible globalmente
window.uploadController = uploadController;

export default uploadController;