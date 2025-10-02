// Dashboard Controller moderno con store y API client
import { docuFlowAPI } from '../../shared/services/apiClient.js';
import { store } from '../../shared/services/store.js';
import { initializeNavbar, showNotification, formatDate, formatRelativeTime } from '../../shared/utils/uiHelpers.js';

class DashboardController {
  constructor() {
    this.refreshInterval = null;
    this.unsubscribers = [];
    this.init();
  }

  async init() {
    try {
      // Inicializar navbar
      initializeNavbar('dashboard');
      
      // Configurar suscriptores al store
      this.setupStoreSubscriptions();
      
      // Cargar datos iniciales
      await this.loadDashboardData();
      
      // Configurar actualización automática
      this.setupAutoRefresh();
      
      // Configurar event listeners
      this.setupEventListeners();
      
    } catch (error) {
      console.error('Error initializing dashboard:', error);
      showNotification('Error al exportar la actividad', 'error');
    }
  }

  formatFileSize(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  setupStoreSubscriptions() {
    // Suscribirse a cambios en las estadísticas del dashboard
    const dashboardUnsubscriber = store.subscribe('dashboard', (dashboard) => {
      if (dashboard && dashboard.stats) {
        this.updateWidgets(dashboard.stats);
      }
      if (dashboard && dashboard.recentActivity) {
        this.updateActivityTable(dashboard.recentActivity);
      }
    });

    // Suscribirse a cambios en archivos
    const filesUnsubscriber = store.subscribe('files', (files) => {
      if (files && Array.isArray(files)) {
        store.updateDashboardStats({ totalFiles: files.length });
      }
    });

    // Suscribirse a cambios en comentarios
    const commentsUnsubscriber = store.subscribe('comments', (comments) => {
      if (comments && Array.isArray(comments)) {
        store.updateDashboardStats({ totalComments: comments.length });
      }
    });

    this.unsubscribers.push(dashboardUnsubscriber, filesUnsubscriber, commentsUnsubscriber);
  }

  async loadDashboardData() {
    try {
      store.setLoading(true);

      // Cargar datos usando los nuevos endpoints mejorados
      const [statsResult, fileStatsResult, activityResult] = await Promise.allSettled([
        docuFlowAPI.dashboard.getStats(),
        docuFlowAPI.files.getStats(),
        docuFlowAPI.dashboard.getActivity()
      ]);

      // Procesar estadísticas principales
      let combinedStats = {
        totalFiles: 0,
        totalUsers: 0,
        totalComments: 0,
        totalStorage: '0 B',
        downloadsToday: 0,
        uploadsToday: 0,
        commentsToday: 0
      };

      if (statsResult.status === 'fulfilled' && statsResult.value) {
        const rawStats = statsResult.value;
        const stats = rawStats?.data || rawStats;
        combinedStats = {
          ...combinedStats,
          totalFiles: stats?.totalFiles ?? combinedStats.totalFiles,
          totalUsers: stats?.totalUsers ?? 0,
          totalComments: stats?.totalComments ?? 0,
          totalStorage: this.formatFileSize(stats?.totalStorageUsed ?? 0),
          recentActivities: stats?.recentActivities ?? 0
        };
      }

      if (fileStatsResult.status === 'fulfilled' && fileStatsResult.value) {
        const rawFileStats = fileStatsResult.value;
        const fileStats = rawFileStats?.data || rawFileStats;
        combinedStats.totalFiles = fileStats?.totalFiles ?? combinedStats.totalFiles;
        const totalSizeBytes = fileStats?.totalSizeBytes ?? fileStats?.totalSize ?? 0;
        const formattedTotalSize = fileStats?.formattedTotalSize || this.formatFileSize(totalSizeBytes);
        combinedStats.totalStorage = formattedTotalSize;
      }

      if (activityResult.status === 'fulfilled' && activityResult.value) {
        const rawActivity = activityResult.value;
        const activity = rawActivity?.data || rawActivity;
        combinedStats = {
          ...combinedStats,
          uploadsToday: activity?.uploadsToday || 0,
          commentsToday: activity?.commentsToday || 0,
          downloadsToday: activity?.downloadsToday || 0
        };
      }

      // Actualizar el store con estadísticas reales
      store.updateDashboardStats({
        totalFiles: combinedStats.totalFiles,
        totalUsers: combinedStats.totalUsers,
        pendingTasks: 0, // Por ahora
        totalStorage: combinedStats.totalStorage,
        downloadsToday: combinedStats.downloadsToday,
        adminUsers: 0, // Por ahora
        totalComments: combinedStats.totalComments,
        totalLogs: combinedStats.recentActivities || 0,
        uploadsToday: combinedStats.uploadsToday,
        commentsToday: combinedStats.commentsToday
      });

      console.log('✅ Datos del dashboard cargados:', combinedStats);

    } catch (error) {
      console.error('❌ Error cargando datos del dashboard:', error);
      showNotification('Error cargando datos del dashboard', 'error');
      
      // Fallback a datos básicos
      this.loadDemoData();
    } finally {
      store.setLoading(false);
    }
  }

  loadDemoData() {
    const demoStats = {
      totalFiles: 156,
      totalUsers: 23,
      totalComments: 89,
      downloadsToday: 45,
      documents: 156,
      processed: 142,
      pending: 12,
      errors: 2
    };
    
    store.updateDashboardStats(demoStats);
    
    // Simular trends
    this.updateTrends({
      files: 12,
      users: 8,
      comments: -2,
      downloads: 15
    });
  }

  loadDemoActivity() {
    const demoActivity = [
      {
        id: 1,
        type: 'file_upload',
        file: 'Documento_Importante.pdf',
        action: 'Subida',
        user: 'Juan Pérez',
        timestamp: new Date(Date.now() - 10 * 60000).toISOString(),
        status: 'success'
      },
      {
        id: 2,
        type: 'comment_added',
        file: 'Presentación_Q4.pptx',
        action: 'Comentario',
        user: 'María García',
        timestamp: new Date(Date.now() - 25 * 60000).toISOString(),
        status: 'info'
      },
      {
        id: 3,
        type: 'file_download',
        file: 'Informe_Anual.xlsx',
        action: 'Descarga',
        user: 'Carlos López',
        timestamp: new Date(Date.now() - 45 * 60000).toISOString(),
        status: 'success'
      }
    ];

    const dashboard = store.getState('dashboard') || {};
    store.setState('dashboard', {
      ...dashboard,
      recentActivity: demoActivity
    });
  }

  updateWidgets(stats) {
    if (!stats) return;
    
    // Actualizar valores de widgets principales
    this.updateWidgetValue('widget-files', stats.totalFiles || 0);
    this.updateWidgetValue('widget-users', stats.totalUsers || 0);
    this.updateWidgetValue('widget-comments', stats.totalComments || 0);
    this.updateWidgetValue('widget-downloads', stats.downloadsToday || 0);
  }

  updateWidgetValue(elementId, value) {
    const element = document.getElementById(elementId);
    if (!element) return;

    element.textContent = this.formatNumber(value);
  }

  updateTrends(trends) {
    if (!trends) return;
    
    this.updateTrendElement('files-trend', trends.files || 0);
    this.updateTrendElement('users-trend', trends.users || 0);
    this.updateTrendElement('comments-trend', trends.comments || 0);
    this.updateTrendElement('downloads-trend', trends.downloads || 0);
  }

  updateTrendElement(elementId, value) {
    const element = document.getElementById(elementId);
    if (!element) return;

    element.textContent = value > 0 ? `+${value}%` : `${value}%`;
    element.className = value > 0 ? 'trend-up' : value < 0 ? 'trend-down' : 'trend-neutral';
  }

  updateActivityTable(activities) {
    const tbody = document.getElementById('activity-table');
    if (!tbody) return;

    if (!activities || !Array.isArray(activities) || activities.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" class="text-center text-muted py-4">
            <p>Sin actividad reciente</p>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = activities.map(activity => `
      <tr>
        <td>${activity.file || 'N/A'}</td>
        <td>
          <span class="badge bg-${this.getActionColor(activity.type)}">
            ${activity.action || 'N/A'}
          </span>
        </td>
        <td>${activity.user || 'Usuario desconocido'}</td>
        <td>
          <small class="text-muted">
            ${formatRelativeTime(activity.timestamp)}
          </small>
        </td>
        <td>
          <span class="status-${activity.status}">
            ${this.getStatusText(activity.status)}
          </span>
        </td>
      </tr>
    `).join('');
  }

  getActionColor(type) {
    const colorMap = {
      file_upload: 'success',
      file_download: 'info',
      comment_added: 'warning',
      permission_changed: 'primary',
      file_error: 'danger'
    };
    
    return colorMap[type] || 'secondary';
  }

  getStatusText(status) {
    const statusMap = {
      success: 'Exitoso',
      info: 'Info',
      warning: 'Advertencia',
      danger: 'Error'
    };
    
    return statusMap[status] || status;
  }

  formatNumber(num) {
    if (!num || typeof num !== 'number') return '0';
    
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  }

  setupEventListeners() {
    // Configurar funciones globales para los botones
    window.refreshDashboard = () => this.refreshDashboard();
    window.exportActivity = () => this.exportActivity();
  }

  async refreshDashboard() {
    try {
      showNotification('Actualizando dashboard...', 'info');
      await this.loadDashboardData();
      showNotification('Dashboard actualizado', 'success');
    } catch (error) {
      console.error('Error refreshing dashboard:', error);
      showNotification('Error al actualizar el dashboard', 'error');
    }
  }

  exportActivity() {
    try {
      const dashboard = store.getState('dashboard');
      const activities = dashboard ? dashboard.recentActivity : [];
      
      if (!activities || activities.length === 0) {
        showNotification('No hay actividad para exportar', 'warning');
        return;
      }

      const csvContent = "data:text/csv;charset=utf-8," 
        + "Archivo,Acción,Usuario,Fecha,Estado\n"
        + activities.map(a => `"${a.file}","${a.action}","${a.user}","${formatDate(a.timestamp)}","${this.getStatusText(a.status)}"`).join("\n");
      
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `actividad_reciente_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      showNotification('Actividad exportada exitosamente', 'success');
    } catch (error) {
      console.error('Error exporting activity:', error);
      showNotification('Error al exportar la actividad', 'error');
    }
  }

  setupAutoRefresh() {
    // Actualizar cada 5 minutos
    this.refreshInterval = setInterval(() => {
      this.loadDashboardData();
    }, 5 * 60 * 1000);
  }

  destroy() {
    // Limpiar suscriptores
    if (this.unsubscribers) {
      this.unsubscribers.forEach(unsubscribe => {
        if (typeof unsubscribe === 'function') {
          unsubscribe();
        }
      });
    }
    
    // Limpiar interval
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
    
    // Limpiar funciones globales
    if (typeof window !== 'undefined') {
      delete window.refreshDashboard;
      delete window.exportActivity;
    }
  }
}

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
  try {
    window.dashboardController = new DashboardController();
  } catch (error) {
    console.error('Error initializing dashboard controller:', error);
  }
});

// Limpiar al salir de la página
window.addEventListener('beforeunload', () => {
  if (window.dashboardController && typeof window.dashboardController.destroy === 'function') {
    window.dashboardController.destroy();
  }
});
