import { docuFlowAPI } from '../../shared/services/apiClient.js';
import { store } from '../../shared/services/store.js';
import { initializeNavbar, showNotification, Pagination, FormValidator } from '../../shared/utils/uiHelpers.js';

class UploadController {
  constructor() {
    this.selectedFiles = [];
    this.currentView = 'table'; // table or grid
    this.currentPage = 1;
    this.itemsPerPage = 10;
    this.allFiles = [];
    this.filteredFiles = [];
    
    this.initializeComponents();
    this.setupEventListeners();
    this.loadFiles();
    this.updateStats();
  }

  initializeComponents() {
    // Create navbar
    initializeNavbar('upload');
    
    // Initialize drag & drop
    this.setupDragAndDrop();
  }

  setupDragAndDrop() {
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');

    // Drag & drop events
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
      dropZone.addEventListener(eventName, this.preventDefaults, false);
      document.body.addEventListener(eventName, this.preventDefaults, false);
    });

    ['dragenter', 'dragover'].forEach(eventName => {
      dropZone.addEventListener(eventName, () => dropZone.classList.add('drag-over'), false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
      dropZone.addEventListener(eventName, () => dropZone.classList.remove('drag-over'), false);
    });

    dropZone.addEventListener('drop', (e) => {
      const files = e.dataTransfer.files;
      this.handleFileSelection([...files]);
    });

    dropZone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => {
      if (e.target.files.length > 0) {
        this.handleFileSelection([...e.target.files]);
      }
    });
  }

  preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
  }

  handleFileSelection(files) {
    files.forEach(file => {
      // Check if file already selected
      if (!this.selectedFiles.find(f => f.name === file.name && f.size === file.size)) {
        this.selectedFiles.push(file);
      }
    });
    
    this.renderSelectedFiles();
    this.updateUploadButton();
  }

  renderSelectedFiles() {
    const container = document.getElementById('selectedFiles');
    container.innerHTML = '';

    if (this.selectedFiles.length === 0) {
      container.style.display = 'none';
      return;
    }

    container.style.display = 'block';
    
    this.selectedFiles.forEach((file, index) => {
      const fileElement = document.createElement('div');
      fileElement.className = 'file-item';
      
      const fileIcon = this.getFileIcon(file.type);
      const fileSize = this.formatFileSize(file.size);
      
      fileElement.innerHTML = `
        <div class="file-info">
          <div class="file-icon ${fileIcon.class}">${fileIcon.icon}</div>
          <div class="file-details">
            <h6>${file.name}</h6>
            <small>${fileSize}</small>
          </div>
        </div>
        <button class="file-remove" onclick="uploadController.removeFile(${index})">
          <i class="bi bi-x"></i>
        </button>
      `;
      
      container.appendChild(fileElement);
    });
  }

  removeFile(index) {
    this.selectedFiles.splice(index, 1);
    this.renderSelectedFiles();
    this.updateUploadButton();
  }

  updateUploadButton() {
    const uploadBtn = document.getElementById('uploadBtn');
    const count = this.selectedFiles.length;
    
    if (count > 0) {
      uploadBtn.disabled = false;
      uploadBtn.innerHTML = `<i class="bi bi-cloud-upload me-2"></i>Subir ${count} archivo${count > 1 ? 's' : ''}`;
    } else {
      uploadBtn.disabled = true;
      uploadBtn.innerHTML = '<i class="bi bi-cloud-upload me-2"></i>Seleccionar archivos';
    }
  }

  getFileIcon(mimeType) {
    if (mimeType.startsWith('image/')) return { class: 'img', icon: '<i class="bi bi-image"></i>' };
    if (mimeType.includes('pdf')) return { class: 'pdf', icon: '<i class="bi bi-file-earmark-pdf"></i>' };
    if (mimeType.includes('word') || mimeType.includes('document')) return { class: 'doc', icon: '<i class="bi bi-file-earmark-word"></i>' };
    if (mimeType.includes('zip') || mimeType.includes('rar')) return { class: 'zip', icon: '<i class="bi bi-file-earmark-zip"></i>' };
    return { class: 'default', icon: '<i class="bi bi-file-earmark"></i>' };
  }

  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  setupEventListeners() {
    // Upload form
    const uploadForm = document.getElementById('uploadForm');
    if (uploadForm) {
      uploadForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleUpload();
      });
    }

    // Search
    const searchInput = document.getElementById('searchFiles');
    if (searchInput) {
      searchInput.addEventListener('input', () => this.filterFiles());
    }

    // View toggle
    document.querySelectorAll('.view-toggle .btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.currentView = e.target.dataset.view;
        this.updateViewToggle();
        this.renderFiles();
      });
    });

    // Refresh button
    const refreshBtn = document.getElementById('refreshFiles');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => this.loadFiles());
    }
  }

  async handleUpload() {
    if (this.selectedFiles.length === 0) {
      showNotification('Selecciona al menos un archivo', 'warning');
      return;
    }

    const uploadBtn = document.getElementById('uploadBtn');
    const originalText = uploadBtn.innerHTML;
    
    try {
      uploadBtn.disabled = true;
      uploadBtn.innerHTML = '<i class="bi bi-arrow-clockwise spin me-2"></i>Subiendo...';

      // Show progress
      const progressContainer = document.getElementById('uploadProgress');
      const progressBar = progressContainer.querySelector('.progress-bar');
      progressContainer.style.display = 'block';

      let uploaded = 0;
      const total = this.selectedFiles.length;

      for (const file of this.selectedFiles) {
        const formData = new FormData();
        formData.append('file', file);

        console.log('📤 Subiendo archivo:', {
          nombre: file.name,
          tamaño: file.size,
          tipo: file.type
        });

        await docuFlowAPI.files.upload(formData);
        uploaded++;
        
        const progress = (uploaded / total) * 100;
        progressBar.style.width = `${progress}%`;
        progressBar.textContent = `${uploaded}/${total} archivos`;
      }

      showNotification(`${uploaded} archivo${uploaded > 1 ? 's' : ''} subido${uploaded > 1 ? 's' : ''} exitosamente`, 'success');
      
      // Clear selection
      this.selectedFiles = [];
      this.renderSelectedFiles();
      this.updateUploadButton();
      
      // Hide progress and reload files
      setTimeout(() => {
        progressContainer.style.display = 'none';
        this.loadFiles();
        this.updateStats();
      }, 1000);

    } catch (error) {
      console.error('Upload error:', error);
      showNotification('Error al subir archivos', 'error');
    } finally {
      uploadBtn.disabled = false;
      uploadBtn.innerHTML = originalText;
    }
  }

  async loadFiles() {
    try {
      const response = await docuFlowAPI.files.getAll();
      console.log('📁 Respuesta del servidor (archivos):', response);
      console.log('📁 Tipo de respuesta:', typeof response);
      console.log('📁 Es array:', Array.isArray(response));
      
      this.allFiles = Array.isArray(response) ? response : [];
      console.log('📁 Archivos cargados:', this.allFiles.length);
      
      this.filterFiles();
    } catch (error) {
      console.error('Error loading files:', error);
      showNotification('Error al cargar archivos', 'error');
      this.allFiles = [];
      this.renderFiles();
    }
  }

  filterFiles() {
    const searchTerm = document.getElementById('searchFiles')?.value.toLowerCase() || '';
    
    this.filteredFiles = this.allFiles.filter(file => 
      file.filename.toLowerCase().includes(searchTerm)
    );

    this.currentPage = 1;
    this.renderFiles();
    this.updatePagination();
  }

  renderFiles() {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const endIndex = startIndex + this.itemsPerPage;
    const filesToShow = this.filteredFiles.slice(startIndex, endIndex);

    if (this.currentView === 'table') {
      this.renderTableView(filesToShow);
    } else {
      this.renderGridView(filesToShow);
    }

    this.updateShowingCount();
  }

  renderTableView(files) {
    const tableContainer = document.getElementById('tableView');
    const gridContainer = document.getElementById('gridView'); // Nota: probablemente no existe
    
    if (tableContainer) tableContainer.style.display = 'block';
    if (gridContainer) gridContainer.style.display = 'none';

    const tbody = document.getElementById('filesTableBody');
    if (!tbody) {
      console.warn('Element filesTableBody not found');
      return;
    }
    
    tbody.innerHTML = '';

    if (files.length === 0) {
      const emptyState = document.getElementById('emptyState');
      if (emptyState) {
        emptyState.classList.remove('d-none');
      }
      return;
    } else {
      const emptyState = document.getElementById('emptyState');
      if (emptyState) {
        emptyState.classList.add('d-none');
      }
    }

    files.forEach(file => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>
          <input type="checkbox" class="form-check-input file-checkbox" data-file-id="${file.id}">
        </td>
        <td>
          <div class="file-name">
            <i class="${this.getFileIconClass(file.filename)}"></i>
            <span>${file.filename}</span>
          </div>
        </td>
        <td>${this.formatFileSize(file.size || 0)}</td>
        <td>${new Date(file.uploadDate || Date.now()).toLocaleDateString()}</td>
        <td>${file.uploader || 'Usuario'}</td>
        <td>
          <div class="file-actions">
            <button class="action-btn download" onclick="uploadController.downloadFile('${file.id}', '${file.filename}')" title="Descargar">
              <i class="bi bi-download"></i>
            </button>
            <button class="action-btn preview" onclick="uploadController.previewFile('${file.id}')" title="Vista previa">
              <i class="bi bi-eye"></i>
            </button>
            <button class="action-btn delete" onclick="uploadController.deleteFile('${file.id}')" title="Eliminar">
              <i class="bi bi-trash"></i>
            </button>
          </div>
        </td>
      `;
      tbody.appendChild(row);
    });
  }

  renderGridView(files) {
    // Por ahora, la vista de grid no está implementada en el HTML
    // Redirigir a la vista de tabla
    console.log('Grid view no implementada, usando vista de tabla');
    this.renderTableView(files);
  }

  getFileIconClass(filename) {
    const ext = filename.split('.').pop()?.toLowerCase();
    const iconMap = {
      'pdf': 'bi bi-file-earmark-pdf text-danger',
      'doc': 'bi bi-file-earmark-word text-primary',
      'docx': 'bi bi-file-earmark-word text-primary',
      'xls': 'bi bi-file-earmark-excel text-success',
      'xlsx': 'bi bi-file-earmark-excel text-success',
      'ppt': 'bi bi-file-earmark-ppt text-warning',
      'pptx': 'bi bi-file-earmark-ppt text-warning',
      'jpg': 'bi bi-file-earmark-image text-info',
      'jpeg': 'bi bi-file-earmark-image text-info',
      'png': 'bi bi-file-earmark-image text-info',
      'gif': 'bi bi-file-earmark-image text-info',
      'zip': 'bi bi-file-earmark-zip text-secondary',
      'rar': 'bi bi-file-earmark-zip text-secondary'
    };
    return iconMap[ext] || 'bi bi-file-earmark text-muted';
  }

  updateViewToggle() {
    document.querySelectorAll('.view-toggle .btn').forEach(btn => {
      btn.classList.remove('active');
      if (btn.dataset.view === this.currentView) {
        btn.classList.add('active');
      }
    });
  }

  updatePagination() {
    const totalItems = this.filteredFiles.length;
    const totalPages = Math.ceil(totalItems / this.itemsPerPage);
    
    const paginationContainer = document.getElementById('paginationContainer');
    if (!paginationContainer) return;

    if (totalPages <= 1) {
      paginationContainer.innerHTML = '';
      return;
    }

    const pagination = new Pagination(paginationContainer, {
      currentPage: this.currentPage,
      totalPages: totalPages,
      onPageChange: (page) => {
        this.currentPage = page;
        this.renderFiles();
      }
    });
  }

  updateShowingCount() {
    const showingElement = document.getElementById('showingCount');
    const totalElement = document.getElementById('totalCount');
    
    if (showingElement && totalElement) {
      const startIndex = (this.currentPage - 1) * this.itemsPerPage;
      const endIndex = Math.min(startIndex + this.itemsPerPage, this.filteredFiles.length);
      
      showingElement.textContent = this.filteredFiles.length > 0 ? `${startIndex + 1}-${endIndex}` : '0';
      totalElement.textContent = this.filteredFiles.length;
    }
  }

  async updateStats() {
    try {
      // Calcular estadísticas basándose en los archivos cargados
      const totalFiles = this.allFiles.length;
      const totalSize = this.allFiles.reduce((sum, file) => sum + (file.size || 0), 0);
      
      const totalFilesEl = document.getElementById('total-files');
      const totalSizeEl = document.getElementById('total-size');
      
      if (totalFilesEl) totalFilesEl.textContent = totalFiles;
      if (totalSizeEl) totalSizeEl.textContent = this.formatFileSize(totalSize);
      
    } catch (error) {
      console.error('Error updating stats:', error);
    }
  }

  async downloadFile(fileId, filename) {
    try {
      const response = await docuFlowAPI.files.download(fileId);
      
      // Create download link
      const url = window.URL.createObjectURL(response);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      
      // Cleanup
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      showNotification('Archivo descargado', 'success');
    } catch (error) {
      console.error('Download error:', error);
      showNotification('Error al descargar archivo', 'error');
    }
  }

  async deleteFile(fileId) {
    if (!confirm('¿Estás seguro de eliminar este archivo?')) return;

    try {
      await docuFlowAPI.files.delete(fileId);
      showNotification('Archivo eliminado', 'success');
      this.loadFiles();
      this.updateStats();
    } catch (error) {
      console.error('Delete error:', error);
      showNotification('Error al eliminar archivo', 'error');
    }
  }

  async previewFile(fileId) {
    // TODO: Implement file preview functionality
    showNotification('Vista previa no disponible aún', 'info');
  }
}

// Initialize controller and make it globally available
let uploadController;
document.addEventListener('DOMContentLoaded', () => {
  uploadController = new UploadController();
});
