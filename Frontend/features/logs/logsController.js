import { docuFlowAPI } from '../../shared/services/apiClient.js';
import { store } from '../../shared/services/store.js';
import { enforcePageAuth } from '../../shared/utils/authGuard.js';
import { initializeNavbar, showNotification, Pagination } from '../../shared/utils/uiHelpers.js';

class LogsController {
  constructor() {
    if (!enforcePageAuth({
      message: 'Debes iniciar sesión para revisar los registros del sistema.'
    })) {
      return;
    }

    this.allLogs = [];
    this.filteredLogs = [];
    this.currentPage = 1;
    this.itemsPerPage = 20;
    this.currentFilters = {
      date: '',
      user: '',
      action: '',
      level: ''
    };
    this.selectedLogId = null;
    this.pagination = new Pagination('logsPaginationContainer', {
      itemsPerPage: this.itemsPerPage,
      currentPage: this.currentPage,
      onPageChange: (page) => {
        this.currentPage = page;
        this.renderLogs();
        this.updatePagination();
      }
    });
    this.actionLookup = null;
    this.levelLookup = null;
    
    this.initializeComponents();
    this.setupEventListeners();
    this.loadLogs();
  }

  initializeComponents() {
    // Create navbar
    initializeNavbar('logs');
    
    // Setup filters
    this.setupFilters();
  }

  setupFilters() {
    // Populate action filter with available actions
    const actionFilter = document.getElementById('filterAction');
    if (actionFilter) {
      const actions = this.getAvailableActions();
      actionFilter.innerHTML = `
        <option value="">Todas las acciones</option>
        ${actions.map(action => 
          `<option value="${action.id}">${action.name}</option>`
        ).join('')}
      `;
    }

    // Populate level filter
    const levelFilter = document.getElementById('filterLevel');
    if (levelFilter) {
      const levels = this.getAvailableLevels();
      levelFilter.innerHTML = `
        <option value="">Todos los niveles</option>
        ${levels.map(level => 
          `<option value="${level.id}">${level.name}</option>`
        ).join('')}
      `;
    }
  }

  getAvailableActions() {
    return [
      { id: 'login', name: 'Iniciar sesión', icon: 'bi-box-arrow-in-right' },
      { id: 'logout', name: 'Cerrar sesión', icon: 'bi-box-arrow-right' },
      { id: 'upload', name: 'Subir archivo', icon: 'bi-upload' },
      { id: 'download', name: 'Descargar archivo', icon: 'bi-download' },
      { id: 'delete', name: 'Eliminar archivo', icon: 'bi-trash' },
      { id: 'edit', name: 'Editar archivo', icon: 'bi-pencil' },
      { id: 'share', name: 'Compartir archivo', icon: 'bi-share' },
      { id: 'comment', name: 'Comentar', icon: 'bi-chat-text' },
      { id: 'permission_change', name: 'Cambio de permisos', icon: 'bi-shield-check' },
      { id: 'role_change', name: 'Cambio de rol', icon: 'bi-person-gear' },
      { id: 'system_error', name: 'Error del sistema', icon: 'bi-exclamation-triangle' }
    ];
  }

  getAvailableLevels() {
    return [
      { id: 'info', name: 'Información', color: 'info' },
      { id: 'warning', name: 'Advertencia', color: 'warning' },
      { id: 'error', name: 'Error', color: 'danger' },
      { id: 'success', name: 'Éxito', color: 'success' }
    ];
  }

  ensureLookups() {
    if (!this.actionLookup) {
      this.actionLookup = new Map();
      this.getAvailableActions().forEach((action) => {
        this.actionLookup.set(action.id, action);
      });
    }

    if (!this.levelLookup) {
      this.levelLookup = new Map();
      this.getAvailableLevels().forEach((level) => {
        this.levelLookup.set(level.id, level);
      });
    }
  }

  getActionInfo(actionId) {
    if (!actionId) return null;
    this.ensureLookups();
    return this.actionLookup.get(actionId) || null;
  }

  getLevelInfo(levelId) {
    if (!levelId) return null;
    this.ensureLookups();
    return this.levelLookup.get(levelId) || null;
  }

