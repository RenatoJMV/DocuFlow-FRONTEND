import { docuFlowAPI } from '../../shared/services/apiClient.js';
import { initializeNavbar, showNotification, formatDate, Pagination } from '../../shared/utils/uiHelpers.js';

class LogsController {
  constructor() {
    this.logs = [];
    this.filteredLogs = [];
    this.currentPage = 1;
    this.itemsPerPage = 20;
    this.currentFilter = 'all';
    this.currentUser = JSON.parse(localStorage.getItem('user') || '{}');
    
    this.pagination = new Pagination('paginationContainer', {
      itemsPerPage: this.itemsPerPage,
      onPageChange: (page) => {
        this.currentPage = page;
        this.renderLogs();
      }
    });
    
    this.initializeComponents();
    this.setupEventListeners();
    this.loadLogs();
  }

  initializeComponents() {
    initializeNavbar('logs');
    this.setupFilters();
  }

  setupFilters() {
    const filterSelect = document.getElementById('logTypeFilter');
    if (filterSelect) {
      // Agregar opciones de filtro
      filterSelect.innerHTML = `
        <option value="all">Todos los logs</option>
        <option value="INFO">Información</option>
        <option value="WARNING">Advertencias</option>
        <option value="ERROR">Errores</option>
        <option value="DEBUG">Debug</option>
        <option value="ACCESS">Acceso</option>
        <option value="FILE">Archivos</option>
        <option value="AUTH">Autenticación</option>
        <option value="ADMIN">Administración</option>
      `;
    }
  }

