import { docuFlowAPI, ApiError } from '../../shared/services/apiClient.js';
import { store } from '../../shared/services/store.js';
import { featureFlags } from '../../shared/services/featureFlags.js';
import { enforcePageAuth } from '../../shared/utils/authGuard.js';
import { initializeNavbar, showNotification, Pagination, FormValidator } from '../../shared/utils/uiHelpers.js';

class UploadController {
  constructor() {
    if (!enforcePageAuth({
      message: 'Inicia sesión para gestionar tus archivos en DocuFlow.'
    })) {
      return;
    }

    this.selectedFiles = [];
    this.currentView = 'table'; // table or grid
    this.currentPage = 1;
    this.itemsPerPage = 10;
    this.allFiles = [];
    this.filteredFiles = [];
  this.lastGcsStatsErrorAt = null;
  this.gcsWarningShown = false;
  this.gcsFeatureDisabledNoticeShown = false;
  this.lastStorageUsageBand = null;
  this.demoFilesFilteredNoticeShown = false;
    this.boundDocumentClick = this.handleDocumentClick.bind(this);
    this.pagination = new Pagination('paginationContainer', {
      itemsPerPage: this.itemsPerPage,
      onPageChange: (page) => {
        this.currentPage = page;
        this.renderFiles();
        this.updateShowingCount();
      }
    });
    this.itemsPerPage = this.pagination.getItemsPerPage();
    document.addEventListener('click', this.boundDocumentClick, true);
    
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

      const info = document.createElement('div');
      info.className = 'file-info';

      const iconWrapper = document.createElement('div');
      iconWrapper.className = `file-icon ${fileIcon.class}`;
      iconWrapper.innerHTML = fileIcon.icon;

      const details = document.createElement('div');
      details.className = 'file-details';
      const title = document.createElement('h6');
      title.textContent = file.name;
      const size = document.createElement('small');
      size.textContent = fileSize;
      details.append(title, size);

      info.append(iconWrapper, details);

      const removeButton = document.createElement('button');
      removeButton.className = 'file-remove';
      removeButton.type = 'button';
      removeButton.dataset.uploadAction = 'remove-selected';
      removeButton.dataset.index = String(index);
      removeButton.innerHTML = '<i class="bi bi-x"></i>';

      fileElement.append(info, removeButton);
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

      const normalizedFiles = files
        .map(file => this.normalizeFile(file))
        .filter(Boolean);

      this.allFiles = this.stripDemoFiles(normalizedFiles);
      store.setFiles(this.allFiles);
      console.log('📁 Archivos cargados:', this.allFiles.length);
      
      this.filterFiles();
    } catch (error) {
      console.error('Error loading files:', error);
      showNotification('Error al cargar archivos', 'error');
      this.allFiles = [];
      store.setFiles([]);
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

      const selectCell = document.createElement('td');
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.className = 'form-check-input file-checkbox';
      checkbox.dataset.fileId = file.id;
      selectCell.appendChild(checkbox);

      const nameCell = document.createElement('td');
      const nameWrapper = document.createElement('div');
      nameWrapper.className = 'file-name';
      const icon = document.createElement('i');
      icon.className = this.getFileIconClass(file.filename);
      const nameSpan = document.createElement('span');
      nameSpan.textContent = file.filename;
      nameWrapper.append(icon, nameSpan);
      nameCell.appendChild(nameWrapper);

      const sizeCell = document.createElement('td');
      sizeCell.textContent = this.formatFileSize(file.size || 0);

      const dateCell = document.createElement('td');
      dateCell.textContent = new Date(file.uploadDate || Date.now()).toLocaleDateString();

      const uploaderCell = document.createElement('td');
      uploaderCell.textContent = file.uploader || 'Usuario';

      const actionsCell = document.createElement('td');
      const actionsWrapper = document.createElement('div');
      actionsWrapper.className = 'file-actions';

      const downloadBtn = document.createElement('button');
      downloadBtn.type = 'button';
      downloadBtn.className = 'action-btn download';
      downloadBtn.title = 'Descargar';
      downloadBtn.dataset.uploadAction = 'download';
      downloadBtn.dataset.fileId = file.id;
      downloadBtn.dataset.fileName = file.filename;
      downloadBtn.innerHTML = '<i class="bi bi-download"></i>';

      const previewBtn = document.createElement('button');
      previewBtn.type = 'button';
      previewBtn.className = 'action-btn preview';
      previewBtn.title = 'Vista previa';
      previewBtn.dataset.uploadAction = 'preview';
      previewBtn.dataset.fileId = file.id;
      previewBtn.innerHTML = '<i class="bi bi-eye"></i>';

      const deleteBtn = document.createElement('button');
      deleteBtn.type = 'button';
      deleteBtn.className = 'action-btn delete';
      deleteBtn.title = 'Eliminar';
      deleteBtn.dataset.uploadAction = 'delete';
      deleteBtn.dataset.fileId = file.id;
      deleteBtn.innerHTML = '<i class="bi bi-trash"></i>';

      actionsWrapper.append(downloadBtn, previewBtn, deleteBtn);
      actionsCell.appendChild(actionsWrapper);

      row.append(selectCell, nameCell, sizeCell, dateCell, uploaderCell, actionsCell);
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
      const cardColumn = document.createElement('div');
      cardColumn.className = 'col-md-6 col-xl-4 mb-3';

      const card = document.createElement('div');
      card.className = 'file-card card-modern h-100';

      const header = document.createElement('div');
      header.className = 'file-card-header d-flex align-items-center gap-2';
      const icon = document.createElement('i');
      icon.className = this.getFileIconClass(file.filename);
      const titleWrapper = document.createElement('div');
      titleWrapper.className = 'file-card-title';
      const title = document.createElement('h6');
      title.className = 'mb-0';
      title.textContent = file.filename;
      const size = document.createElement('small');
      size.className = 'text-muted';
      size.textContent = this.formatFileSize(file.size || 0);
      titleWrapper.append(title, size);
      header.append(icon, titleWrapper);

      const body = document.createElement('div');
      body.className = 'file-card-body';
      const uploader = document.createElement('p');
      uploader.className = 'mb-1';
      uploader.innerHTML = `<i class="bi bi-person me-2"></i>${file.uploader || 'Usuario'}`;
      const date = document.createElement('p');
      date.className = 'mb-1';
      date.innerHTML = `<i class="bi bi-calendar me-2"></i>${new Date(file.uploadDate || Date.now()).toLocaleDateString()}`;
      body.append(uploader, date);

      const actions = document.createElement('div');
      actions.className = 'file-card-actions d-flex gap-2';

      const downloadBtn = document.createElement('button');
      downloadBtn.type = 'button';
      downloadBtn.className = 'btn btn-sm btn-outline-modern flex-fill';
      downloadBtn.dataset.uploadAction = 'download';
      downloadBtn.dataset.fileId = file.id;
      downloadBtn.dataset.fileName = file.filename;
      downloadBtn.innerHTML = '<i class="bi bi-download"></i> Descargar';

      const previewBtn = document.createElement('button');
      previewBtn.type = 'button';
      previewBtn.className = 'btn btn-sm btn-outline-modern flex-fill';
      previewBtn.dataset.uploadAction = 'preview';
      previewBtn.dataset.fileId = file.id;
      previewBtn.innerHTML = '<i class="bi bi-eye"></i> Vista previa';

      const deleteBtn = document.createElement('button');
      deleteBtn.type = 'button';
      deleteBtn.className = 'btn btn-sm btn-outline-danger flex-fill';
      deleteBtn.dataset.uploadAction = 'delete';
      deleteBtn.dataset.fileId = file.id;
      deleteBtn.innerHTML = '<i class="bi bi-trash"></i> Eliminar';

      actions.append(downloadBtn, previewBtn, deleteBtn);

      card.append(header, body, actions);
      cardColumn.appendChild(card);
      grid.appendChild(cardColumn);
    });
  }

  handleDocumentClick(event) {
    const trigger = event.target.closest('[data-upload-action]');
    if (!trigger) return;

    const action = trigger.dataset.uploadAction;
    const fileId = trigger.dataset.fileId;
    const fileName = trigger.dataset.fileName;

    switch (action) {
      case 'remove-selected': {
        const index = Number(trigger.dataset.index);
        if (!Number.isNaN(index)) {
          this.removeFile(index);
        }
        break;
      }
      case 'download':
        if (fileId) {
          this.downloadFile(fileId, fileName);
        }
        break;
      case 'preview':
        if (fileId) {
          this.previewFile(fileId);
        }
        break;
      case 'delete':
        if (fileId) {
          this.deleteFile(fileId);
        }
        break;
      case 'cleanup-orphans':
        this.cleanupOrphanedFiles();
        break;
      case 'update-stats':
        this.updateStats();
        break;
      default:
        break;
    }
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

  stripDemoFiles(files = []) {
    const KNOWN_DEMO_NAMES = new Set([
      'documento_importante.pdf',
      'presentacion_q4.pptx',
      'presentación_q4.pptx',
      'reporte_financiero.xlsx',
      'demo_contrato.pdf',
      'archivo_demo.txt'
    ]);

    let removed = 0;

    const sanitizedFiles = files.filter((file) => {
      if (!file) return false;

      if (file.isDemo === true || file.demo === true || file.sample === true || file.placeholder === true) {
        removed++;
        return false;
      }

      const id = (file.id ?? '').toString().toLowerCase();
      if (id.startsWith('demo-') || id.startsWith('sample-')) {
        removed++;
        return false;
      }

      const filename = (file.filename || '').toLowerCase();
      if (KNOWN_DEMO_NAMES.has(filename)) {
        removed++;
        return false;
      }

      return true;
    });

    if (removed > 0 && !this.demoFilesFilteredNoticeShown) {
      showNotification(`Se ocultaron ${removed} archivos de demostración heredados.`, 'info', 4000);
      this.demoFilesFilteredNoticeShown = true;
    }

    return sanitizedFiles;
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
    const totalFilesEl = document.getElementById('total-files');
    const totalSizeEl = document.getElementById('total-size');

    try {
      const stats = await docuFlowAPI.files.getStats();

      if (stats && (stats.totalFiles !== undefined || stats.totalSizeBytes !== undefined || stats.totalSize !== undefined)) {
        const totalFiles = stats.totalFiles ?? stats.count ?? this.allFiles.length;
        const totalSizeBytes = stats.totalSizeBytes ?? stats.totalSize ?? 0;
        const formattedTotalSize = stats.formattedTotalSize || this.formatFileSize(totalSizeBytes);

        if (totalFilesEl) totalFilesEl.textContent = totalFiles;
        if (totalSizeEl) totalSizeEl.textContent = formattedTotalSize;

        console.log(`📊 Estadísticas actualizadas: ${totalFiles} archivos, ${formattedTotalSize}`);
      } else {
        this.applyLocalStatsFallback(totalFilesEl, totalSizeEl);
      }
    } catch (error) {
      console.warn('No se pudieron obtener estadísticas del backend, usando fallback local.', error);
      this.applyLocalStatsFallback(totalFilesEl, totalSizeEl);
    }

    if (featureFlags.isEnabled('gcsStats')) {
      const gcsStats = await this.getGcsStats();
      this.applyGcsStats(gcsStats);
    } else {
      this.applyGcsStats(this.getGcsFallbackStats(), { disabled: true });
      this.notifyGcsFeatureDisabled();
    }
  }

  applyLocalStatsFallback(totalFilesEl, totalSizeEl) {
    const totalFiles = this.allFiles.length;
    const totalSize = this.allFiles.reduce((sum, file) => sum + (file.size || 0), 0);

    if (totalFilesEl) totalFilesEl.textContent = totalFiles;
    if (totalSizeEl) totalSizeEl.textContent = this.formatFileSize(totalSize);

    console.log(`📊 Estadísticas fallback: ${totalFiles} archivos, ${this.formatFileSize(totalSize)}`);
  }

  applyGcsStats(gcsStats, options = {}) {
    const { disabled = false } = options;
    const gcsUsageEl = document.getElementById('gcs-usage');
    const orphanFilesEl = document.getElementById('orphan-files');
    const storageUsedEl = document.getElementById('storage-used');
    const storageAvailableEl = document.getElementById('storage-available');

    const usedStorage = gcsStats?.usedStorage ?? 0;
    const totalStorage = Math.max(gcsStats?.totalStorage ?? 0, usedStorage);
    const orphanedFiles = gcsStats?.orphanedFiles ?? 0;

    const usedLabel = this.formatFileSize(usedStorage);
    const totalLabel = this.formatFileSize(totalStorage || 10737418240);

    if (gcsUsageEl) {
      if (disabled) {
        gcsUsageEl.textContent = 'Desactivado temporalmente';
      } else if (gcsStats?.isFallback) {
        gcsUsageEl.textContent = `${usedLabel} / ${totalLabel} (estimado)`;
      } else {
        gcsUsageEl.textContent = `${usedLabel} / ${totalLabel}`;
      }
    }

    if (orphanFilesEl) {
      orphanFilesEl.textContent = disabled ? '—' : orphanedFiles;
    }

    if (storageUsedEl) {
      storageUsedEl.textContent = disabled ? '--' : usedLabel;
    }

    if (storageAvailableEl) {
      const available = Math.max(totalStorage - usedStorage, 0);
      storageAvailableEl.textContent = disabled ? '--' : this.formatFileSize(available);
    }

    if (disabled || !gcsStats) {
      this.resetStorageIndicator();
      return;
    }

    this.updateStorageIndicator(gcsStats);
  }

  resetStorageIndicator() {
    const storageBar = document.getElementById('storage-usage-bar');
    const storagePercent = document.getElementById('storage-usage-percent');

    if (storageBar) {
      storageBar.style.width = '0%';
      storageBar.className = 'progress-bar bg-secondary';
    }

    if (storagePercent) {
      storagePercent.textContent = '--';
    }

    this.lastStorageUsageBand = null;
  }

  notifyGcsFeatureDisabled() {
    if (this.gcsFeatureDisabledNoticeShown) {
      return;
    }

    showNotification(
      'Las métricas de Google Cloud Storage están desactivadas hasta que el backend exponga el endpoint `/api/gcs/stats`.',
      'info',
      6000
    );
    this.gcsFeatureDisabledNoticeShown = true;
  }

  // Obtener estadísticas de Google Cloud Storage
  async getGcsStats() {
    if (!featureFlags.isEnabled('gcsStats')) {
      return this.getGcsFallbackStats();
    }

    const cooldownMs = 5 * 60 * 1000; // 5 minutos

    if (this.lastGcsStatsErrorAt && (Date.now() - this.lastGcsStatsErrorAt) < cooldownMs) {
      return this.getGcsFallbackStats();
    }

    try {
      const response = await docuFlowAPI.gcs.getStats();

      if (response instanceof ApiError || response?.status >= 500) {
        throw response;
      }

      this.lastGcsStatsErrorAt = null;
      this.gcsWarningShown = false;
      return response.data || response;
    } catch (error) {
      this.lastGcsStatsErrorAt = Date.now();
      if (!this.gcsWarningShown) {
        console.warn('⚠️ No se pudieron obtener estadísticas de GCS:', error);
        showNotification('No pudimos consultar el uso de almacenamiento en la nube (se mostrará un estimado).', 'warning');
        this.gcsWarningShown = true;
      }
      return this.getGcsFallbackStats();
    }
  }

  getGcsFallbackStats() {
    return {
      usedStorage: this.allFiles.reduce((sum, file) => sum + (file.size || 0), 0),
      totalStorage: 10737418240, // 10GB por defecto
      orphanedFiles: 0,
      storageUsagePercent: 0,
      isFallback: true
    };
  }

  // Detectar archivos huérfanos
  async detectOrphanedFiles() {
    if (!featureFlags.isEnabled('gcsStats')) {
      this.notifyGcsFeatureDisabled();
      return [];
    }

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
    if (!featureFlags.isEnabled('gcsStats')) {
      this.notifyGcsFeatureDisabled();
      return;
    }

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
    const storageBar = document.getElementById('storage-usage-bar');
    const storagePercent = document.getElementById('storage-usage-percent');
    
    if (!gcsStats || !gcsStats.totalStorage) {
      this.resetStorageIndicator();
      return;
    }

    const rawPercent = gcsStats.storageUsagePercent ?? ((gcsStats.usedStorage / gcsStats.totalStorage) * 100);
    const usagePercent = Number.isFinite(rawPercent) ? rawPercent : 0;

    if (storageBar) {
      storageBar.style.width = `${Math.min(usagePercent, 100)}%`;

      if (gcsStats.isFallback) {
        storageBar.className = 'progress-bar bg-secondary';
      } else if (usagePercent > 90) {
        storageBar.className = 'progress-bar bg-danger';
      } else if (usagePercent > 75) {
        storageBar.className = 'progress-bar bg-warning';
      } else {
        storageBar.className = 'progress-bar bg-success';
      }
    }

    if (storagePercent) {
      const prefix = gcsStats.isFallback ? '≈ ' : '';
      storagePercent.textContent = `${prefix}${usagePercent.toFixed(1)}%`;
    }

    if (gcsStats.isFallback) {
      this.lastStorageUsageBand = null;
      return;
    }

    let usageBand = 'normal';
    if (usagePercent > 90) {
      usageBand = 'danger';
    } else if (usagePercent > 75) {
      usageBand = 'warning';
    }

    if (usageBand !== 'normal' && usageBand !== this.lastStorageUsageBand) {
      const warningMessage = usageBand === 'danger'
        ? '⚠️ Almacenamiento casi lleno'
        : '📊 Almacenamiento con uso alto';

      showNotification(warningMessage, 'warning', 5000);
    }

    this.lastStorageUsageBand = usageBand;
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
            <button type="button" class="btn btn-warning" data-upload-action="cleanup-orphans">
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
    if (!featureFlags.isEnabled('gcsStats')) {
      this.notifyGcsFeatureDisabled();
      return;
    }

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
                <button type="button" class="btn btn-warning" id="view-orphaned-files-btn">
                  <i class="bi bi-search me-2"></i>Ver Archivos Huérfanos
                </button>
              ` : ''}
              <button type="button" class="btn btn-primary" data-upload-action="update-stats">
                <i class="bi bi-arrow-clockwise me-2"></i>Actualizar
              </button>
            </div>
          </div>
        </div>
      `;
      
      document.body.appendChild(modal);
      const bsModal = new bootstrap.Modal(modal);
      bsModal.show();

      const viewOrphansBtn = modal.querySelector('#view-orphaned-files-btn');
      if (viewOrphansBtn) {
        viewOrphansBtn.addEventListener('click', () => this.showOrphanedFilesModal(orphans));
      }
      
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
  window.addEventListener('beforeunload', () => {
    document.removeEventListener('click', uploadController.boundDocumentClick, true);
  });
});