  getLogsTableBody() {
    return document.getElementById('logsTableBody') || document.querySelector('#logsTable tbody');
  }

  formatActionLabel(actionId) {
    if (!actionId) return 'Acción';
    return actionId
      .toString()
      .replace(/[_-]+/g, ' ')
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  escapeHtml(value) {
    if (value === null || value === undefined) {
      return '';
    }

    return value
      .toString()
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  normalizeTimestamp(value) {
    if (!value) {
      return new Date().toISOString();
    }

    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
      return new Date().toISOString();
    }

    return date.toISOString();
  }

  normalizeLogEntry(raw) {
    if (!raw || typeof raw !== 'object') {
      return null;
    }

    const actionCandidate = [
      raw.action,
      raw.actionType,
      raw.eventType,
      raw.event,
      raw.type
    ].find(Boolean) || 'unknown';
    const actionKey = actionCandidate.toString().toLowerCase();
    const actionInfo = this.getActionInfo(actionKey);

    const levelCandidate = [
      raw.level,
      raw.severity,
      raw.status,
      raw.logLevel
    ].find(Boolean);
    const normalizedLevel = levelCandidate
      ? levelCandidate.toString().toLowerCase()
      : this.mapActionToLevel(actionKey);

    const timestampCandidate = raw.timestamp || raw.createdAt || raw.date || raw.eventDate || raw.loggedAt;
    const timestamp = this.normalizeTimestamp(timestampCandidate);

    const username = [
      raw.username,
      raw.user,
      raw.userName,
      raw.performedBy,
      raw.actor,
      raw.email,
      raw.owner
    ].find(Boolean) || 'Sistema';

    const details = [
      raw.details,
      raw.message,
      raw.description,
      raw.eventDescription,
      raw.info,
      raw.summary
    ].find(Boolean) || `${this.formatActionLabel(actionKey)} - Sin detalles`;

    const ip = [
      raw.ip,
      raw.ipAddress,
      raw.remoteIp,
      raw.sourceIp,
      raw.clientIp
    ].find(Boolean) || 'N/A';

    const userAgent = [
      raw.userAgent,
      raw.agent,
      raw.userAgentInfo,
      raw.browser
    ].find(Boolean) || 'N/A';

    const documentId = raw.documentId || raw.document?.id || raw.documentReference || null;

    const id = raw.id || raw.logId || raw._id || `${Date.now()}-${Math.random().toString(16).slice(2)}`;

    return {
      id,
      timestamp,
      level: normalizedLevel,
      action: actionKey,
      actionLabel: actionInfo?.name || this.formatActionLabel(actionKey),
      username: username.toString(),
      details: details.toString(),
      ip: ip.toString(),
      userAgent: userAgent.toString(),
      documentId
    };
  }

  setupEventListeners() {
    // Filter inputs
    const dateFilter = document.getElementById('filterDate');
    const userFilter = document.getElementById('filterUser');
    const actionFilter = document.getElementById('filterAction');
    const levelFilter = document.getElementById('filterLevel');

    if (dateFilter) {
      dateFilter.addEventListener('change', () => this.applyFilters());
    }

    if (userFilter) {
      userFilter.addEventListener('input', () => this.debounceFilter());
    }

    if (actionFilter) {
      actionFilter.addEventListener('change', () => this.applyFilters());
    }

    if (levelFilter) {
      levelFilter.addEventListener('change', () => this.applyFilters());
    }

    // Action buttons
    const clearFiltersBtn = document.getElementById('clearAllFilters');
    const applyFiltersBtn = document.getElementById('applyFilters');
    const clearDateBtn = document.getElementById('clearDate');
    const refreshBtn = document.getElementById('refreshLogs');
    const exportBtn = document.getElementById('downloadLogs');

    if (clearFiltersBtn) {
      clearFiltersBtn.addEventListener('click', () => this.clearFilters());
    }

    if (applyFiltersBtn) {
      applyFiltersBtn.addEventListener('click', () => this.applyFilters());
    }

    if (clearDateBtn) {
      clearDateBtn.addEventListener('click', () => {
        const dateInput = document.getElementById('filterDate');
        if (dateInput) {
          dateInput.value = '';
        }
        this.applyFilters();
      });
    }

    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => this.loadLogs());
    }