  setupEventListeners() {
    // Filtro por tipo
    const filterSelect = document.getElementById('logTypeFilter');
    if (filterSelect) {
      filterSelect.addEventListener('change', (e) => {
        this.currentFilter = e.target.value;
        this.applyFilters();
      });
    }

    // Filtro por usuario (solo administradores)
    const userFilter = document.getElementById('userFilter');
    if (userFilter) {
      userFilter.addEventListener('change', (e) => {
        this.currentUserFilter = e.target.value;
        this.applyFilters();
      });
    }

    // Botón de refrescar
    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => this.loadLogs());
    }

    // Botón de limpiar filtros
    const clearFiltersBtn = document.getElementById('clearFiltersBtn');
    if (clearFiltersBtn) {
      clearFiltersBtn.addEventListener('click', () => this.clearFilters());
    }

    // Búsqueda en tiempo real
    const searchInput = document.getElementById('searchLogs');
    if (searchInput) {
      let debounceTimer;
      searchInput.addEventListener('input', (e) => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          this.searchTerm = e.target.value.trim();
          this.applyFilters();
        }, 300);
      });
    }

    // Exportar logs
    const exportBtn = document.getElementById('exportLogsBtn');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => this.exportLogs());
    }
  }

  async loadLogs() {
    try {
      this.showLoading(true);
      
      let logs;
      if (this.isAdmin() && this.currentUserFilter && this.currentUserFilter !== 'all') {
        logs = await docuFlowAPI.logs.getByUser(this.currentUserFilter);
      } else {
        logs = await docuFlowAPI.logs.getAll();
      }
      
      this.logs = logs.data || logs || [];
      this.applyFilters();
      this.updateStats();
      
    } catch (error) {
      console.error('Error loading logs:', error);
      showNotification('Error al cargar logs', 'error');
      this.loadDemoLogs();
    } finally {
      this.showLoading(false);
    }
  }

  loadDemoLogs() {
    this.logs = [
      {
        id: 1,
        type: 'INFO',
        message: 'Usuario logueado correctamente',
        userId: this.currentUser.id,
        userName: this.currentUser.name || 'Usuario Demo',
        timestamp: new Date().toISOString(),
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      {
        id: 2,
        type: 'FILE',
        message: 'Archivo subido: documento.pdf',
        userId: this.currentUser.id,
        userName: this.currentUser.name || 'Usuario Demo',
        timestamp: new Date(Date.now() - 3600000).toISOString(),
        ipAddress: '192.168.1.100',
        details: { fileName: 'documento.pdf', fileSize: '2.5MB' }
      },
      {
        id: 3,
        type: 'WARNING',
        message: 'Intento de acceso no autorizado',
        userId: null,
        userName: 'Sistema',
        timestamp: new Date(Date.now() - 7200000).toISOString(),
        ipAddress: '192.168.1.200',
        details: { reason: 'Token inválido' }
      },
      {
        id: 4,
        type: 'ERROR',
        message: 'Error al procesar archivo',
        userId: this.currentUser.id,
        userName: this.currentUser.name || 'Usuario Demo',
        timestamp: new Date(Date.now() - 10800000).toISOString(),
        ipAddress: '192.168.1.100',
        details: { error: 'Formato no soportado', fileName: 'archivo.xyz' }
      }
    ];
    
    this.applyFilters();
    this.updateStats();
  }

  applyFilters() {
    let filtered = [...this.logs];

    // Filtrar por tipo
    if (this.currentFilter !== 'all') {
      filtered = filtered.filter(log => log.type === this.currentFilter);
    }

    // Filtrar por búsqueda
    if (this.searchTerm) {
      const searchLower = this.searchTerm.toLowerCase();
      filtered = filtered.filter(log => 
        log.message.toLowerCase().includes(searchLower) ||
        log.userName?.toLowerCase().includes(searchLower) ||
        log.type.toLowerCase().includes(searchLower)
      );
    }

    // Ordenar por timestamp (más recientes primero)
    filtered.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    this.filteredLogs = filtered;
    this.pagination.updateData(this.filteredLogs);
    this.renderLogs();
    this.updateFilteredCount();
  }

  renderLogs() {
    const container = document.getElementById('logsContainer');
    if (!container) return;

    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const endIndex = startIndex + this.itemsPerPage;
    const logsToShow = this.filteredLogs.slice(startIndex, endIndex);

    if (logsToShow.length === 0) {
      container.innerHTML = `
        <div class="text-center text-muted py-4">
          <i class="bi bi-journal-text fs-1 mb-3"></i>
          <p>No se encontraron logs.</p>
          <small>Intenta cambiar los filtros o actualizar la página.</small>
        </div>
      `;
      return;
    }

    container.innerHTML = logsToShow.map(log => this.renderLogItem(log)).join('');
  }

  renderLogItem(log) {
    const logTypeClass = this.getLogTypeClass(log.type);
    const logIcon = this.getLogTypeIcon(log.type);
    
    return `
      <div class="log-item mb-2" data-log-id="${log.id}">
        <div class="card border-start border-3 ${logTypeClass}">
          <div class="card-body py-2">
            <div class="row align-items-center">
              <div class="col-auto">
                <i class="bi ${logIcon} fs-4 ${logTypeClass.replace('border-', 'text-')}"></i>
              </div>
              <div class="col">
                <div class="d-flex justify-content-between align-items-start">
                  <div>
                    <h6 class="mb-1">${this.escapeHtml(log.message)}</h6>
                    <div class="text-muted small">
                      <span class="badge bg-secondary me-2">${log.type}</span>
                      <span class="me-2">
                        <i class="bi bi-person"></i> ${log.userName || 'Sistema'}
                      </span>
                      <span class="me-2">
                        <i class="bi bi-clock"></i> ${formatDate(log.timestamp)}
                      </span>
                      ${log.ipAddress ? `
                        <span class="me-2">
                          <i class="bi bi-globe"></i> ${log.ipAddress}
                        </span>
                      ` : ''}
                    </div>
                    ${log.details ? `
                      <div class="mt-1">
                        <small class="text-muted">
                          ${this.renderLogDetails(log.details)}
                        </small>
                      </div>
                    ` : ''}
                  </div>
                  <div class="text-end">
                    <button class="btn btn-sm btn-outline-primary" 
                            onclick="showLogDetails(${log.id})" 
                            title="Ver detalles">
                      <i class="bi bi-eye"></i>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  getLogTypeClass(type) {
    const classes = {
      'INFO': 'border-info',
      'WARNING': 'border-warning',
      'ERROR': 'border-danger',
      'DEBUG': 'border-secondary',
      'ACCESS': 'border-success',
      'FILE': 'border-primary',
      'AUTH': 'border-warning',
      'ADMIN': 'border-dark'
    };
    return classes[type] || 'border-secondary';
  }

  getLogTypeIcon(type) {
    const icons = {
      'INFO': 'bi-info-circle',
      'WARNING': 'bi-exclamation-triangle',
      'ERROR': 'bi-x-circle',
      'DEBUG': 'bi-bug',
      'ACCESS': 'bi-shield-check',
      'FILE': 'bi-file-text',
      'AUTH': 'bi-key',
      'ADMIN': 'bi-gear'
    };
    return icons[type] || 'bi-journal-text';
  }

  renderLogDetails(details) {
    if (typeof details === 'string') return this.escapeHtml(details);
    if (typeof details === 'object') {
      return Object.entries(details)
        .map(([key, value]) => `${key}: ${this.escapeHtml(String(value))}`)
        .join(', ');
    }
    return '';
  }

  clearFilters() {
    this.currentFilter = 'all';
    this.currentUserFilter = 'all';
    this.searchTerm = '';
    
    document.getElementById('logTypeFilter').value = 'all';
    document.getElementById('searchLogs').value = '';
    
    const userFilter = document.getElementById('userFilter');
    if (userFilter) userFilter.value = 'all';
    
    this.applyFilters();
  }

  updateStats() {
    const totalLogs = this.logs.length;
    const errorLogs = this.logs.filter(log => log.type === 'ERROR').length;
    const warningLogs = this.logs.filter(log => log.type === 'WARNING').length;
    const infoLogs = this.logs.filter(log => log.type === 'INFO').length;

    // Actualizar contadores en el UI
    this.updateStatCard('totalLogs', totalLogs, 'bi-journal-text', 'primary');
    this.updateStatCard('errorLogs', errorLogs, 'bi-x-circle', 'danger');
    this.updateStatCard('warningLogs', warningLogs, 'bi-exclamation-triangle', 'warning');
    this.updateStatCard('infoLogs', infoLogs, 'bi-info-circle', 'info');
  }

  updateStatCard(elementId, value, icon, color) {
    const element = document.getElementById(elementId);
    if (element) {
      element.textContent = value;
      
      // Actualizar el contenedor padre si existe
      const card = element.closest('.card');
      if (card) {
        const iconElement = card.querySelector('i');
        if (iconElement) {
          iconElement.className = `bi ${icon} fs-1 text-${color} mb-2`;
        }
      }
    }
  }

  updateFilteredCount() {
    const countElement = document.getElementById('filteredCount');
    if (countElement) {
      countElement.textContent = `${this.filteredLogs.length} de ${this.logs.length} logs`;
    }
  }

  async exportLogs() {
    try {
      const exportData = await docuFlowAPI.export.logs({
        type: this.currentFilter !== 'all' ? this.currentFilter : undefined,
        userId: this.currentUserFilter !== 'all' ? this.currentUserFilter : undefined
      });
      
      // Crear y descargar archivo
      const blob = new Blob([JSON.stringify(exportData, null, 2)], 
        { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `logs-export-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      
      showNotification('Logs exportados exitosamente', 'success');
      
    } catch (error) {
      console.error('Error exporting logs:', error);
      showNotification('Error al exportar logs', 'error');
    }
  }

  showLoading(show) {
    const container = document.getElementById('logsContainer');
    if (show && container) {
      container.innerHTML = `
        <div class="text-center py-4">
          <div class="spinner-border text-primary" role="status">
            <span class="visually-hidden">Cargando...</span>
          </div>
          <p class="mt-2">Cargando logs...</p>
        </div>
      `;
    }
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  isAdmin() {
    return this.currentUser.role === 'ADMIN' || this.currentUser.isAdmin;
  }
}

// Función global para mostrar detalles del log
window.showLogDetails = function(logId) {
  const controller = window.logsController;
  if (controller) {
    const log = controller.logs.find(l => l.id == logId);
    if (log) {
      alert(`Detalles del Log:\n\n${JSON.stringify(log, null, 2)}`);
    }
  }
};

// Inicializar controlador cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
  window.logsController = new LogsController();
});

export default LogsController;