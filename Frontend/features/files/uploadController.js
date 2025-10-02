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
    this.pagination = new Pagination('paginationContainer', {
      itemsPerPage: this.itemsPerPage,
      onPageChange: (page) => {
        this.currentPage = page;
        this.renderFiles();
        this.updateShowingCount();
      }
    });
    this.itemsPerPage = this.pagination.getItemsPerPage();
    
    this.initializeComponents();
    this.setupEventListeners();
    this.init(); // Cambiar a método async
  }

  async init() {
    await this.loadFiles();
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
    this.showUploadForm(); // Mostrar el formulario cuando hay archivos
    // Esperamos un poco para que el DOM se actualice, luego actualizamos el botón
    setTimeout(() => {
      this.updateUploadButton();
    }, 10);
  }

  showUploadForm() {
    const uploadForm = document.getElementById('uploadForm');
    if (uploadForm && this.selectedFiles.length > 0) {
      uploadForm.style.display = 'block';
    }
  }

  hideUploadForm() {
    const uploadForm = document.getElementById('uploadForm');
    if (uploadForm && this.selectedFiles.length === 0) {
      uploadForm.style.display = 'none';
    }
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
    if (this.selectedFiles.length === 0) {
      this.hideUploadForm();
    }
    this.updateUploadButton();
  }

  updateUploadButton() {
    const uploadBtn = document.getElementById('uploadBtn');
    if (!uploadBtn) {
      console.log('Upload button not found - form may be hidden');
      return; // Safety check
    }
    
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
        e.preventDefault();
        const target = e.currentTarget || btn;
        this.currentView = target.dataset.view || target.getAttribute('data-view') || 'table';
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
    if (!uploadBtn) {
      console.error('Upload button not found!');
      return;
    }
    
    const originalText = uploadBtn.innerHTML;
    
    try {
      uploadBtn.disabled = true;
      uploadBtn.innerHTML = '<i class="bi bi-arrow-clockwise spin me-2"></i>Subiendo...';

      // Show progress
      const progressContainer = document.getElementById('uploadProgress');
      const progressBar = progressContainer?.querySelector('.progress-bar');
      if (progressContainer) progressContainer.style.display = 'block';

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

      const files = Array.isArray(response)
        ? response
        : Array.isArray(response?.files)
          ? response.files
          : Array.isArray(response?.data)
            ? response.data
            : Array.isArray(response?.content)
              ? response.content
              : [];

      this.allFiles = files
        .map(file => this.normalizeFile(file))
        .filter(Boolean);
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
      (file.filename || '').toLowerCase().includes(searchTerm)
    );

    this.currentPage = 1;
    this.renderFiles();
    this.updatePagination();
    this.updateStats(); // Actualizar estadísticas después de filtrar
  }

  renderFiles() {
    const itemsPerPage = this.getItemsPerPage();
    const startIndex = (this.currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const filesToShow = this.filteredFiles.slice(startIndex, endIndex);

    if (this.currentView === 'table') {
      this.renderTableView(filesToShow);
    } else {
      this.renderGridView(filesToShow);
    }

    this.updateShowingCount();
    if (this.pagination) {
      this.pagination.currentPage = this.currentPage;
      this.pagination.render(this.filteredFiles.length);
    }
  }

  getItemsPerPage() {
    if (this.pagination && typeof this.pagination.getItemsPerPage === 'function') {
      return this.pagination.getItemsPerPage();
    }
    return this.itemsPerPage || 10;
  }

  renderTableView(files) {
    const tableContainer = document.getElementById('tableView');
    const gridContainer = document.getElementById('gridViewContainer');
    
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
    const tableContainer = document.getElementById('tableView');
    const gridContainer = document.getElementById('gridViewContainer');
    const grid = document.getElementById('filesGrid');

    if (!gridContainer || !grid) {
      this.renderTableView(files);
      return;
    }

    if (tableContainer) tableContainer.style.display = 'none';
    gridContainer.style.display = 'block';

    grid.innerHTML = '';

    if (files.length === 0) {
      grid.innerHTML = `
        <div class="col-12">
          <div class="empty-state text-center py-5">
            <i class="bi bi-folder-x display-4 text-muted mb-3"></i>
            <h5 class="text-muted">No hay archivos</h5>
            <p class="text-muted">Sube tu primer archivo para comenzar</p>
          </div>
        </div>
      `;
      return;
    }

    files.forEach(file => {
      const card = document.createElement('div');
      card.className = 'col-md-6 col-xl-4 mb-3';
      card.innerHTML = `
        <div class="file-card card-modern h-100">
          <div class="file-card-header d-flex align-items-center gap-2">
            <i class="${this.getFileIconClass(file.filename)}"></i>
            <div class="file-card-title">
              <h6 class="mb-0">${file.filename}</h6>
              <small class="text-muted">${this.formatFileSize(file.size || 0)}</small>
            </div>
          </div>
          <div class="file-card-body">
            <p class="mb-1"><i class="bi bi-person me-2"></i>${file.uploader || 'Usuario'}</p>
            <p class="mb-1"><i class="bi bi-calendar me-2"></i>${new Date(file.uploadDate || Date.now()).toLocaleDateString()}</p>
          </div>
          <div class="file-card-actions d-flex gap-2">
            <button class="btn btn-sm btn-outline-modern flex-fill" onclick="uploadController.downloadFile('${file.id}', '${file.filename}')">
              <i class="bi bi-download"></i> Descargar
            </button>
            <button class="btn btn-sm btn-outline-modern flex-fill" onclick="uploadController.previewFile('${file.id}')">
              <i class="bi bi-eye"></i> Vista previa
            </button>
            <button class="btn btn-sm btn-outline-danger flex-fill" onclick="uploadController.deleteFile('${file.id}')">
              <i class="bi bi-trash"></i> Eliminar
            </button>
          </div>
        </div>
      `;
      grid.appendChild(card);
    });
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

  normalizeFile(file) {
    if (!file) return null;

    const filename = file.filename || file.name || file.originalFilename || 'archivo_sin_nombre';
    const uploadDate = file.uploadDate || file.createdAt || file.updatedAt || file.timestamp;
    const uploader = file.uploader || file.uploadedBy || file.owner || file.user || 'Usuario';

    return {
      ...file,
      id: file.id ?? file.fileId ?? file.uuid ?? filename,
      filename,
      size: file.size ?? file.fileSize ?? file.bytes ?? 0,
      uploadDate,
      uploader
    };
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
    if (!this.pagination) return;

    this.pagination.itemsPerPage = this.getItemsPerPage();
    this.pagination.currentPage = this.currentPage;
    this.pagination.onPageChange = (page) => {
      this.currentPage = page;
      this.renderFiles();
    };

    this.pagination.render(this.filteredFiles.length);
  }

  updateShowingCount() {
    const showingElement = document.getElementById('showingCount');
    const totalElement = document.getElementById('totalCount');
    
    if (showingElement && totalElement) {
      const itemsPerPage = this.getItemsPerPage();
      const startIndex = (this.currentPage - 1) * itemsPerPage;
      const endIndex = Math.min(startIndex + itemsPerPage, this.filteredFiles.length);
      
      showingElement.textContent = this.filteredFiles.length > 0 ? `${startIndex + 1}-${endIndex}` : '0';
      totalElement.textContent = this.filteredFiles.length;
    }
  }

  async updateStats() {
    try {
      // Usar los nuevos endpoints del backend
      const statsResponse = await docuFlowAPI.files.getStats();
      console.log('📊 Estadísticas del servidor:', statsResponse);
      
      const totalFilesEl = document.getElementById('total-files');
      const totalSizeEl = document.getElementById('total-size');

      if (statsResponse && (statsResponse.totalFiles !== undefined || statsResponse.totalSizeBytes !== undefined)) {
        const totalFiles = statsResponse.totalFiles ?? statsResponse.count ?? this.allFiles.length;
        const totalSizeBytes = statsResponse.totalSizeBytes ?? statsResponse.totalSize ?? 0;
        const formattedTotalSize = statsResponse.formattedTotalSize || this.formatFileSize(totalSizeBytes);

        if (totalFilesEl) totalFilesEl.textContent = totalFiles;
        if (totalSizeEl) totalSizeEl.textContent = formattedTotalSize;
        
        console.log(`📊 Estadísticas actualizadas: ${totalFiles} archivos, ${formattedTotalSize}`);
      } else {
        // Fallback: calcular desde los archivos cargados
        const totalFiles = this.allFiles.length;
        const totalSize = this.allFiles.reduce((sum, file) => sum + (file.size || 0), 0);
        
        if (totalFilesEl) totalFilesEl.textContent = totalFiles;
        if (totalSizeEl) totalSizeEl.textContent = this.formatFileSize(totalSize);
        
        console.log(`📊 Estadísticas fallback: ${totalFiles} archivos, ${this.formatFileSize(totalSize)}`);
      }
      
    } catch (error) {
      console.error('Error updating stats:', error);
      // Fallback en caso de error
      const totalFiles = this.allFiles.length;
      const totalSize = this.allFiles.reduce((sum, file) => sum + (file.size || 0), 0);
      
      const totalFilesEl = document.getElementById('total-files');
      const totalSizeEl = document.getElementById('total-size');
      
      if (totalFilesEl) totalFilesEl.textContent = totalFiles;
      if (totalSizeEl) totalSizeEl.textContent = this.formatFileSize(totalSize);
    }
  }

  refreshFileList() {
    this.loadFiles();
  }

  downloadAllSelected() {
    const selected = Array.from(document.querySelectorAll('.file-checkbox:checked'));
    if (selected.length === 0) {
      showNotification('Selecciona al menos un archivo para descargar', 'info');
      return;
    }
    showNotification('Descarga múltiple disponible próximamente', 'info');
  }

  showFileStatsModal() {
    this.updateStats();
    showNotification('Estadísticas actualizadas', 'success');
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
  
  // Exponer métodos específicos globalmente para onclick handlers
  window.uploadController = {
    downloadFile: (fileId) => uploadController.downloadFile(fileId),
    deleteFile: (fileId) => uploadController.deleteFile(fileId),
    openPreviewModal: (fileId) => uploadController.previewFile(fileId),
    removeFile: (index) => uploadController.removeFile(index),
    refreshFileList: () => uploadController.refreshFileList(),
    downloadAllSelected: () => uploadController.downloadAllSelected(),
    showFileStatsModal: () => uploadController.showFileStatsModal()
  };
});
