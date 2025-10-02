import { docuFlowAPI } from '../../shared/services/apiClient.js';
import { store } from '../../shared/services/store.js';
import { initializeNavbar, showNotification, Pagination } from '../../shared/utils/uiHelpers.js';

class LogsController {
  constructor() {
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
    this.pagination = new Pagination('logsPaginationContainer', {
      itemsPerPage: this.itemsPerPage,
      currentPage: this.currentPage,
      onPageChange: (page) => {
        this.currentPage = page;
        this.renderLogs();
        this.updatePagination();
      }
    });
    
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
    const clearFiltersBtn = document.getElementById('clearFilters');
    const refreshBtn = document.getElementById('refreshLogs');
    const exportBtn = document.getElementById('exportLogs');
    const downloadLogBtn = document.getElementById('downloadDailyLog');

    if (clearFiltersBtn) {
      clearFiltersBtn.addEventListener('click', () => this.clearFilters());
    }

    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => this.loadLogs());
    }

    if (exportBtn) {
      exportBtn.addEventListener('click', () => this.exportLogs());
    }

    if (downloadLogBtn) {
      downloadLogBtn.addEventListener('click', () => this.downloadDailyLog());
    }

    // Real-time toggle
    const realtimeToggle = document.getElementById('realtimeToggle');
    if (realtimeToggle) {
      realtimeToggle.addEventListener('change', (e) => {
        this.toggleRealtimeUpdates(e.target.checked);
      });
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
      const response = await docuFlowAPI.get('/api/logs');
      
      // Extraer logs del response
      const logs = response?.logs || response?.data || response || [];

      if (Array.isArray(logs) && logs.length > 0) {
        // Convertir los logs del backend al formato esperado por el frontend
        this.allLogs = logs.map(log => ({
          id: log.id || Date.now() + Math.random(),
          timestamp: log.timestamp || log.createdAt || new Date().toISOString(),
          level: this.mapActionToLevel(log.action || 'INFO'),
          action: log.action || 'UNKNOWN',
          user: log.user || log.username || 'Sistema',
          details: log.details || `${log.action} - ${log.message || 'Sin detalles'}`,
          ip: log.ip || log.ipAddress || 'N/A',
          userAgent: log.userAgent || 'N/A'
        }));

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
      showNotification('Error al cargar registros, usando datos demo', 'warning');
      
      // Fallback a datos demo si hay error
      console.log('🔄 Fallback a datos demo...');
      this.allLogs = this.getDemoLogs();
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
      'error': 'error'
    };
    
    return actionLevelMap[action] || 'info';
  }

  getDemoLogs() {
    // Demo logs for development
    const actions = this.getAvailableActions();
    const levels = this.getAvailableLevels();
    const users = ['admin@docuflow.com', 'editor@docuflow.com', 'viewer@docuflow.com', 'guest@docuflow.com'];
    
    const logs = [];
    for (let i = 0; i < 150; i++) {
      const randomAction = actions[Math.floor(Math.random() * actions.length)];
      const randomLevel = levels[Math.floor(Math.random() * levels.length)];
      const randomUser = users[Math.floor(Math.random() * users.length)];
      const date = new Date();
      date.setMinutes(date.getMinutes() - (i * 15)); // 15 minutes apart
      
      logs.push({
        id: i + 1,
        timestamp: date.toISOString(),
        action: randomAction.id,
        actionName: randomAction.name,
        level: randomLevel.id,
        username: randomUser,
        details: this.generateLogDetails(randomAction.id),
        ip: `192.168.1.${Math.floor(Math.random() * 255)}`,
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        documentId: Math.random() > 0.5 ? Math.floor(Math.random() * 100) + 1 : null
      });
    }
    
    return logs.reverse(); // Most recent first
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
    const tbody = document.querySelector('#logsTable tbody');
    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" class="text-center py-4">
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
    const userFilter = document.getElementById('filterUser')?.value.toLowerCase() || '';
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
        const logDate = log.timestamp.split('T')[0];
        match = match && logDate === dateFilter;
      }

      // User filter
      if (userFilter) {
        match = match && log.username.toLowerCase().includes(userFilter);
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

    this.currentPage = 1;
    this.renderLogs();
    this.updatePagination();
    this.updateFilterInfo();
  }

  renderLogs() {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const endIndex = startIndex + this.itemsPerPage;
    const logsToShow = this.filteredLogs.slice(startIndex, endIndex);

    const tbody = document.querySelector('#logsTable tbody');
    const emptyState = document.getElementById('logsEmptyState');

    if (logsToShow.length === 0) {
      if (tbody) tbody.innerHTML = '';
      if (emptyState) emptyState.classList.remove('d-none');
      this.updateShowingCount();
      return;
    }

    if (emptyState) emptyState.classList.add('d-none');

    if (tbody) {
      tbody.innerHTML = logsToShow.map(log => this.renderLogRow(log)).join('');
    }

    this.updateShowingCount();
  }

  renderLogRow(log) {
    const actionInfo = this.getAvailableActions().find(a => a.id === log.action);
    const levelInfo = this.getAvailableLevels().find(l => l.id === log.level);
    
    return `
      <tr class="log-row" data-log-id="${log.id}">
        <td>
          <div class="log-timestamp">
            <strong>${this.formatTime(log.timestamp)}</strong>
            <small class="text-muted d-block">${this.formatDate(log.timestamp)}</small>
          </div>
        </td>
        <td>
          <span class="badge bg-${levelInfo?.color || 'secondary'} level-badge">
            ${levelInfo?.name || log.level}
          </span>
        </td>
        <td>
          <div class="action-info">
            <i class="bi ${actionInfo?.icon || 'bi-circle'} me-2"></i>
            ${actionInfo?.name || log.action}
          </div>
        </td>
        <td>
          <div class="user-info">
            <strong>${log.username}</strong>
            <small class="text-muted d-block">${log.ip}</small>
          </div>
        </td>
        <td>
          <span class="log-details" title="${log.details}">
            ${log.details}
          </span>
        </td>
        <td>
          <div class="log-actions">
            <button class="btn btn-sm btn-outline-primary" onclick="logsController.showLogDetails('${log.id}')">
              <i class="bi bi-eye"></i>
            </button>
            ${log.documentId ? `
              <button class="btn btn-sm btn-outline-info" onclick="logsController.goToDocument('${log.documentId}')">
                <i class="bi bi-file-earmark"></i>
              </button>
            ` : ''}
          </div>
        </td>
      </tr>
    `;
  }

  formatDate(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  formatTime(timestamp) {
    const date = new Date(timestamp);
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
    
    document.getElementById('totalLogsCount').textContent = this.allLogs.length;
    document.getElementById('todayLogsCount').textContent = stats.today;
    document.getElementById('errorsCount').textContent = stats.errors;
    document.getElementById('warningsCount').textContent = stats.warnings;
  }

  calculateStats() {
    const today = new Date().toISOString().split('T')[0];
    
    return {
      today: this.allLogs.filter(log => log.timestamp.startsWith(today)).length,
      errors: this.allLogs.filter(log => log.level === 'error').length,
      warnings: this.allLogs.filter(log => log.level === 'warning').length
    };
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
    
    const newLog = {
      id: this.allLogs.length + 1,
      timestamp: new Date().toISOString(),
      action: randomAction.id,
      actionName: randomAction.name,
      level: randomLevel.id,
      username: randomUser,
      details: this.generateLogDetails(randomAction.id),
      ip: `192.168.1.${Math.floor(Math.random() * 255)}`,
      documentId: Math.random() > 0.5 ? Math.floor(Math.random() * 100) + 1 : null
    };
    
    this.allLogs.unshift(newLog); // Add to beginning
    this.applyFilters();
    this.updateStats();
    
    // Show notification for new log
    if (this.currentPage === 1) {
      showNotification(`Nuevo registro: ${randomAction.name}`, 'info', 3000);
    }
  }

  async exportLogs() {
    try {
      const csvContent = this.generateCSV();
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

  generateCSV() {
    const headers = ['Fecha', 'Hora', 'Nivel', 'Acción', 'Usuario', 'Detalles', 'IP', 'Documento'];
    const rows = this.filteredLogs.map(log => [
      this.formatDate(log.timestamp),
      this.formatTime(log.timestamp),
      log.level,
      log.actionName,
      log.username,
      `"${log.details.replace(/"/g, '""')}"`,
      log.ip,
      log.documentId || ''
    ]);
    
    return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
  }

  async downloadDailyLog() {
    try {
      const today = new Date().toISOString().split('T')[0];
      const todayLogs = this.allLogs.filter(log => log.timestamp.startsWith(today));
      
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
      log.actionName,
      log.username,
      `"${log.details.replace(/"/g, '""')}"`,
      log.ip,
      log.documentId || ''
    ]);
    
    return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
  }

  showLogDetails(logId) {
    const log = this.allLogs.find(l => l.id == logId);
    if (!log) return;
    
    // Simple alert for now - in a real app, use a modal
    const details = `
Registro ID: ${log.id}
Fecha: ${this.formatDate(log.timestamp)} ${this.formatTime(log.timestamp)}
Nivel: ${log.level}
Acción: ${log.actionName}
Usuario: ${log.username}
IP: ${log.ip}
Detalles: ${log.details}
${log.documentId ? `Documento ID: ${log.documentId}` : ''}
    `.trim();
    
    alert(details);
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
