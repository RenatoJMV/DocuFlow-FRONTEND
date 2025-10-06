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

    // Estado para la pestaña de sincronización con GCS
    this.activeTab = 'library';
    this.gcsSetupInitialized = false;
    this.gcsDataLoaded = false;
    this.gcsPageSize = 10;
    this.gcsCurrentPage = 1;
    this.gcsTotalOrphans = 0;
    this.gcsOrphanedFiles = [];
    this.gcsSelected = new Set();
    this.gcsPagination = null;
    this.gcsStatsReady = null;
    this.latestGcsStats = null;
    this.lastGcsStatsFetchedAt = 0;
    this.lastGcsError = null;
    this.gcsActionsEnabled = false;
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
    await this.updateStats();
  }

  initializeComponents() {
    // Create navbar
    initializeNavbar('upload');
    
    // Initialize drag & drop
    this.setupDragAndDrop();

    // Configurar pestañas y sección de sincronización
    this.initializeTabs();
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

  initializeTabs() {
    this.libraryTabButton = document.getElementById('libraryTabButton');
    this.gcsTabButton = document.getElementById('gcsTabButton');
    this.libraryTabContent = document.getElementById('libraryTabContent');
    this.gcsTabContent = document.getElementById('gcsSyncSection');

    this.libraryTabButton?.addEventListener('click', () => this.switchTab('library'));

    if (this.isAdminUser() && this.gcsTabButton && this.gcsTabContent) {
      this.gcsTabButton.classList.remove('d-none');
      this.gcsTabButton.addEventListener('click', () => this.switchTab('gcs'));
      this.setupGcsSyncSection();
    } else {
      this.gcsTabContent?.classList.add('d-none');
    }

    this.updateTabVisibility();
  }

  isAdminUser() {
    try {
      const user = typeof store.getState === 'function'
        ? (store.getState('user') ?? store.getState()?.user)
        : (store.state?.user ?? null);

      if (user) {
        return this.evaluateAdminRole(user);
      }

      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        try {
          const parsed = JSON.parse(storedUser);
          store.setUser?.(parsed);
          return this.evaluateAdminRole(parsed);
        } catch (parseError) {
          console.warn('No fue posible leer el usuario almacenado:', parseError);
        }
      }

      return false;
    } catch (error) {
      console.warn('No fue posible determinar el rol del usuario:', error);
      return false;
    }
  }

  evaluateAdminRole(user) {
    if (!user) return false;

    const directRole = typeof user.role === 'string' ? user.role.toLowerCase() : '';
    if (directRole === 'admin' || directRole === 'administrator') {
      return true;
    }

    const roles = Array.isArray(user.roles) ? user.roles : [];
    if (roles.some(role => typeof role === 'string' && role.toLowerCase() === 'admin')) {
      return true;
    }

    const permissions = Array.isArray(user.permissions) ? user.permissions : [];
    return permissions.includes('ADMIN') || permissions.includes('SUPER_ADMIN');
  }

  updateTabVisibility() {
    const map = [
      { key: 'library', button: this.libraryTabButton, content: this.libraryTabContent }
    ];

    if (this.gcsTabButton && this.gcsTabContent && this.isAdminUser()) {
      map.push({ key: 'gcs', button: this.gcsTabButton, content: this.gcsTabContent });
    }

    map.forEach(({ key, button, content }) => {
      if (!button || !content) return;
      if (this.activeTab === key) {
        button.classList.add('active');
        content.classList.remove('d-none');
      } else {
        button.classList.remove('active');
        content.classList.add('d-none');
      }
    });
  }

  switchTab(tabKey) {
    if (this.activeTab === tabKey) {
      this.updateTabVisibility();
    } else {
      this.activeTab = tabKey;
      this.updateTabVisibility();
    }

    if (tabKey === 'gcs' && this.isAdminUser()) {
      if (!this.gcsSetupInitialized) {
        this.setupGcsSyncSection();
      }
      if (!this.gcsDataLoaded) {
        this.loadGcsSyncData().catch(error => {
          console.error('Error al cargar datos de sincronización GCS:', error);
          showNotification('No se pudieron cargar los datos de sincronización', 'error');
        });
      }
    }
  }

  setupGcsSyncSection() {
    if (this.gcsSetupInitialized || !this.isAdminUser()) {
      return;
    }

    this.gcsSetupInitialized = true;

    this.gcsTabButton?.classList.remove('d-none');
    this.gcsTabContent?.classList.remove('d-none');

    this.gcsTableBody = document.getElementById('gcsTableBody');
    this.gcsSelectAllCheckbox = document.getElementById('gcsSelectAll');
    this.gcsSelectedCountEl = document.getElementById('gcsSelectedCount');
    this.gcsTotalOrphansEl = document.getElementById('gcsTotalOrphans');
    this.gcsEmptyState = document.getElementById('gcsOrphanedEmptyState');
    this.gcsLoadingOverlay = document.getElementById('gcsSyncLoading');
    this.gcsDeleteSelectedButton = document.getElementById('gcsDeleteSelectedButton');
    this.gcsReconcileButton = document.getElementById('gcsReconcileButton');
    this.gcsStatusBanner = document.getElementById('gcsStatusBanner');
    this.gcsStatusMessage = document.getElementById('gcsStatusMessage');
    this.gcsRetryButton = document.getElementById('gcsRetryButton');

    this.gcsPagination = new Pagination('gcsPaginationContainer', {
      itemsPerPage: this.gcsPageSize,
      onPageChange: (page) => this.handleGcsPageChange(page)
    });

    this.gcsRetryButton?.addEventListener('click', () => {
      this.loadGcsSyncData({ refreshStats: true, page: 1, forceRefresh: true });
    });

    this.setGcsActionsEnabled(false);

    this.gcsReconcileButton?.addEventListener('click', () => this.handleGcsReconcile());
    this.gcsDeleteSelectedButton?.addEventListener('click', () => this.handleGcsCleanup());
    this.gcsSelectAllCheckbox?.addEventListener('change', (event) => {
      this.applyGcsSelectAll(event.target.checked);
    });

    this.gcsTableBody?.addEventListener('change', (event) => {
      const checkbox = event.target.closest('input[type="checkbox"][data-file-name]');
      if (!checkbox) return;

      const { fileName } = checkbox.dataset;
      if (!fileName) return;

      if (checkbox.checked) {
        this.gcsSelected.add(fileName);
      } else {
        this.gcsSelected.delete(fileName);
      }

      this.syncGcsSelectAllState();
      this.updateGcsSelectionInfo();
    });

    this.gcsTableBody?.addEventListener('click', (event) => {
      const actionBtn = event.target.closest('[data-gcs-action]');
      if (!actionBtn) return;

      const action = actionBtn.dataset.gcsAction;
      const row = actionBtn.closest('tr');
      this.handleGcsRowAction(action, row);
    });

    this.updateGcsSelectionInfo();
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

  parseDateValue(dateValue) {
    if (!dateValue && dateValue !== 0) return null;

    if (dateValue instanceof Date) {
      return Number.isNaN(dateValue.getTime()) ? null : dateValue;
    }

    if (typeof dateValue === 'number') {
      const normalizedNumber = dateValue < 1e12 ? dateValue * 1000 : dateValue;
      const dateFromNumber = new Date(normalizedNumber);
      return Number.isNaN(dateFromNumber.getTime()) ? null : dateFromNumber;
    }

    if (typeof dateValue === 'string') {
      let normalized = dateValue.trim();
      if (!normalized || normalized.toLowerCase() === 'null') {
        return null;
      }

      if (/^\d+$/.test(normalized)) {
        const epoch = Number(normalized);
        const dateFromEpoch = new Date(epoch < 1e12 ? epoch * 1000 : epoch);
        if (!Number.isNaN(dateFromEpoch.getTime())) {
          return dateFromEpoch;
        }
      }

      const candidates = new Set([normalized]);

      if (normalized.includes(' ')) {
        candidates.add(normalized.replace(' ', 'T'));
      }

      const hasTimezone = /[zZ]$/.test(normalized) || /[\+\-]\d{2}:?\d{2}$/.test(normalized);
      if (!hasTimezone) {
        candidates.add(`${normalized}Z`);
        if (normalized.includes(' ')) {
          candidates.add(`${normalized.replace(' ', 'T')}Z`);
        }
      }

      for (const candidate of candidates) {
        const dateFromCandidate = new Date(candidate);
        if (!Number.isNaN(dateFromCandidate.getTime())) {
          return dateFromCandidate;
        }
      }
    }

    return null;
  }

  formatDisplayDate(dateValue) {
    const date = this.parseDateValue(dateValue);
    if (!date) return '—';
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  formatRelativeDate(dateValue) {
    const date = this.parseDateValue(dateValue);
    if (!date) return 'Fecha desconocida';

    const now = new Date();
    const diffMs = now - date;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return 'Hoy';
    }

    if (diffDays === 1) {
      return 'Hace 1 día';
    }

    if (diffDays < 7) {
      return `Hace ${diffDays} días`;
    }

    return date.toLocaleDateString();
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
      if (error instanceof ApiError) {
        if (error.status === 400) {
          showNotification('El archivo no cumple con los requisitos de validación.', 'warning');
        } else if (error.status === 401) {
          showNotification('Tu sesión expiró. Inicia sesión nuevamente para subir archivos.', 'error');
        } else if (error.status === 403) {
          showNotification('No tienes permisos suficientes para subir archivos.', 'error');
        } else if (error.status === 413) {
          showNotification('El archivo supera el límite permitido por el backend.', 'warning');
        } else if (error.status === 415) {
          showNotification('Formato de archivo no permitido. Permitidos: PDF, DOCX, XLSX.', 'warning');
        } else if (error.status === 500) {
          showNotification('El backend devolvió un error (500) al subir el archivo. Reintenta o revisa la configuración de GCS.', 'error');
        } else {
          showNotification(`Error al subir archivos (HTTP ${error.status}).`, 'error');
        }
      } else {
        showNotification('Error al subir archivos', 'error');
      }
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
  this.allFiles = this.sortFilesByRecency(this.allFiles);
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

    this.filteredFiles = this.sortFilesByRecency(this.filteredFiles);

    this.currentPage = 1;
    this.renderFiles();
    this.updatePagination();
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
        dateCell.textContent = this.formatDisplayDate(file.uploadDate);

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
      cardColumn.className = 'col-sm-6 col-xl-3 mb-4';

      const card = document.createElement('div');
      card.className = 'file-grid-card';

      const iconWrapper = document.createElement('div');
      iconWrapper.className = 'file-grid-icon';
      const icon = document.createElement('i');
      icon.className = this.getFileIconClass(file.filename);
      iconWrapper.appendChild(icon);

      const title = document.createElement('div');
      title.className = 'file-grid-name';
      title.title = file.filename;
      title.textContent = file.filename;

      const meta = document.createElement('div');
      meta.className = 'file-grid-meta';
      meta.innerHTML = `
        <span>${this.formatFileSize(file.size || 0)}</span>
        <span>${this.formatRelativeDate(file.uploadDate)}</span>
      `;

      const actions = document.createElement('div');
      actions.className = 'file-grid-actions';

      const downloadBtn = document.createElement('button');
      downloadBtn.type = 'button';
      downloadBtn.className = 'file-grid-btn';
      downloadBtn.dataset.uploadAction = 'download';
      downloadBtn.dataset.fileId = file.id;
      downloadBtn.dataset.fileName = file.filename;
      downloadBtn.innerHTML = '<i class="bi bi-download"></i>';

      const previewBtn = document.createElement('button');
      previewBtn.type = 'button';
      previewBtn.className = 'file-grid-btn';
      previewBtn.dataset.uploadAction = 'preview';
      previewBtn.dataset.fileId = file.id;
      previewBtn.innerHTML = '<i class="bi bi-eye"></i>';

      const deleteBtn = document.createElement('button');
      deleteBtn.type = 'button';
      deleteBtn.className = 'file-grid-btn danger';
      deleteBtn.dataset.uploadAction = 'delete';
      deleteBtn.dataset.fileId = file.id;
      deleteBtn.innerHTML = '<i class="bi bi-trash"></i>';

      actions.append(downloadBtn, previewBtn, deleteBtn);

      card.append(iconWrapper, title, meta, actions);
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
      case 'refresh-files':
        this.refreshFileList();
        break;
      case 'download-selected':
        this.downloadAllSelected();
        break;
      case 'show-advanced-stats':
        this.showAdvancedStatsModal();
        break;
      case 'detect-orphans':
        this.detectOrphanedFiles();
        break;
      case 'trigger-file-input': {
        const fileInput = document.getElementById('fileInput');
        fileInput?.click();
        break;
      }
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

    const metadata = file.metadata
      || file.meta
      || file.fileMetadata
      || file._metadata
      || {};

    const audit = file.audit
      || file.auditInfo
      || file.auditTrail
      || {};

    const rawUploadDate = file.uploadDate
      || file.uploadedAt
      || file.uploaded_at
      || file.createdAt
      || file.created_at
      || file.created
      || file.createdDate
      || file.creationDate
      || file.dateCreated
      || file.updatedAt
      || file.lastModified
      || file.lastModifiedAt
      || file.timestamp
      || metadata.uploadDate
      || metadata.uploadedAt
      || metadata.createdAt
      || metadata.created_at
      || metadata.creationDate
      || metadata.date
      || audit.createdAt
      || audit.timestamp
      || null;

    const parsedUploadDate = this.parseDateValue(rawUploadDate);

    const uploader = file.uploader
      || file.uploadedBy
      || file.uploaded_by
      || file.owner
      || file.ownerName
      || file.createdBy
      || file.created_by
      || file.user
      || metadata.uploader
      || metadata.uploadedBy
      || metadata.createdBy
      || audit.createdBy
      || 'Usuario';

    return {
      ...file,
      id: file.id ?? file.fileId ?? file.uuid ?? filename,
      filename,
      size: file.size ?? file.fileSize ?? file.bytes ?? 0,
      uploadDate: parsedUploadDate ? parsedUploadDate.toISOString() : rawUploadDate,
      uploadDateRaw: rawUploadDate ?? null,
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
      'archivo_demo.txt',
      'documento-prueba.pdf',
      'reporte-mensual.xlsx',
      'imagen-ejemplo.jpg'
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

  sortFilesByRecency(files = []) {
    if (!Array.isArray(files)) {
      return [];
    }

    const sorted = [...files];

    sorted.sort((a, b) => {
      const dateA = this.parseDateValue(a?.uploadDate ?? a?.uploadDateRaw);
      const dateB = this.parseDateValue(b?.uploadDate ?? b?.uploadDateRaw);

      const timeA = dateA ? dateA.getTime() : 0;
      const timeB = dateB ? dateB.getTime() : 0;

      if (timeA === timeB) {
        const nameA = (a?.filename || '').toLowerCase();
        const nameB = (b?.filename || '').toLowerCase();
        return nameA.localeCompare(nameB);
      }

      return timeB - timeA;
    });

    return sorted;
  }

  toNumericValue(value) {
    if (value === null || value === undefined) {
      return null;
    }

    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : null;
    }

    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) {
        return null;
      }

      const sanitized = trimmed.replace(/[^0-9,.-]/g, '').replace(',', '.');
      if (!sanitized || sanitized === '-' || sanitized === '.') {
        return null;
      }

      const parsed = Number(sanitized);
      return Number.isFinite(parsed) ? parsed : null;
    }

    if (Array.isArray(value)) {
      if (value.length === 1) {
        return this.toNumericValue(value[0]);
      }
      return value.length;
    }

    if (typeof value === 'object') {
      for (const key of ['value', 'total', 'count', 'length', 'size', 'amount', 'records', 'items']) {
        if (Object.prototype.hasOwnProperty.call(value, key)) {
          const nested = this.toNumericValue(value[key]);
          if (nested !== null) {
            return nested;
          }
        }
      }
    }

    return null;
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

    const gcsStats = await this.getGcsStats();
    this.applyGcsStats(gcsStats);
    this.updateGcsStatsCards(gcsStats);
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
    const ready = !disabled && gcsStats && gcsStats.ready !== false;
    this.gcsStatsReady = ready;

    if (!ready) {
      const message = gcsStats?.message
        || (gcsStats?.status === 503 ? 'Servicio temporalmente no disponible.' : null)
        || 'El bucket está inicializándose. Intenta nuevamente en unos minutos.';
      const tone = gcsStats?.status === 503 ? 'danger' : 'warning';
      this.showGcsStatusBanner(message, { tone });
      this.setGcsActionsEnabled(false);

      if (gcsUsageEl) gcsUsageEl.textContent = disabled ? 'Desactivado temporalmente' : '—';
      if (orphanFilesEl) orphanFilesEl.textContent = '—';
      if (storageUsedEl) storageUsedEl.textContent = '--';
      if (storageAvailableEl) storageAvailableEl.textContent = '--';

      this.resetStorageIndicator();
      return;
    }

    if (gcsStats?.supportsMetrics === false) {
      this.gcsStatsReady = false;
      this.showGcsStatusBanner('Las métricas de Google Cloud Storage están desactivadas hasta que el backend exponga el endpoint `/api/gcs/stats`.', { tone: 'info' });
      this.setGcsActionsEnabled(false);

      if (gcsUsageEl) gcsUsageEl.textContent = '—';
      if (orphanFilesEl) orphanFilesEl.textContent = '—';
      if (storageUsedEl) storageUsedEl.textContent = '--';
      if (storageAvailableEl) storageAvailableEl.textContent = '--';

      this.resetStorageIndicator();
      return;
    }

    this.hideGcsStatusBanner();
    this.setGcsActionsEnabled(true);

    const usedStorage = gcsStats?.usedStorage ?? 0;
    const totalStorage = Math.max(gcsStats?.totalStorage ?? 0, usedStorage);
    const orphanedFiles = gcsStats?.orphanedFiles ?? 0;

    const usedLabel = this.formatFileSize(usedStorage);
    const totalLabel = this.formatFileSize(totalStorage || 10737418240);

    if (gcsUsageEl) {
      if (gcsStats?.isFallback) {
        gcsUsageEl.textContent = `${usedLabel} / ${totalLabel} (estimado)`;
      } else {
        gcsUsageEl.textContent = `${usedLabel} / ${totalLabel}`;
      }
    }

    if (orphanFilesEl) {
      orphanFilesEl.textContent = orphanedFiles;
    }

    if (storageUsedEl) {
      storageUsedEl.textContent = usedLabel;
    }

    if (storageAvailableEl) {
      const available = Math.max(totalStorage - usedStorage, 0);
      storageAvailableEl.textContent = this.formatFileSize(available);
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

  async loadGcsSyncData(options = {}) {
    if (!this.isAdminUser()) return;

    const { page = this.gcsCurrentPage || 1, refreshStats = true, forceRefresh = false } = options;

    try {
      let stats = this.latestGcsStats;
      if (refreshStats || !stats) {
        stats = await this.loadGcsStatsCards(forceRefresh);
      }

      if (stats?.ready === false) {
        this.gcsStatsReady = false;
        this.renderGcsOrphanedTable([]);
        this.setGcsActionsEnabled(false);
        if (this.gcsTotalOrphansEl) {
          this.gcsTotalOrphansEl.textContent = '—';
        }
        return;
      }

      await this.loadGcsOrphanedFiles(page);
      this.gcsDataLoaded = true;
    } catch (error) {
      console.error('Error al cargar la sincronización GCS:', error);
      showNotification('No pudimos completar la sincronización con GCS.', 'error');
    }
  }

  async loadGcsStatsCards() {
    if (!this.isAdminUser()) return this.latestGcsStats;

    try {
      const stats = await this.getGcsStats({ forceRefresh: true });
      this.applyGcsStats(stats);
      this.updateGcsStatsCards(stats);
      return stats;
    } catch (error) {
      console.warn('No fue posible obtener estadísticas detalladas de GCS.', error);
      const fallback = await this.getGcsStats().catch(() => ({ ready: false }));
      this.updateGcsStatsCards(fallback || {});
      return fallback;
    }
  }

  updateGcsStatsCards(stats = {}) {
    if (!this.gcsSetupInitialized) return;

    const totalGcsEl = document.getElementById('gcsStatTotalGcs');
    const totalDbEl = document.getElementById('gcsStatTotalDb');
    const missingDbEl = document.getElementById('gcsStatMissingInDb');
    const missingGcsEl = document.getElementById('gcsStatMissingInGcs');

    if (stats?.ready === false) {
      if (totalGcsEl) totalGcsEl.textContent = '—';
      if (totalDbEl) totalDbEl.textContent = '—';
      if (missingDbEl) missingDbEl.textContent = '—';
      if (missingGcsEl) missingGcsEl.textContent = '—';
      return;
    }

    const totalGcs = this.toNumericValue(stats.totalGcsObjects)
      ?? this.toNumericValue(stats.totalObjects)
      ?? 0;
    const totalDb = this.toNumericValue(stats.totalDatabaseRecords)
      ?? this.toNumericValue(stats.totalDbEntries)
      ?? 0;
    const missingInDb = this.toNumericValue(stats.missingInDatabase)
      ?? this.toNumericValue(stats.missingInDb)
      ?? 0;
    const missingInGcs = this.toNumericValue(stats.missingInGcs)
      ?? this.toNumericValue(stats.missingObjects)
      ?? 0;

    if (totalGcsEl) totalGcsEl.textContent = totalGcs;
    if (totalDbEl) totalDbEl.textContent = totalDb;
    if (missingDbEl) missingDbEl.textContent = missingInDb;
    if (missingGcsEl) missingGcsEl.textContent = missingInGcs;
  }

  async handleGcsPageChange(page) {
    this.gcsCurrentPage = page;
    await this.loadGcsOrphanedFiles(page);
  }

  async loadGcsOrphanedFiles(page = 1) {
    if (!this.isAdminUser()) return;

    if (this.gcsStatsReady === false) {
      this.renderGcsOrphanedTable([]);
      return;
    }

    this.gcsCurrentPage = page;
    this.toggleGcsLoading(true);

    try {
      const params = {
        page,
        size: this.gcsPageSize,
        pageSize: this.gcsPageSize
      };

      const response = await docuFlowAPI.gcs.getOrphanedFiles(params);
      const { items, total, size, pageNumber } = this.normalizeGcsOrphanedResponse(response, params);

      const safeSize = Number(size) > 0 ? Number(size) : (params.size ?? this.gcsPageSize ?? 10);
      const safePage = Number(pageNumber) > 0 ? Number(pageNumber) : (params.page ?? 1);

      this.gcsOrphanedFiles = items;
      this.gcsTotalOrphans = Number.isFinite(total) ? total : items.length;
      this.gcsCurrentPage = safePage;
      this.gcsPageSize = safeSize;

      if (this.gcsPagination) {
        this.gcsPagination.setItemsPerPage(safeSize);
        this.gcsPagination.currentPage = safePage;
        this.gcsPagination.render(this.gcsTotalOrphans);
      }

      this.renderGcsOrphanedTable(items);

      if (this.gcsTotalOrphansEl) {
        this.gcsTotalOrphansEl.textContent = this.gcsTotalOrphans;
      }
    } catch (error) {
      console.error('Error al obtener archivos huérfanos de GCS:', error);
      showNotification('No se pudieron obtener los archivos huérfanos.', 'error');
      this.renderGcsOrphanedTable([]);
    } finally {
      this.toggleGcsLoading(false);
    }
  }

  normalizeGcsOrphanedResponse(response, fallbackParams) {
  const payload = response?.data ?? response ?? {};
  const preferredSize = fallbackParams?.size ?? fallbackParams?.pageSize ?? this.gcsPageSize ?? 10;
  const defaultSize = Number(preferredSize) > 0 ? Number(preferredSize) : 10;

    if (Array.isArray(payload)) {
      return {
        items: payload,
        total: payload.length,
        size: defaultSize,
        pageNumber: fallbackParams?.page ?? 1
      };
    }

    if (Array.isArray(payload.items)) {
      return {
        items: payload.items,
        total: payload.total ?? payload.totalItems ?? payload.count ?? payload.items.length,
        size: payload.size ?? payload.pageSize ?? payload.limit ?? defaultSize,
        pageNumber: (payload.page ?? payload.currentPage ?? fallbackParams?.page ?? 1)
      };
    }

    if (Array.isArray(payload.content)) {
      const zeroBased = typeof payload.number === 'number';
      return {
        items: payload.content,
        total: payload.totalElements ?? payload.total ?? payload.totalCount ?? payload.content.length,
        size: payload.size ?? payload.pageSize ?? defaultSize,
        pageNumber: zeroBased ? (payload.number + 1) : (payload.page ?? fallbackParams?.page ?? 1)
      };
    }

    if (Array.isArray(payload.results)) {
      return {
        items: payload.results,
        total: payload.total ?? payload.totalResults ?? payload.results.length,
        size: payload.size ?? payload.limit ?? defaultSize,
        pageNumber: payload.page ?? fallbackParams?.page ?? 1
      };
    }

    const items = Array.isArray(payload.orphanedFiles) ? payload.orphanedFiles : [];
    const total = payload.total ?? payload.totalOrphaned ?? items.length;

    return {
      items,
      total,
      size: defaultSize,
      pageNumber: fallbackParams?.page ?? 1
    };
  }

  renderGcsOrphanedTable(items = []) {
    if (!this.gcsTableBody) {
      return;
    }

    this.gcsTableBody.innerHTML = '';

    if (!Array.isArray(items) || items.length === 0) {
      if (this.gcsEmptyState) this.gcsEmptyState.classList.remove('d-none');
      if (this.gcsTableBody) this.gcsTableBody.closest('table')?.classList.add('d-none');
      this.clearGcsSelection();
      this.syncGcsSelectAllState();
      this.updateGcsSelectionInfo();
      return;
    }

    this.gcsTableBody.closest('table')?.classList.remove('d-none');
    if (this.gcsEmptyState) this.gcsEmptyState.classList.add('d-none');

    const fragment = document.createDocumentFragment();

    items.forEach((file) => {
      const name = file?.name || file?.fileName || file?.objectName || file?.path || file?.blobName || file?.id || 'desconocido';
      const size = file?.size ?? file?.sizeBytes ?? file?.contentLength ?? 0;
      const rawUpdatedAt = file?.updatedAt || file?.lastModified || file?.timeCreated || file?.createdAt;
      const contentType = file?.contentType || file?.mimeType || file?.type || 'application/octet-stream';

      // Si el archivo desapareció de la lista, retirarlo de la selección
      if (!this.gcsSelected.has(name)) {
        // noop, solo aseguramos consistencia más adelante
      }

      const row = document.createElement('tr');
      row.dataset.fileName = name;

      const checkboxCell = document.createElement('td');
      checkboxCell.style.width = '48px';
      checkboxCell.innerHTML = `
        <input type="checkbox" class="form-check-input" data-file-name="${name}">
      `;

      const nameCell = document.createElement('td');
      nameCell.innerHTML = `
        <div class="d-flex align-items-center gap-2">
          <i class="bi bi-cloud" aria-hidden="true"></i>
          <span class="text-break">${name}</span>
        </div>
      `;

      const sizeCell = document.createElement('td');
      sizeCell.textContent = this.formatFileSize(size);

      const dateCell = document.createElement('td');
      dateCell.textContent = this.formatGcsDate(rawUpdatedAt);

      const typeCell = document.createElement('td');
      typeCell.innerHTML = this.formatGcsTypeLabel(contentType);

      const actionCell = document.createElement('td');
      actionCell.classList.add('text-end');
      actionCell.innerHTML = `
        <button type="button" class="btn btn-link btn-sm" data-gcs-action="copy-name">
          <i class="bi bi-clipboard"></i> Copiar nombre
        </button>
      `;

      row.append(checkboxCell, nameCell, sizeCell, dateCell, typeCell, actionCell);
      fragment.appendChild(row);

      const checkbox = checkboxCell.querySelector('input[type="checkbox"]');
      if (checkbox && this.gcsSelected.has(name)) {
        checkbox.checked = true;
      }
    });

    // Depurar selección con elementos que ya no existen
    this.gcsSelected.forEach((value) => {
      if (!items.some(file => {
        const name = file?.name || file?.fileName || file?.objectName || file?.path || file?.blobName || file?.id;
        return name === value;
      })) {
        this.gcsSelected.delete(value);
      }
    });

    this.gcsTableBody.appendChild(fragment);
    this.syncGcsSelectAllState();
    this.updateGcsSelectionInfo();
  }

  toggleGcsLoading(show) {
    if (!this.gcsLoadingOverlay) return;
    if (show) {
      this.gcsLoadingOverlay.classList.remove('d-none');
    } else {
      this.gcsLoadingOverlay.classList.add('d-none');
    }
  }

  applyGcsSelectAll(checked) {
    if (!this.gcsTableBody) return;

    const checkboxes = Array.from(this.gcsTableBody.querySelectorAll('input[type="checkbox"][data-file-name]'));
    if (checked) {
      checkboxes.forEach(cb => {
        cb.checked = true;
        if (cb.dataset.fileName) {
          this.gcsSelected.add(cb.dataset.fileName);
        }
      });
    } else {
      checkboxes.forEach(cb => {
        cb.checked = false;
      });
      this.gcsSelected.clear();
    }

    if (this.gcsSelectAllCheckbox) {
      this.gcsSelectAllCheckbox.indeterminate = false;
      this.gcsSelectAllCheckbox.checked = checked && checkboxes.length > 0;
    }

    this.updateGcsSelectionInfo();
  }

  syncGcsSelectAllState() {
    if (!this.gcsSelectAllCheckbox || !this.gcsTableBody) return;

    const checkboxes = Array.from(this.gcsTableBody.querySelectorAll('input[type="checkbox"][data-file-name]'));
    if (checkboxes.length === 0) {
      this.gcsSelectAllCheckbox.checked = false;
      this.gcsSelectAllCheckbox.indeterminate = false;
      return;
    }

    const selectedCount = checkboxes.filter(cb => cb.checked).length;
    if (selectedCount === 0) {
      this.gcsSelectAllCheckbox.checked = false;
      this.gcsSelectAllCheckbox.indeterminate = false;
    } else if (selectedCount === checkboxes.length) {
      this.gcsSelectAllCheckbox.checked = true;
      this.gcsSelectAllCheckbox.indeterminate = false;
    } else {
      this.gcsSelectAllCheckbox.indeterminate = true;
    }
  }

  updateGcsSelectionInfo() {
    if (this.gcsSelectedCountEl) {
      const count = this.gcsSelected.size;
      this.gcsSelectedCountEl.textContent = `${count} seleccionado${count === 1 ? '' : 's'}`;
    }

    if (this.gcsDeleteSelectedButton) {
      const canAct = this.gcsStatsReady !== false && this.gcsActionsEnabled;
      this.gcsDeleteSelectedButton.disabled = !canAct || this.gcsSelected.size === 0;
    }
  }

  setGcsActionsEnabled(enabled) {
    this.gcsActionsEnabled = Boolean(enabled);
    const buttons = [this.gcsReconcileButton, this.gcsDeleteSelectedButton];
    buttons.forEach((btn) => {
      if (btn) {
        btn.disabled = !this.gcsActionsEnabled;
      }
    });
    this.updateGcsSelectionInfo();
  }

  showGcsStatusBanner(message, { tone = 'warning' } = {}) {
    if (!this.gcsStatusBanner || !this.gcsStatusMessage) return;

    this.gcsStatusBanner.classList.remove('d-none', 'alert-warning', 'alert-danger');
    this.gcsStatusBanner.classList.add(tone === 'danger' ? 'alert-danger' : 'alert-warning');
    this.gcsStatusMessage.textContent = message || 'El servicio de Google Cloud Storage no está listo todavía.';
  }

  hideGcsStatusBanner() {
    if (!this.gcsStatusBanner) return;
    this.gcsStatusBanner.classList.add('d-none');
  }

  clearGcsSelection() {
    this.gcsSelected.clear();
    if (this.gcsTableBody) {
      this.gcsTableBody.querySelectorAll('input[type="checkbox"]').forEach(cb => {
        cb.checked = false;
      });
    }
    this.syncGcsSelectAllState();
    this.updateGcsSelectionInfo();
  }

  async handleGcsReconcile() {
    if (!this.isAdminUser()) {
      showNotification('Solo los administradores pueden reconciliar datos.', 'warning');
      return;
    }

    if (this.gcsStatsReady === false) {
      showNotification('El servicio de Google Cloud Storage no está listo. Intenta más tarde.', 'warning');
      return;
    }

    const confirmed = confirm('Esto ejecutará una reconciliación completa entre la base de datos y el bucket. ¿Deseas continuar?');
    if (!confirmed) return;

    this.toggleGcsLoading(true);
    try {
      await docuFlowAPI.gcs.reconcileFiles();
      await this.loadGcsSyncData({ refreshStats: true, page: 1 });
    } catch (error) {
      console.error('Error al reconciliar archivos GCS:', error);
      const message = await this.resolveApiErrorMessage(error, 'No se pudo ejecutar la reconciliación. Revisa los logs del backend.');
      showNotification(message, 'error');
    } finally {
      this.toggleGcsLoading(false);
    }
  }

  async handleGcsCleanup() {
    if (!this.isAdminUser()) {
      showNotification('Solo los administradores pueden eliminar objetos del bucket.', 'warning');
      return;
    }

    if (this.gcsStatsReady === false) {
      showNotification('El servicio de Google Cloud Storage no está listo. Intenta más tarde.', 'warning');
      return;
    }

    if (this.gcsSelected.size === 0) {
      showNotification('Selecciona al menos un objeto huérfano para eliminar.', 'info');
      return;
    }

    const items = Array.from(this.gcsSelected);
    const confirmed = confirm(`¿Eliminar ${items.length} objeto${items.length === 1 ? '' : 's'} de Google Cloud Storage?`);
    if (!confirmed) return;

    this.toggleGcsLoading(true);
    try {
      await docuFlowAPI.gcs.cleanupFiles(items);
      showNotification('Objetos eliminados correctamente del bucket.', 'success');
      this.clearGcsSelection();
      await this.loadGcsSyncData({ refreshStats: true, page: 1 });
    } catch (error) {
      console.error('Error al limpiar objetos GCS:', error);
      showNotification('No se pudieron eliminar los objetos seleccionados.', 'error');
    } finally {
      this.toggleGcsLoading(false);
    }
  }

  handleGcsRowAction(action, row) {
    if (!row) return;

    const fileName = row.dataset.fileName || row.querySelector('[data-file-name]')?.dataset.fileName;
    if (!fileName) return;

    switch (action) {
      case 'copy-name': {
        navigator.clipboard?.writeText(fileName)
          .then(() => showNotification('Nombre del objeto copiado al portapapeles.', 'success', 2000))
          .catch(() => showNotification('No se pudo copiar el nombre. Copia manualmente.', 'warning'));
        break;
      }
      default:
        break;
    }
  }

  formatGcsDate(value) {
    if (!value) return '—';
    const formatted = this.formatDisplayDate?.(value) || this.formatRelativeDate?.(value) || null;
    return formatted || this.formatRelativeDate(value);
  }

  formatGcsTypeLabel(contentType) {
    if (!contentType) {
      return '<span class="badge gcs-tag-muted">N/D</span>';
    }

    const lowered = contentType.toLowerCase();
    if (lowered.includes('pdf')) {
      return `<span class="badge gcs-tag-danger">${contentType}</span>`;
    }
    if (lowered.startsWith('image/')) {
      return `<span class="badge gcs-tag-success">${contentType}</span>`;
    }
    if (lowered.startsWith('video/')) {
      return `<span class="badge gcs-tag-warning">${contentType}</span>`;
    }
    if (lowered.includes('json') || lowered.includes('xml')) {
      return `<span class="badge gcs-tag-info">${contentType}</span>`;
    }
    return `<span class="badge gcs-tag-muted">${contentType}</span>`;
  }

  normalizeGcsStatsPayload(stats = {}) {
    const sources = [
      stats,
      stats?.data,
      stats?.payload,
      stats?.summary,
      stats?.overview,
      stats?.statistics,
      stats?.stats,
      stats?.totals,
      stats?.counts,
      stats?.metrics,
      stats?.details,
      stats?.counters,
      stats?.meta,
      stats?.info,
      stats?.result,
      stats?.results
    ].filter(source => source && typeof source === 'object');

    const pick = (keys = []) => {
      for (const source of sources) {
        for (const key of keys) {
          if (Object.prototype.hasOwnProperty.call(source, key)) {
            const numeric = this.toNumericValue(source[key]);
            if (numeric !== null) {
              return numeric;
            }
          }
        }
      }
      return null;
    };

    const message = stats?.message || stats?.statusMessage || stats?.error || null;
    const ready = stats?.ready !== false
      && stats?.status !== 503
      && stats?.enabled !== false
      && stats?.state !== 'DISABLED'
      && stats?.available !== false;

    const totalGcsObjects = pick(['totalGcsObjects', 'totalObjects', 'objectsInBucket', 'bucketObjects', 'gcsObjects', 'objectsInGcs', 'bucketObjectCount', 'objectCount', 'bucketCount', 'gcsCount', 'totalBucketObjects', 'bucketTotal', 'bucketFileCount']);
    const totalDatabaseRecords = pick(['totalDatabaseRecords', 'totalDbEntries', 'databaseRecords', 'dbRecords', 'dbCount', 'databaseCount', 'recordsInDatabase', 'totalRecords', 'databaseEntries', 'recordsCount']);
    const missingInDatabase = pick(['missingInDatabase', 'missingInDb', 'orphanedInGcs', 'orphanedRecords', 'objectsMissingInDb', 'bucketOrphans', 'gcsOrphans']);
    const missingInGcs = pick(['missingInGcs', 'missingObjects', 'recordsWithoutObject', 'dbOrphans', 'recordsMissingInGcs', 'databaseOrphans', 'missingRecords']);

    const usedStorageCandidate = pick(['usedStorage', 'storageUsed', 'storageUsage', 'usedBytes', 'bucketSizeBytes', 'totalBytesUsed']);
    const totalStorageCandidate = pick(['totalStorage', 'storageCapacity', 'storageLimit', 'bucketQuotaBytes', 'quotaBytes']);
    const orphanedFilesCandidate = pick(['orphanedFiles', 'orphaned', 'orphans', 'orphanCount', 'orphanedObjects']);
    const storagePercentCandidate = pick(['storageUsagePercent', 'usagePercent', 'storagePercent', 'usedPercent']);

    const fallbackUsedStorage = this.toNumericValue(stats?.usedStorage);
    const fallbackTotalStorage = this.toNumericValue(stats?.totalStorage);
    const fallbackOrphaned = this.toNumericValue(stats?.orphanedFiles);
    const fallbackPercent = this.toNumericValue(stats?.storageUsagePercent);

    const supportsMetrics = [
      totalGcsObjects,
      totalDatabaseRecords,
      usedStorageCandidate ?? fallbackUsedStorage,
      totalStorageCandidate ?? fallbackTotalStorage,
      orphanedFilesCandidate ?? fallbackOrphaned
    ].some(value => value !== null && value !== undefined);

    return {
      ...stats,
      ready,
      message,
      totalGcsObjects: totalGcsObjects ?? null,
      totalDatabaseRecords: totalDatabaseRecords ?? null,
      missingInDatabase: missingInDatabase ?? (ready ? 0 : null),
      missingInGcs: missingInGcs ?? (ready ? 0 : null),
      usedStorage: usedStorageCandidate ?? fallbackUsedStorage ?? 0,
      totalStorage: totalStorageCandidate ?? fallbackTotalStorage ?? null,
      orphanedFiles: orphanedFilesCandidate ?? fallbackOrphaned ?? 0,
      storageUsagePercent: storagePercentCandidate ?? fallbackPercent ?? null,
      supportsMetrics,
      raw: stats
    };
  }

  // Obtener estadísticas de Google Cloud Storage
  async getGcsStats(options = {}) {
    const { forceRefresh = false } = options;

    const cacheValid = !forceRefresh
      && this.latestGcsStats
      && (Date.now() - this.lastGcsStatsFetchedAt) < (60 * 1000);

    if (cacheValid) {
      return this.latestGcsStats;
    }

    try {
      const response = await docuFlowAPI.gcs.getStats();
      const stats = response?.data || response || {};
      const normalized = this.normalizeGcsStatsPayload(stats);

      if (normalized.ready && normalized.supportsMetrics && !featureFlags.isEnabled('gcsStats')) {
        featureFlags.enable('gcsStats');
        this.gcsFeatureDisabledNoticeShown = false;
      }

      this.latestGcsStats = normalized;
      this.lastGcsStatsFetchedAt = Date.now();
      this.lastGcsStatsErrorAt = null;
      this.lastGcsError = null;
      this.gcsWarningShown = false;
      return normalized;
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        throw error;
      }

      this.lastGcsStatsErrorAt = Date.now();
      this.lastGcsError = error;

      const normalized = await this.normalizeGcsStatsError(error);
      this.latestGcsStats = normalized;
      return normalized;
    }
  }

  async normalizeGcsStatsError(error) {
    let status = null;
    let message = 'No pudimos consultar el estado de Google Cloud Storage.';

    if (error instanceof ApiError) {
      status = error.status;

      if (error.response && typeof error.response.clone === 'function') {
        try {
          const cloned = error.response.clone();
          const payload = await cloned.json();
          if (payload?.error || payload?.message) {
            message = payload.error || payload.message;
          }
        } catch (_) {
          // Ignorar errores al parsear el body
        }
      }

      if (status === 503 && (!message || message === 'No pudimos consultar el estado de Google Cloud Storage.')) {
        message = 'Servicio temporalmente no disponible.';
      }
    } else if (error && typeof error.message === 'string') {
      message = error.message;
    }

    if (!this.gcsWarningShown) {
      console.warn('⚠️ No se pudieron obtener estadísticas de GCS:', error);
      const severity = status === 503 ? 'error' : 'warning';
      showNotification(message, severity);
      this.gcsWarningShown = true;
    }

    return {
      ready: false,
      message,
      status,
      error: true,
      supportsMetrics: false,
      raw: null
    };
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
    if (this.gcsStatsReady === false) {
      showNotification('El servicio de Google Cloud Storage no está listo. Intenta más tarde.', 'warning');
      return [];
    }

    try {
      showNotification('🔍 Detectando archivos huérfanos...', 'info');
      const response = await docuFlowAPI.gcs.getOrphanedFiles({ page: 1, size: 500 });
      const { items: orphanedFiles = [] } = this.normalizeGcsOrphanedResponse(response, { page: 1, size: 500 });

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
  async cleanupOrphanedFiles(fileNames = []) {
    if (this.gcsStatsReady === false) {
      showNotification('El servicio de Google Cloud Storage no está listo. Intenta más tarde.', 'warning');
      return;
    }

    try {
      let targets = Array.isArray(fileNames) ? [...fileNames] : [];

      if (targets.length === 0) {
        const response = await docuFlowAPI.gcs.getOrphanedFiles({ page: 1, size: 500 });
        const { items = [] } = this.normalizeGcsOrphanedResponse(response, { page: 1, size: 500 });
        targets = items.map(file => file.name || file.fileName || file.objectName).filter(Boolean);
      }

      if (targets.length === 0) {
        showNotification('✅ No hay archivos huérfanos para limpiar', 'info');
        return;
      }

      const confirmed = confirm(`¿Estás seguro de que quieres eliminar ${targets.length} archivos huérfanos? Esta acción no se puede deshacer.`);
      
      if (!confirmed) return;

      showNotification('🧹 Limpiando archivos huérfanos...', 'info');

      await docuFlowAPI.gcs.cleanupFiles(targets);

      showNotification(`✅ Se limpiaron ${targets.length} archivos huérfanos exitosamente`, 'success');

      await this.loadGcsSyncData({ refreshStats: true, page: 1, forceRefresh: true });

      if (window.createNotification) {
        window.createNotification('SYSTEM', 'Limpieza completada',
          `Se eliminaron ${targets.length} objetos huérfanos`, 2);
      }
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

  async refreshFileList() {
    await this.loadFiles();
    await this.updateStats();
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
        const success = await this.downloadFile(file.fileId, file.filename);
        if (success) {
          successCount++;
        } else {
          errorCount++;
        }
        // Pequeña pausa entre descargas para no saturar el backend
        await new Promise(resolve => setTimeout(resolve, 400));
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
    if (!featureFlags.isEnabled('gcsStats') && this.latestGcsStats?.supportsMetrics) {
      featureFlags.enable('gcsStats');
      this.gcsFeatureDisabledNoticeShown = false;
    }

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
      
      const response = await docuFlowAPI.files.download(fileId);

      const blob = response instanceof Blob
        ? response
        : await response.blob?.() ?? new Blob([response]);
      
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
      return true;
    } catch (error) {
      console.error('Error descargando archivo:', error);
      
      if (error?.status === 404) {
        showNotification('Archivo no encontrado en el servidor', 'error');
      } else if (error?.status === 403) {
        showNotification('Sin permisos para descargar este archivo', 'error');
      } else if (error?.status === 500) {
        showNotification('El servidor tuvo un problema al preparar la descarga (500). Verifica si el archivo existe en GCS o reintenta más tarde.', 'error');
      } else {
        showNotification('Error al descargar archivo. Intente nuevamente.', 'error');
      }
      return false;
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
      if (error?.status === 403) {
        showNotification('No tienes permisos para eliminar este archivo.', 'error');
      } else if (error?.status === 404) {
        showNotification('El archivo ya no se encuentra en el servidor.', 'warning');
      } else if (error?.status === 500) {
        showNotification('El servidor devolvió un error al eliminar el archivo (500). Reintenta más tarde.', 'error');
      } else {
        showNotification('Error al eliminar archivo', 'error');
      }
    }
  }

  async resolveApiErrorMessage(error, fallbackMessage = 'Ocurrió un error inesperado.') {
    const defaultMessage = fallbackMessage;

    if (error instanceof ApiError) {
      if (error.response) {
        try {
          const cloned = error.response.clone();
          const contentType = cloned.headers?.get('content-type') || '';

          if (contentType.includes('application/json')) {
            const payload = await cloned.json();
            const detailedMessage = payload?.message || payload?.error || payload?.details;
            if (detailedMessage) {
              return detailedMessage;
            }
          } else {
            const text = (await cloned.text())?.trim();
            if (text) {
              return text;
            }
          }
        } catch (_) {
          // Ignorar problemas al leer el body del error
        }
      }

      if (error.status === 500) {
        return 'El backend devolvió un error interno (500). Revisa los logs del servidor para más detalles.';
      }

      if (typeof error.message === 'string' && error.message.trim()) {
        return error.message;
      }
    }

    if (error && typeof error.message === 'string' && error.message.trim()) {
      return error.message;
    }

    return defaultMessage;
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
  window.addEventListener('beforeunload', () => {
    if (uploadController?.boundDocumentClick) {
      document.removeEventListener('click', uploadController.boundDocumentClick, true);
    }
  });
});
