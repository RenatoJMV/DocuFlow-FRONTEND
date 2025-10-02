// logsControllerSimple.js - Controlador simplificado para gestión de logs
import { docuFlowAPI } from '../../shared/services/apiClientSimple.js';
import authService from '../../shared/services/authServiceSimple.js';
import { showNotification } from '../../shared/utils/uiHelpers.js';

class SimpleLogsController {
  constructor() {
    this.logs = [];
    this.currentFilter = {};
    this.init();
  }

  async init() {
    if (!authService.isLoggedIn()) {
      window.location.href = '../auth/login.html';
      return;
    }

    if (!authService.hasPermission('view_logs')) {
      showNotification('No tienes permisos para ver los logs', 'error');
      window.location.href = '../dashboard/dashboard.html';
      return;
    }

    this.setupEventListeners();
    await this.loadLogs();
    this.updateUI();
  }

  setupEventListeners() {
    // Filtros
    const actionFilter = document.getElementById('actionFilter');
    if (actionFilter) {
      actionFilter.addEventListener('change', (e) => {
        this.currentFilter.action = e.target.value;
        this.filterLogs();
      });
    }

    const userFilter = document.getElementById('userFilter');
    if (userFilter) {
      userFilter.addEventListener('change', (e) => {
        this.currentFilter.user = e.target.value;
        this.filterLogs();
      });
    }

    const dateFilter = document.getElementById('dateFilter');
    if (dateFilter) {
      dateFilter.addEventListener('change', (e) => {
        this.currentFilter.date = e.target.value;
        this.filterLogs();
      });
    }

    // Búsqueda
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => this.handleSearch(e.target.value));
    }

    // Refresh
    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => this.loadLogs());
    }

    // Limpiar filtros
    const clearFiltersBtn = document.getElementById('clearFiltersBtn');
    if (clearFiltersBtn) {
      clearFiltersBtn.addEventListener('click', () => this.clearFilters());
    }

    // Exportar logs
    const exportBtn = document.getElementById('exportLogsBtn');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => this.exportLogs());
    }
  }

  async loadLogs() {
    try {
      showNotification('Cargando logs...', 'info', 1000);

      const response = await docuFlowAPI.logs.list();
      
      if (response.success) {
        this.logs = response.data.logs || [];
        this.renderLogsList();
        this.updateStats();
        showNotification('Logs cargados correctamente', 'success', 2000);
      }

    } catch (error) {
      console.error('Error cargando logs:', error);
      showNotification('Error cargando logs', 'error');
    }
  }

  filterLogs() {
    const filtered = this.logs.filter(log => {
      // Filtro por acción
      if (this.currentFilter.action && this.currentFilter.action !== 'all') {
        if (log.action !== this.currentFilter.action) return false;
      }

      // Filtro por usuario
      if (this.currentFilter.user && this.currentFilter.user !== 'all') {
        if (log.user !== this.currentFilter.user) return false;
      }

      // Filtro por fecha
      if (this.currentFilter.date) {
        const logDate = new Date(log.timestamp);
        const filterDate = new Date(this.currentFilter.date);
        if (logDate.toDateString() !== filterDate.toDateString()) return false;
      }

      return true;
    });

    this.renderLogsList(filtered);
  }

  handleSearch(query) {
    if (!query.trim()) {
      this.renderLogsList();
      return;
    }

    const filtered = this.logs.filter(log => 
      log.action.toLowerCase().includes(query.toLowerCase()) ||
      log.user.toLowerCase().includes(query.toLowerCase()) ||
      log.target.toLowerCase().includes(query.toLowerCase())
    );

    this.renderLogsList(filtered);
  }

  clearFilters() {
    this.currentFilter = {};
    
    // Limpiar selects
    const actionFilter = document.getElementById('actionFilter');
    const userFilter = document.getElementById('userFilter');
    const dateFilter = document.getElementById('dateFilter');
    const searchInput = document.getElementById('searchInput');
    
    if (actionFilter) actionFilter.value = 'all';
    if (userFilter) userFilter.value = 'all';
    if (dateFilter) dateFilter.value = '';
    if (searchInput) searchInput.value = '';

    this.renderLogsList();
    showNotification('Filtros limpiados', 'info', 2000);
  }

  renderLogsList(logsToRender = this.logs) {
    const container = document.getElementById('logsList');
    if (!container) return;

    if (logsToRender.length === 0) {
      container.innerHTML = `
        <div class="text-center py-5">
          <i class="bi bi-journal-x" style="font-size: 3rem; color: #ccc;"></i>
          <p class="text-muted mt-3">No hay logs para mostrar</p>
        </div>
      `;
      return;
    }

    container.innerHTML = logsToRender.map(log => `
      <div class="log-item card mb-2">
        <div class="card-body d-flex align-items-center">
          <div class="log-icon me-3">
            <i class="bi ${this.getActionIcon(log.action)} ${this.getActionColor(log.action)}" style="font-size: 1.2rem;"></i>
          </div>
          <div class="log-info flex-grow-1">
            <div class="d-flex justify-content-between align-items-start">
              <div>
                <span class="fw-bold">${this.getActionText(log.action)}</span>
                <span class="text-muted ms-2">${log.target}</span>
              </div>
              <small class="text-muted">${this.formatDate(log.timestamp)}</small>
            </div>
            <small class="text-muted">
              Usuario: ${log.user} • ID: ${log.id}
            </small>
          </div>
        </div>
      </div>
    `).join('');
  }

  updateStats() {
    const totalLogs = this.logs.length;
    const uniqueUsers = [...new Set(this.logs.map(log => log.user))].length;
    const actions = this.logs.reduce((acc, log) => {
      acc[log.action] = (acc[log.action] || 0) + 1;
      return acc;
    }, {});

    const statsContainer = document.getElementById('logsStats');
    if (statsContainer) {
      const topAction = Object.keys(actions).reduce((a, b) => actions[a] > actions[b] ? a : b, '');
      
      statsContainer.innerHTML = `
        <div class="row">
          <div class="col-md-3">
            <div class="stat-card">
              <h6>Total de Logs</h6>
              <span class="stat-number">${totalLogs}</span>
            </div>
          </div>
          <div class="col-md-3">
            <div class="stat-card">
              <h6>Usuarios Activos</h6>
              <span class="stat-number">${uniqueUsers}</span>
            </div>
          </div>
          <div class="col-md-3">
            <div class="stat-card">
              <h6>Acción Más Común</h6>
              <span class="stat-number">${this.getActionText(topAction)}</span>
            </div>
          </div>
          <div class="col-md-3">
            <div class="stat-card">
              <h6>Hoy</h6>
              <span class="stat-number">${this.getTodayLogsCount()}</span>
            </div>
          </div>
        </div>
      `;
    }
  }

  getTodayLogsCount() {
    const today = new Date().toDateString();
    return this.logs.filter(log => new Date(log.timestamp).toDateString() === today).length;
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
  }

  exportLogs() {
    try {
      const csvContent = this.generateCSV();
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      
      if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `logs_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        showNotification('Logs exportados correctamente', 'success');
      }
    } catch (error) {
      console.error('Error exportando logs:', error);
      showNotification('Error exportando logs', 'error');
    }
  }

  generateCSV() {
    const headers = ['ID', 'Acción', 'Usuario', 'Objetivo', 'Fecha'];
    const rows = this.logs.map(log => [
      log.id,
      this.getActionText(log.action),
      log.user,
      log.target,
      this.formatDate(log.timestamp)
    ]);

    return [headers, ...rows]
      .map(row => row.map(field => `"${field}"`).join(','))
      .join('\n');
  }

  // Utilidades
  getActionIcon(action) {
    const icons = {
      file_upload: 'bi-cloud-upload',
      file_download: 'bi-cloud-download',
      file_delete: 'bi-trash',
      user_login: 'bi-box-arrow-in-right',
      user_logout: 'bi-box-arrow-left',
      permission_grant: 'bi-shield-check',
      permission_revoke: 'bi-shield-x'
    };
    return icons[action] || 'bi-info-circle';
  }

  getActionColor(action) {
    const colors = {
      file_upload: 'text-success',
      file_download: 'text-info',
      file_delete: 'text-danger',
      user_login: 'text-primary',
      user_logout: 'text-secondary',
      permission_grant: 'text-success',
      permission_revoke: 'text-warning'
    };
    return colors[action] || 'text-muted';
  }

  getActionText(action) {
    const texts = {
      file_upload: 'Subida de archivo',
      file_download: 'Descarga de archivo',
      file_delete: 'Eliminación de archivo',
      user_login: 'Inicio de sesión',
      user_logout: 'Cierre de sesión',
      permission_grant: 'Permiso otorgado',
      permission_revoke: 'Permiso revocado'
    };
    return texts[action] || action;
  }

  formatDate(dateString) {
    return new Date(dateString).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  }
}

// Instancia global
const logsController = new SimpleLogsController();

// Hacer disponible globalmente
window.logsController = logsController;

export default logsController;