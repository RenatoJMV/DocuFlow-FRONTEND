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
      // Usar los nuevos endpoints del backend incluyendo GCS
      const [statsResponse, gcsResponse] = await Promise.allSettled([
        docuFlowAPI.files.getStats(),
        this.getGcsStats()
      ]);
      
      console.log('📊 Estadísticas del servidor:', statsResponse);
      console.log('☁️ Estadísticas de GCS:', gcsResponse);
      
      const totalFilesEl = document.getElementById('total-files');
      const totalSizeEl = document.getElementById('total-size');
      const gcsUsageEl = document.getElementById('gcs-usage');
      const orphanFilesEl = document.getElementById('orphan-files');

      // Procesar estadísticas básicas
      if (statsResponse.status === 'fulfilled' && statsResponse.value && 
          (statsResponse.value.totalFiles !== undefined || statsResponse.value.totalSizeBytes !== undefined)) {
        const stats = statsResponse.value;
        const totalFiles = stats.totalFiles ?? stats.count ?? this.allFiles.length;
        const totalSizeBytes = stats.totalSizeBytes ?? stats.totalSize ?? 0;
        const formattedTotalSize = stats.formattedTotalSize || this.formatFileSize(totalSizeBytes);

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

      // Procesar estadísticas de GCS
      if (gcsResponse.status === 'fulfilled' && gcsResponse.value) {
        const gcsStats = gcsResponse.value;
        
        if (gcsUsageEl) {
          gcsUsageEl.textContent = `${this.formatFileSize(gcsStats.usedStorage)} / ${this.formatFileSize(gcsStats.totalStorage)}`;
        }
        
        if (orphanFilesEl) {
          orphanFilesEl.textContent = gcsStats.orphanedFiles || 0;
        }

        // Actualizar indicadores visuales
        this.updateStorageIndicator(gcsStats);
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

  // Obtener estadísticas de Google Cloud Storage
  async getGcsStats() {
    try {
      // Usar el nuevo GcsController endpoint
      const response = await docuFlowAPI.gcs.getStats();
      return response.data || response;
    } catch (error) {
      console.warn('⚠️ No se pudieron obtener estadísticas de GCS:', error);
      return {
        usedStorage: 0,
        totalStorage: 10737418240, // 10GB por defecto
        orphanedFiles: 0,
        storageUsagePercent: 0
      };
    }
  }

  // Detectar archivos huérfanos
  async detectOrphanedFiles() {
    try {
      showNotification('🔍 Detectando archivos huérfanos...', 'info');
      
      const response = await docuFlowAPI.gcs.getOrphanedFiles();
      const orphanedFiles = response.data || response || [];
      
      if (orphanedFiles.length > 0) {
        this.showOrphanedFilesModal(orphanedFiles);
        showNotification(`⚠️ Se encontraron ${orphanedFiles.length} archivos huérfanos`, 'warning');
      } else {
        showNotification('✅ No se encontraron archivos huérfanos', 'success');
      }
      
      return orphanedFiles;
    } catch (error) {
      console.error('Error detecting orphaned files:', error);
      showNotification('❌ Error al detectar archivos huérfanos', 'error');
      return [];
    }
  }

  // Limpiar archivos huérfanos
  async cleanupOrphanedFiles(fileIds = []) {
    try {
      if (fileIds.length === 0) {
        // Detectar primero si no se especifican IDs
        const orphanedFiles = await this.detectOrphanedFiles();
        fileIds = orphanedFiles.map(file => file.id);
      }

      if (fileIds.length === 0) {
        showNotification('✅ No hay archivos huérfanos para limpiar', 'info');
        return;
      }

      const confirmed = confirm(`¿Estás seguro de que quieres eliminar ${fileIds.length} archivos huérfanos? Esta acción no se puede deshacer.`);
      
      if (!confirmed) return;

      showNotification('🧹 Limpiando archivos huérfanos...', 'info');

      const response = await docuFlowAPI.gcs.cleanupOrphaned(fileIds);
      
      if (response.success) {
        showNotification(`✅ Se limpiaron ${fileIds.length} archivos huérfanos exitosamente`, 'success');
        
        // Actualizar estadísticas
        this.updateStats();
        
        // Crear notificación del sistema
        if (window.createNotification) {
          window.createNotification('SYSTEM', 'Limpieza completada', 
            `Se eliminaron ${fileIds.length} archivos huérfanos`, 2);
        }
      }

      return response;
    } catch (error) {
      console.error('Error cleaning up orphaned files:', error);
      showNotification('❌ Error durante la limpieza de archivos', 'error');
    }
  }

  // Actualizar indicador visual de almacenamiento
  updateStorageIndicator(gcsStats) {
    const usagePercent = gcsStats.storageUsagePercent || 
      (gcsStats.usedStorage / gcsStats.totalStorage) * 100;
    
    const storageBar = document.getElementById('storage-usage-bar');
    const storagePercent = document.getElementById('storage-usage-percent');
    
    if (storageBar) {
      storageBar.style.width = `${Math.min(usagePercent, 100)}%`;
      
      // Cambiar color según el uso
      if (usagePercent > 90) {
        storageBar.className = 'progress-bar bg-danger';
      } else if (usagePercent > 75) {
        storageBar.className = 'progress-bar bg-warning';
      } else {
        storageBar.className = 'progress-bar bg-success';
      }
    }
    
    if (storagePercent) {
      storagePercent.textContent = `${usagePercent.toFixed(1)}%`;
    }

    // Mostrar advertencia si el almacenamiento está casi lleno
    if (usagePercent > 85) {
      const warningMessage = usagePercent > 95 ? 
        '⚠️ Almacenamiento casi lleno' : 
        '📊 Almacenamiento con uso alto';
      
      showNotification(warningMessage, 'warning', 5000);
    }
  }

  refreshFileList() {
    this.loadFiles();
  }

  async downloadAllSelected() {
    const selectedCheckboxes = Array.from(document.querySelectorAll('.file-checkbox:checked'));
    if (selectedCheckboxes.length === 0) {
      showNotification('Selecciona al menos un archivo para descargar', 'info');
      return;
    }

    try {
      showNotification(`Descargando ${selectedCheckboxes.length} archivos...`, 'info');
      
      // Extraer IDs y nombres de los archivos seleccionados
      const selectedFiles = selectedCheckboxes.map(checkbox => {
        const fileId = checkbox.dataset.fileId;
        const row = checkbox.closest('tr');
        const filename = row.querySelector('.file-name')?.textContent || `archivo_${fileId}`;
        return { fileId, filename };
      });

      // Descargar archivos uno por uno (para evitar saturar el servidor)
      let successCount = 0;
      let errorCount = 0;

      for (const file of selectedFiles) {
        try {
          await this.downloadFile(file.fileId, file.filename);
          successCount++;
          // Pequeña pausa entre descargas
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (error) {
          console.error(`Error descargando ${file.filename}:`, error);
          errorCount++;
        }
      }

      // Mostrar resumen
      if (successCount > 0 && errorCount === 0) {
        showNotification(`${successCount} archivos descargados exitosamente`, 'success');
      } else if (successCount > 0 && errorCount > 0) {
        showNotification(`${successCount} descargados, ${errorCount} con errores`, 'warning');
      } else {
        showNotification('Error en todas las descargas', 'error');
      }

    } catch (error) {
      console.error('Error en descarga múltiple:', error);
      showNotification('Error al procesar las descargas', 'error');
    }
  }

  showFileStatsModal() {
    this.updateStats();
    showNotification('Estadísticas actualizadas', 'success');
  }

  // Modal para mostrar archivos huérfanos
  showOrphanedFilesModal(orphanedFiles) {
    const modal = document.createElement('div');
    modal.className = 'modal fade';
    modal.innerHTML = `
      <div class="modal-dialog modal-lg">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">
              <i class="bi bi-exclamation-triangle text-warning me-2"></i>
              Archivos Huérfanos Detectados
            </h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body">
            <div class="alert alert-warning">
              <i class="bi bi-info-circle me-2"></i>
              Los archivos huérfanos son archivos que existen en Google Cloud Storage pero no tienen 
              referencias en la base de datos. Pueden eliminarse de forma segura.
            </div>
            
            <div class="mb-3">
              <strong>Total encontrados:</strong> ${orphanedFiles.length} archivos
            </div>

            <div class="table-responsive">
              <table class="table table-sm">
                <thead>
                  <tr>
                    <th>Archivo</th>
                    <th>Tamaño</th>
                    <th>Fecha de Creación</th>
                    <th>Bucket</th>
                  </tr>
                </thead>
                <tbody>
                  ${orphanedFiles.map(file => `
                    <tr>
                      <td>
                        <i class="bi bi-file-earmark me-2"></i>
                        ${file.name || file.fileName || 'Archivo sin nombre'}
                      </td>
                      <td>${this.formatFileSize(file.size || 0)}</td>
                      <td>${file.createdAt ? new Date(file.createdAt).toLocaleDateString() : 'Desconocida'}</td>
                      <td>
                        <span class="badge bg-secondary">${file.bucket || 'docuflow-storage'}</span>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cerrar</button>
            <button type="button" class="btn btn-warning" onclick="uploadController.cleanupOrphanedFiles()">
              <i class="bi bi-trash me-2"></i>Limpiar Archivos Huérfanos
            </button>
          </div>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    const bsModal = new bootstrap.Modal(modal);
    bsModal.show();
    
    modal.addEventListener('hidden.bs.modal', () => {
      modal.remove();
    });
  }

  // Modal avanzado de estadísticas GCS
  async showAdvancedStatsModal() {
    try {
      showNotification('📊 Cargando estadísticas avanzadas...', 'info');
      
      const [gcsStats, orphanedFiles] = await Promise.allSettled([
        this.getGcsStats(),
        this.detectOrphanedFiles()
      ]);

      const stats = gcsStats.status === 'fulfilled' ? gcsStats.value : {};
      const orphans = orphanedFiles.status === 'fulfilled' ? orphanedFiles.value : [];

      const modal = document.createElement('div');
      modal.className = 'modal fade';
      modal.innerHTML = `
        <div class="modal-dialog modal-xl">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">
                <i class="bi bi-cloud-arrow-up text-primary me-2"></i>
                Estadísticas Avanzadas - Google Cloud Storage
              </h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
              <!-- Resumen de Almacenamiento -->
              <div class="row mb-4">
                <div class="col-md-6">
                  <div class="card bg-primary text-white">
                    <div class="card-body">
                      <h6 class="card-title">
                        <i class="bi bi-hdd me-2"></i>Almacenamiento Usado
                      </h6>
                      <h3>${this.formatFileSize(stats.usedStorage || 0)}</h3>
                      <small>de ${this.formatFileSize(stats.totalStorage || 10737418240)}</small>
                    </div>
                  </div>
                </div>
                <div class="col-md-6">
                  <div class="card bg-warning text-white">
                    <div class="card-body">
                      <h6 class="card-title">
                        <i class="bi bi-exclamation-triangle me-2"></i>Archivos Huérfanos
                      </h6>
                      <h3>${orphans.length || 0}</h3>
                      <small>archivos sin referencia</small>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Indicador de Uso -->
              <div class="mb-4">
                <h6>Uso del Almacenamiento</h6>
                <div class="progress mb-2" style="height: 20px;">
                  <div class="progress-bar ${this.getStorageColorClass(stats)}" 
                       style="width: ${this.getStoragePercent(stats)}%">
                    ${this.getStoragePercent(stats).toFixed(1)}%
                  </div>
                </div>
                <small class="text-muted">
                  Disponible: ${this.formatFileSize((stats.totalStorage || 10737418240) - (stats.usedStorage || 0))}
                </small>
              </div>

              <!-- Estadísticas Detalladas -->
              <div class="row">
                <div class="col-md-6">
                  <h6>Detalles del Bucket</h6>
                  <table class="table table-sm">
                    <tr>
                      <td>Bucket Principal:</td>
                      <td><span class="badge bg-info">${stats.bucketName || 'docuflow-storage'}</span></td>
                    </tr>
                    <tr>
                      <td>Región:</td>
                      <td>${stats.region || 'us-central1'}</td>
                    </tr>
                    <tr>
                      <td>Clase de Almacenamiento:</td>
                      <td>${stats.storageClass || 'STANDARD'}</td>
                    </tr>
                    <tr>
                      <td>Total de Objetos:</td>
                      <td>${stats.totalObjects || 0}</td>
                    </tr>
                  </table>
                </div>
                <div class="col-md-6">
                  <h6>Métricas de Rendimiento</h6>
                  <table class="table table-sm">
                    <tr>
                      <td>Subidas Hoy:</td>
                      <td>${stats.uploadsToday || 0}</td>
                    </tr>
                    <tr>
                      <td>Descargas Hoy:</td>
                      <td>${stats.downloadsToday || 0}</td>
                    </tr>
                    <tr>
                      <td>Último Backup:</td>
                      <td>${stats.lastBackup ? new Date(stats.lastBackup).toLocaleString() : 'N/A'}</td>
                    </tr>
                    <tr>
                      <td>Estado del Servicio:</td>
                      <td>
                        <span class="badge bg-success">
                          <i class="bi bi-check-circle me-1"></i>Operativo
                        </span>
                      </td>
                    </tr>
                  </table>
                </div>
              </div>

              ${orphans.length > 0 ? `
                <div class="alert alert-warning mt-3">
                  <i class="bi bi-exclamation-triangle me-2"></i>
                  <strong>Atención:</strong> Se detectaron ${orphans.length} archivos huérfanos que 
                  pueden eliminarse para liberar espacio.
                </div>
              ` : ''}
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cerrar</button>
              ${orphans.length > 0 ? `
                <button type="button" class="btn btn-warning" 
                        onclick="uploadController.showOrphanedFilesModal(${JSON.stringify(orphans).replace(/"/g, '&quot;')})">
                  <i class="bi bi-search me-2"></i>Ver Archivos Huérfanos
                </button>
              ` : ''}
              <button type="button" class="btn btn-primary" onclick="uploadController.updateStats()">
                <i class="bi bi-arrow-clockwise me-2"></i>Actualizar
              </button>
            </div>
          </div>
        </div>
      `;
      
      document.body.appendChild(modal);
      const bsModal = new bootstrap.Modal(modal);
      bsModal.show();
      
      modal.addEventListener('hidden.bs.modal', () => {
        modal.remove();
      });

    } catch (error) {
      console.error('Error showing advanced stats:', error);
      showNotification('❌ Error al cargar estadísticas avanzadas', 'error');
    }
  }

  // Métodos auxiliares para las estadísticas
  getStoragePercent(stats) {
    if (!stats.usedStorage || !stats.totalStorage) return 0;
    return (stats.usedStorage / stats.totalStorage) * 100;
  }

  getStorageColorClass(stats) {
    const percent = this.getStoragePercent(stats);
    if (percent > 90) return 'bg-danger';
    if (percent > 75) return 'bg-warning';
    return 'bg-success';
  }

  async downloadFile(fileId, filename) {
    try {
      showNotification('Iniciando descarga...', 'info', 1000);
      
      // Usar endpoint real del backend Spring Boot para descarga
      const response = await docuFlowAPI.get(`/files/${fileId}/download`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });
      
      // Si el response es un blob, usarlo directamente
      let blob;
      if (response instanceof Blob) {
        blob = response;
      } else {
        // Si es otro tipo de respuesta, intentar convertir
        const arrayBuffer = response.arrayBuffer ? await response.arrayBuffer() : response;
        blob = new Blob([arrayBuffer]);
      }
      
      // Crear enlace de descarga
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename || 'archivo_descargado';
      document.body.appendChild(a);
      a.click();
      
      // Limpiar recursos
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      showNotification(`Archivo "${filename}" descargado exitosamente`, 'success');
      
      // Registrar descarga en logs si es necesario
      console.log(`✅ Archivo descargado: ${filename} (ID: ${fileId})`);
      
    } catch (error) {
      console.error('Error descargando archivo:', error);
      
      if (error.status === 404) {
        showNotification('Archivo no encontrado en el servidor', 'error');
      } else if (error.status === 403) {
        showNotification('Sin permisos para descargar este archivo', 'error');
      } else {
        showNotification('Error al descargar archivo. Intente nuevamente.', 'error');
      }
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