    if (exportBtn) {
      exportBtn.addEventListener('click', () => this.exportLogs());
    }

    const clearOldLogsBtn = document.getElementById('clearOldLogs');
    if (clearOldLogsBtn) {
      clearOldLogsBtn.addEventListener('click', () => this.handleClearOldLogs());
    }

    const exportAnalyticsBtn = document.getElementById('exportAnalytics');
    if (exportAnalyticsBtn) {
      exportAnalyticsBtn.addEventListener('click', () => this.handleExportAnalytics());
    }

    const systemHealthBtn = document.getElementById('systemHealth');
    if (systemHealthBtn) {
      systemHealthBtn.addEventListener('click', () => this.handleSystemHealthCheck());
    }

    // Real-time toggle
    const realtimeToggle = document.getElementById('realtimeToggle');
    if (realtimeToggle) {
      realtimeToggle.addEventListener('change', (e) => {
        this.toggleRealtimeUpdates(e.target.checked);
      });
    }

    const logsTableBody = this.getLogsTableBody();
    if (logsTableBody) {
      logsTableBody.addEventListener('click', (event) => this.handleLogsTableClick(event));
    }
  }

  debounceFilter() {
    clearTimeout(this.filterTimeout);
    this.filterTimeout = setTimeout(() => {
      this.applyFilters();
    }, 300);
  }

  async loadLogs() {
    try {
      // Show loading state
      this.showLoadingState();
      
  // Cargar logs del endpoint real del backend Spring Boot
  console.log('📋 Cargando logs desde el endpoint /api/logs...');
  const response = await docuFlowAPI.logs.getAll();
      
      // Extraer logs del response
      const logs = response?.logs || response?.data || response || [];

      if (Array.isArray(logs) && logs.length > 0) {
        this.ensureLookups();
        this.allLogs = logs
          .map((log) => this.normalizeLogEntry(log))
          .filter(Boolean);

        console.log(`✅ ${this.allLogs.length} logs cargados desde el backend`);
        showNotification(`${this.allLogs.length} registros cargados del servidor`, 'success', 2000);
      } else {
        console.log('⚠️ No se encontraron logs en el servidor');
        this.allLogs = [];
        showNotification('No se encontraron registros en el servidor', 'info', 2000);
      }
      
      this.applyFilters();
      this.updateStats();
      
    } catch (error) {
      console.error('❌ Error cargando logs del backend:', error);
      showNotification('No se pudieron cargar los registros. Verifique la API.', 'warning');
      this.allLogs = [];
      this.applyFilters();
      this.updateStats();
    }
  }

  mapActionToLevel(action) {
    // Mapear acciones del backend a niveles para el frontend
    const actionLevelMap = {
      'upload': 'info',
      'download': 'info', 
      'delete': 'warning',
      'comment': 'info',
      'login': 'success',
      'logout': 'info',
      'error': 'error',
      'system_error': 'error',
      'permission_change': 'success',
      'role_change': 'success'
    };
    
    return actionLevelMap[action] || 'info';
  }

  generateLogDetails(action) {
    const details = {
      login: 'Usuario inició sesión exitosamente',
      logout: 'Usuario cerró sesión',
      upload: 'Archivo subido: documento.pdf',
      download: 'Archivo descargado: reporte.xlsx',
      delete: 'Archivo eliminado permanentemente',
      edit: 'Documento modificado',
      share: 'Documento compartido con 3 usuarios',
      comment: 'Nuevo comentario agregado',
      permission_change: 'Permisos actualizados',
      role_change: 'Rol cambiado a Editor',
      system_error: 'Error en el procesamiento de archivos'
    };
    
    return details[action] || 'Acción realizada';
  }

  showLoadingState() {
    const tbody = this.getLogsTableBody();
    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" class="text-center py-4">
            <div class="spinner-border text-primary me-2" role="status">
              <span class="visually-hidden">Cargando...</span>
            </div>
            Cargando registros...
          </td>
        </tr>
      `;
    }
  }

  applyFilters() {
    const dateFilter = document.getElementById('filterDate')?.value || '';
  const userFilterInput = document.getElementById('filterUser');
  const userFilter = userFilterInput?.value ? userFilterInput.value.toLowerCase() : '';
    const actionFilter = document.getElementById('filterAction')?.value || '';
    const levelFilter = document.getElementById('filterLevel')?.value || '';

    this.currentFilters = {
      date: dateFilter,
      user: userFilter,
      action: actionFilter,
      level: levelFilter
    };

    this.filteredLogs = this.allLogs.filter(log => {
      let match = true;

      // Date filter
      if (dateFilter) {
        const logDate = (typeof log.timestamp === 'string'
          ? log.timestamp
          : this.normalizeTimestamp(log.timestamp)
        ).split('T')[0];
        match = match && logDate === dateFilter;
      }

      // User filter
      if (userFilter) {
        match = match && log.username?.toLowerCase().includes(userFilter);
      }

      // Action filter
      if (actionFilter) {
        match = match && log.action === actionFilter;
      }

      // Level filter
      if (levelFilter) {
        match = match && log.level === levelFilter;
      }

      return match;
    });

    const selectedVisible = this.filteredLogs.some((log) => String(log.id) === String(this.selectedLogId));
    if (!selectedVisible) {
      this.clearLogDetailsPanel();
    }

    this.currentPage = 1;
    this.renderLogs();
    this.updatePagination();
    this.updateAnalytics();
    this.updateFilterInfo();
  }

  renderLogs() {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const endIndex = startIndex + this.itemsPerPage;
    const logsToShow = this.filteredLogs.slice(startIndex, endIndex);

    const tbody = this.getLogsTableBody();
    const emptyState = document.getElementById('logsEmptyState');

    if (logsToShow.length === 0) {
      if (tbody) tbody.innerHTML = '';
      if (emptyState) emptyState.classList.remove('d-none');
      this.updateShowingCount();
      return;
    }

    if (emptyState) emptyState.classList.add('d-none');

    if (tbody) {
      tbody.innerHTML = logsToShow
        .map((log) => this.renderLogRow(log, String(log.id) === String(this.selectedLogId)))
        .join('');
    }

    this.updateShowingCount();
    this.highlightSelectedRow();
  }

  renderLogRow(log, isSelected = false) {
  const actionInfo = this.getActionInfo(log.action);
  const levelInfo = this.getLevelInfo(log.level);
    const dateLabel = this.formatDate(log.timestamp);
    const timeLabel = this.formatTime(log.timestamp);
    const levelLabel = levelInfo?.name || this.formatActionLabel(log.level || 'info');
    const levelColor = levelInfo?.color || 'secondary';
    const actionLabel = this.escapeHtml(actionInfo?.name || log.actionLabel || this.formatActionLabel(log.action));
    const usernameLabel = this.escapeHtml(log.username || '—');
    const detailsLabel = this.escapeHtml(log.details || '—');
    const ipLabel = this.escapeHtml(log.ip || '—');
    const documentIdAttr = log.documentId !== null && log.documentId !== undefined
      ? this.escapeHtml(String(log.documentId))
      : '';
    
    return `
      <tr class="log-row${isSelected ? ' selected' : ''}" data-log-id="${log.id}">
        <td>
          <input type="checkbox" class="form-check-input log-row-checkbox" data-log-id="${log.id}">
        </td>
        <td>
          <div class="log-timestamp">
            <strong>${timeLabel}</strong>
            <small class="text-muted d-block">${dateLabel}</small>
          </div>
        </td>
        <td>
          <span class="badge bg-${levelColor} level-badge">
            ${levelLabel}
          </span>
        </td>
        <td>
          <div class="action-info">
            <i class="bi ${actionInfo?.icon || 'bi-circle'} me-2"></i>
            ${actionLabel}
          </div>
        </td>
        <td>
          <div class="user-info">
            <strong>${usernameLabel}</strong>
          </div>
        </td>
        <td>
          <span class="log-details" title="${detailsLabel}">
            ${detailsLabel}
          </span>
        </td>
        <td>${ipLabel}</td>
        <td>
          <div class="log-actions">
            <button class="btn btn-sm btn-outline-primary" data-action="view" data-log-id="${log.id}">
              <i class="bi bi-eye"></i>
            </button>
            ${log.documentId !== null && log.documentId !== undefined ? `
              <button class="btn btn-sm btn-outline-info" data-action="document" data-log-id="${log.id}" data-document-id="${documentIdAttr}">
                <i class="bi bi-file-earmark"></i>
              </button>
            ` : ''}
          </div>
        </td>
      </tr>
    `;
  }

  handleLogsTableClick(event) {
    const actionButton = event.target.closest('[data-action]');
    if (actionButton) {
      const logId = actionButton.dataset.logId;
      const action = actionButton.dataset.action;

      if (action === 'view') {
        this.showLogDetails(logId);
      } else if (action === 'document') {
        this.showLogDetails(logId);
        this.goToDocument(actionButton.dataset.documentId);
      }

      event.preventDefault();
      event.stopPropagation();
      return;
    }

    if (event.target.matches('.log-row-checkbox')) {
      event.stopPropagation();
      return;
    }

    const row = event.target.closest('tr[data-log-id]');
    if (!row) return;

    this.showLogDetails(row.dataset.logId);
  }

  highlightSelectedRow() {
    const tbody = this.getLogsTableBody();
    if (!tbody) return;

    tbody.querySelectorAll('tr').forEach((row) => {
      const isSelected = row.dataset.logId === String(this.selectedLogId);
      row.classList.toggle('selected', isSelected);
      const checkbox = row.querySelector('.log-row-checkbox');
      if (checkbox) {
        checkbox.checked = isSelected;
      }
    });
  }

  populateLogDetails(log) {
    const placeholder = document.querySelector('#logDetailsContent .empty-details');
    const detailsPanel = document.getElementById('logDetails');

    if (placeholder) {
      placeholder.classList.add('d-none');
    }

    if (detailsPanel) {
      detailsPanel.classList.remove('d-none');
    }

    const setText = (id, value) => {
      const element = document.getElementById(id);
      if (element) {
        element.textContent = value ?? '—';
      }
    };

    setText('detailId', log.id);
    setText('detailTimestamp', `${this.formatDate(log.timestamp)} ${this.formatTime(log.timestamp)}`);
    setText('detailUser', log.username || 'Sistema');
    setText('detailIp', log.ip || 'N/A');
    setText('detailUserAgent', log.userAgent || 'N/A');

    const detailMessage = document.getElementById('detailMessage');
    if (detailMessage) {
      detailMessage.textContent = log.details || '—';
    }
  }

  clearLogDetailsPanel() {
    const placeholder = document.querySelector('#logDetailsContent .empty-details');
    const detailsPanel = document.getElementById('logDetails');

    if (placeholder) {
      placeholder.classList.remove('d-none');
    }

    if (detailsPanel) {
      detailsPanel.classList.add('d-none');
    }

    this.selectedLogId = null;
    this.highlightSelectedRow();

    ['detailId', 'detailTimestamp', 'detailUser', 'detailIp', 'detailUserAgent', 'detailMessage'].forEach((id) => {
      const element = document.getElementById(id);
      if (element) {
        element.textContent = '—';
      }
    });
  }

  formatDate(timestamp) {
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) {
      return '—';
    }
    return date.toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  formatTime(timestamp) {
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) {
      return '—';
    }
    return date.toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  }

  updatePagination() {
    if (!this.pagination) {
      this.pagination = new Pagination('logsPaginationContainer', {
        itemsPerPage: this.itemsPerPage,
        currentPage: this.currentPage,
        onPageChange: (page) => {
          this.currentPage = page;
          this.renderLogs();
          this.updatePagination();
        }
      });
    }

    this.pagination.setItemsPerPage(this.itemsPerPage);
    this.pagination.currentPage = this.currentPage;
    this.pagination.render(this.filteredLogs.length);
  }

  updateShowingCount() {
    const showingElement = document.getElementById('showingLogsCount');
    const totalElement = document.getElementById('totalLogsCount');
    
    if (showingElement && totalElement) {
      const startIndex = (this.currentPage - 1) * this.itemsPerPage;
      const endIndex = Math.min(startIndex + this.itemsPerPage, this.filteredLogs.length);
      
      showingElement.textContent = this.filteredLogs.length > 0 ? `${startIndex + 1}-${endIndex}` : '0';
      totalElement.textContent = this.filteredLogs.length;
    }
  }

  updateFilterInfo() {
    const filterInfo = document.getElementById('filterInfo');
    if (!filterInfo) return;

    const activeFilters = [];
    if (this.currentFilters.date) activeFilters.push(`Fecha: ${this.currentFilters.date}`);
    if (this.currentFilters.user) activeFilters.push(`Usuario: ${this.currentFilters.user}`);
    if (this.currentFilters.action) activeFilters.push(`Acción: ${this.currentFilters.action}`);
    if (this.currentFilters.level) activeFilters.push(`Nivel: ${this.currentFilters.level}`);

    if (activeFilters.length > 0) {
      filterInfo.innerHTML = `
        <small class="text-muted">
          <i class="bi bi-funnel me-1"></i>
          Filtros activos: ${activeFilters.join(', ')}
        </small>
      `;
      filterInfo.classList.remove('d-none');
    } else {
      filterInfo.classList.add('d-none');
    }
  }

  updateStats() {
    const stats = this.calculateStats();

    const totalElement = document.getElementById('totalLogsCount');
    if (totalElement) {
      totalElement.textContent = this.allLogs.length;
    }

    const todayElement = document.getElementById('todayLogsCount');
    if (todayElement) {
      todayElement.textContent = stats.today;
    }

    const errorsElement = document.getElementById('errorsCount');
    if (errorsElement) {
      errorsElement.textContent = stats.errors;
    }

    const warningsElement = document.getElementById('warningsCount');
    if (warningsElement) {
      warningsElement.textContent = stats.warnings;
    }

    const successElement = document.getElementById('successCount');
    if (successElement) {
      successElement.textContent = stats.success;
    }
  }

  calculateStats() {
    const today = new Date().toISOString().split('T')[0];

    const totals = this.allLogs.reduce((acc, log) => {
      if (typeof log.timestamp === 'string' && log.timestamp.startsWith(today)) {
        acc.today += 1;
      }
      if (log.level === 'error') {
        acc.errors += 1;
      }
      if (log.level === 'warning') {
        acc.warnings += 1;
      }
      if (log.level === 'success') {
        acc.success += 1;
      }
      return acc;
    }, { today: 0, errors: 0, warnings: 0, success: 0 });

    return totals;
  }

  updateAnalytics() {
    const dataset = this.filteredLogs.length > 0 ? this.filteredLogs : this.allLogs;
    const analytics = dataset.reduce((acc, log) => {
      if (log.username) {
        acc.uniqueUsers.add(log.username.toLowerCase());
      }
      if (log.action === 'upload') {
        acc.uploads += 1;
      }
      if (log.action === 'download') {
        acc.downloads += 1;
      }

      const today = acc.todayString;
      if (log.level === 'error' && typeof log.timestamp === 'string' && log.timestamp.startsWith(today)) {
        acc.errorsToday += 1;
      }

      return acc;
    }, {
      uniqueUsers: new Set(),
      uploads: 0,
      downloads: 0,
      errorsToday: 0,
      todayString: new Date().toISOString().split('T')[0]
    });

    const setMetric = (id, value) => {
      const element = document.getElementById(id);
      if (element) {
        element.textContent = value;
      }
    };

    setMetric('uniqueUsers', analytics.uniqueUsers.size);
    setMetric('uploadsCount', analytics.uploads);
    setMetric('downloadsCount', analytics.downloads);
    setMetric('errorsToday', analytics.errorsToday);
  }

  clearFilters() {
    document.getElementById('filterDate').value = '';
    document.getElementById('filterUser').value = '';
    document.getElementById('filterAction').value = '';
    document.getElementById('filterLevel').value = '';
    
    this.applyFilters();
    showNotification('Filtros limpiados', 'info');
  }

  toggleRealtimeUpdates(enabled) {
    if (enabled) {
      this.startRealtimeUpdates();
      showNotification('Actualizaciones en tiempo real activadas', 'info');
    } else {
      this.stopRealtimeUpdates();
      showNotification('Actualizaciones en tiempo real desactivadas', 'info');
    }
  }

  startRealtimeUpdates() {
    this.realtimeInterval = setInterval(() => {
      // Simulate new log entries
      this.addSimulatedLog();
    }, 10000); // Every 10 seconds
  }

  stopRealtimeUpdates() {
    if (this.realtimeInterval) {
      clearInterval(this.realtimeInterval);
      this.realtimeInterval = null;
    }
  }

  addSimulatedLog() {
    const actions = this.getAvailableActions();
    const levels = this.getAvailableLevels();
    const users = ['admin@docuflow.com', 'editor@docuflow.com', 'viewer@docuflow.com'];
    
    const randomAction = actions[Math.floor(Math.random() * actions.length)];
    const randomLevel = levels[Math.floor(Math.random() * levels.length)];
    const randomUser = users[Math.floor(Math.random() * users.length)];
    
    const simulated = this.normalizeLogEntry({
      id: this.allLogs.length + 1,
      timestamp: new Date(),
      action: randomAction.id,
      level: randomLevel.id,
      username: randomUser,
      details: this.generateLogDetails(randomAction.id),
      ip: `192.168.1.${Math.floor(Math.random() * 255)}`,
      userAgent: 'Simulado',
      documentId: Math.random() > 0.5 ? Math.floor(Math.random() * 100) + 1 : null
    });

    if (!simulated) {
      return;
    }

    this.allLogs.unshift(simulated); // Add to beginning
    this.applyFilters();
    this.updateStats();
    this.updateAnalytics();
    
    // Show notification for new log
    if (this.currentPage === 1) {
      showNotification(`Nuevo registro: ${randomAction.name}`, 'info', 3000);
    }
  }

  async exportLogs() {
    try {
      const dataset = this.filteredLogs.length > 0 ? this.filteredLogs : this.allLogs;
      if (!dataset || dataset.length === 0) {
        showNotification('No hay registros para exportar.', 'info');
        return;
      }

      const csvContent = this.generateCSV(dataset);
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `logs_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      showNotification('Registros exportados exitosamente', 'success');
    } catch (error) {
      console.error('Export error:', error);
      showNotification('Error al exportar registros', 'error');
    }
  }

  generateCSV(dataset = []) {
    const headers = ['Fecha', 'Hora', 'Nivel', 'Acción', 'Usuario', 'Detalles', 'IP', 'Documento'];
    const rows = dataset.map(log => [
      this.formatDate(log.timestamp),
      this.formatTime(log.timestamp),
      log.level,
      log.actionLabel || log.action,
      log.username || 'Sistema',
      `"${(log.details || '').replace(/"/g, '""')}"`,
      log.ip || 'N/A',
      log.documentId || ''
    ]);
    
    return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
  }

  async downloadDailyLog() {
    try {
      const today = new Date().toISOString().split('T')[0];
      const todayLogs = this.allLogs.filter((log) =>
        typeof log.timestamp === 'string' && log.timestamp.startsWith(today)
      );
      
      if (todayLogs.length === 0) {
        showNotification('No hay registros para hoy', 'info');
        return;
      }
      
      const csvContent = this.generateDailyCSV(todayLogs);
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `log_diario_${today}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      showNotification('Log diario descargado', 'success');
    } catch (error) {
      console.error('Download error:', error);
      showNotification('Error al descargar el log diario', 'error');
    }
  }

  generateDailyCSV(logs) {
    const headers = ['Fecha', 'Hora', 'Nivel', 'Acción', 'Usuario', 'Detalles', 'IP', 'Documento'];
    const rows = logs.map(log => [
      this.formatDate(log.timestamp),
      this.formatTime(log.timestamp),
      log.level,
      log.actionLabel || log.action,
      log.username || 'Sistema',
      `"${(log.details || '').replace(/"/g, '""')}"`,
      log.ip || 'N/A',
      log.documentId || ''
    ]);
    
    return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
  }

  handleClearOldLogs(days = 30) {
    if (!Array.isArray(this.allLogs) || this.allLogs.length === 0) {
      showNotification('No hay registros para limpiar.', 'info');
      return;
    }

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffIso = cutoff.toISOString();
    const cutoffTime = cutoff.getTime();

    const beforeCount = this.allLogs.length;
    this.allLogs = this.allLogs.filter((log) => {
      if (!log?.timestamp) return true;
      const logDate = new Date(log.timestamp);
      if (Number.isNaN(logDate.getTime())) {
        return true;
      }
      return logDate.getTime() >= cutoffTime;
    });
    const removed = beforeCount - this.allLogs.length;

    this.applyFilters();
    this.updateStats();

    if (removed > 0) {
      showNotification(`Se limpiaron ${removed} registros anteriores a ${cutoffIso.split('T')[0]}.`, 'success');
    } else {
      showNotification('No se encontraron registros antiguos para eliminar.', 'info');
    }
  }

  generateAnalyticsCSV() {
    const dataset = this.filteredLogs.length > 0 ? this.filteredLogs : this.allLogs;
    const today = new Date().toISOString().split('T')[0];
    const analytics = dataset.reduce((acc, log) => {
      if (log.username) {
        acc.uniqueUsers.add(log.username.toLowerCase());
      }
      if (log.action === 'upload') {
        acc.uploads += 1;
      }
      if (log.action === 'download') {
        acc.downloads += 1;
      }
      if (log.level === 'error' && typeof log.timestamp === 'string' && log.timestamp.startsWith(today)) {
        acc.errorsToday += 1;
      }
      return acc;
    }, {
      uniqueUsers: new Set(),
      uploads: 0,
      downloads: 0,
      errorsToday: 0
    });

    return [
      ['Métrica', 'Valor'],
      ['Usuarios únicos', analytics.uniqueUsers.size],
      ['Subidas', analytics.uploads],
      ['Descargas', analytics.downloads],
      ['Errores hoy', analytics.errorsToday],
      ['Total registros filtrados', dataset.length]
    ].map((row) => row.join(',')).join('\n');
  }

  handleExportAnalytics() {
    const dataset = this.filteredLogs.length > 0 ? this.filteredLogs : this.allLogs;
    if (!dataset || dataset.length === 0) {
      showNotification('No hay datos para exportar.', 'info');
      return;
    }

    const csvContent = this.generateAnalyticsCSV();
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `analytics_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(anchor);

    showNotification('Se exportó el análisis rápido.', 'success');
  }

  handleSystemHealthCheck() {
    const totalLogs = this.allLogs.length;
    const latestLog = this.allLogs[0];
    const lastUser = latestLog?.username || 'N/D';
    const lastAction = latestLog?.actionLabel || this.formatActionLabel(latestLog?.action || 'unknown');
    const lastTimestamp = latestLog ? `${this.formatDate(latestLog.timestamp)} ${this.formatTime(latestLog.timestamp)}` : 'Sin registros';

    const summary = `Registros totales: ${totalLogs} • Último evento: ${lastAction} (${lastUser}) • Fecha y hora: ${lastTimestamp}`;
    showNotification(summary, 'info', 5000);
  }

  showLogDetails(logId) {
    const stringId = String(logId);
    const log = this.filteredLogs.find((entry) => String(entry.id) === stringId)
      || this.allLogs.find((entry) => String(entry.id) === stringId);
    if (!log) {
      showNotification('No encontramos la información de ese registro.', 'warning');
      return;
    }

    this.selectedLogId = stringId;
    this.highlightSelectedRow();
    this.populateLogDetails(log);
  }

  goToDocument(documentId) {
    // In a real app, navigate to the document
    showNotification(`Navegando al documento ${documentId}`, 'info');
  }
}

// Initialize controller and make it globally available
let logsController;
document.addEventListener('DOMContentLoaded', () => {
  logsController = new LogsController();
});
