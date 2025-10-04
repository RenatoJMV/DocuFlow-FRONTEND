// Dashboard Controller moderno con store y API client
import apiClient, { docuFlowAPI } from '../../shared/services/apiClient.js';
import { store } from '../../shared/services/store.js';
import { initializeNavbar, showNotification, formatDate, formatRelativeTime } from '../../shared/utils/uiHelpers.js';
import { SystemHealthController } from '../../shared/controllers/systemHealthController.js';
import { NotificationController } from '../../shared/controllers/notificationController.js';

class DashboardController {
  constructor() {
    this.refreshInterval = null;
    this.unsubscribers = [];
    this.healthController = null;
    this.notificationController = null;

    this.init();
  }

  async init() {
    try {
      // Inicializar navbar
      initializeNavbar('dashboard');
      
      // Inicializar controladores auxiliares
      await this.initializeAuxControllers();
      
      // Hacer disponibles globalmente para el navbar
      window.systemHealthController = this.healthController;
      window.notificationController = this.notificationController;
      
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
      showNotification('Error al inicializar dashboard', 'error');
    }
  }

  async initializeAuxControllers() {
    // Inicializar sistema de monitoreo de salud
    this.healthController = new SystemHealthController();
    await this.healthController.init();
    
    // Inicializar sistema de notificaciones
    this.notificationController = new NotificationController();
    await this.notificationController.init();
  }

  setupStoreSubscriptions() {
    // Suscribirse a cambios en las estadísticas del dashboard
    const dashboardUnsubscriber = store.subscribe('dashboard', (dashboard) => {
      if (dashboard?.stats) {
        this.updateWidgets(dashboard.stats);
        this.updateTrends({
          files: dashboard.stats.filesTrend ?? 0,
          users: dashboard.stats.usersTrend ?? 0,
          comments: dashboard.stats.commentsTrend ?? 0,
          downloads: dashboard.stats.downloadsTrend ?? 0
        });
      }
      if (dashboard?.recentActivity) {
        this.updateActivityTable(dashboard.recentActivity);
      }
    });

    // Suscribirse a cambios en archivos
    const filesUnsubscriber = store.subscribe('files', (files) => {
      if (Array.isArray(files)) {
        store.updateDashboardStats({ totalFiles: files.length });
      }
    });

    // Suscribirse a cambios en comentarios
    const commentsUnsubscriber = store.subscribe('comments', (comments) => {
      if (Array.isArray(comments)) {
        store.updateDashboardStats({ totalComments: comments.length });
      }
    });

    this.unsubscribers.push(dashboardUnsubscriber, filesUnsubscriber, commentsUnsubscriber);
  }

  async loadDashboardData() {
    try {
      store.setLoading(true);
      
      console.log('🔄 Cargando datos del dashboard...');
      console.log('🌐 Backend URL:', apiClient.baseUrl || 'http://localhost:8080');

      // Cargar datos del dashboard
      const [
        statsResult,
        filesResult,
        commentsResult,
        logsResult
      ] = await Promise.allSettled([
        docuFlowAPI.dashboard.getStats(),
        docuFlowAPI.files.getAll(),
  apiClient.get('/api/comments', { showLoading: false, showErrorNotification: false }),
        docuFlowAPI.logs.getAll()
      ]);

      // Combinar y aplicar datos del dashboard
      const combinedStats = this.combineDashboardData({ statsResult, filesResult, commentsResult, logsResult });
      this.applyDashboardData(combinedStats);

      showNotification('Dashboard cargado correctamente', 'success', 2000);

    } catch (error) {
      console.error('❌ Error cargando datos del dashboard:', error);
      showNotification('Error de conexión con el servidor', 'error');
      this.loadDemoData();
    } finally {
      store.setLoading(false);
    }
  }

  combineDashboardData({ statsResult, filesResult, commentsResult, logsResult }) {
    const combined = {
      totalFiles: 0,
      totalUsers: 0,
      totalComments: 0,
      downloadsToday: 0,
      uploadsToday: 0,
      commentsToday: 0,
      totalStorage: '0 B',
      storageUsed: '0 B',
      storageLimit: null,
      filesTrend: 0,
      usersTrend: 0,
      commentsTrend: 0,
      downloadsTrend: 0,
      recentActivity: []
    };

    // Procesar estadísticas
    if (statsResult.status === 'fulfilled') {
      const stats = this.unwrapData(statsResult.value);
      if (stats) {
        combined.totalFiles = stats.totalFiles ?? combined.totalFiles;
        combined.totalUsers = stats.totalUsers ?? combined.totalUsers;
        combined.totalComments = stats.totalComments ?? combined.totalComments;
        combined.downloadsToday = stats.downloadsToday ?? combined.downloadsToday;
        combined.uploadsToday = stats.uploadsToday ?? combined.uploadsToday;
        combined.commentsToday = stats.commentsToday ?? combined.commentsToday;
        combined.filesTrend = stats.filesTrend ?? combined.filesTrend;
        combined.usersTrend = stats.usersTrend ?? combined.usersTrend;
        combined.commentsTrend = stats.commentsTrend ?? combined.commentsTrend;
        combined.downloadsTrend = stats.downloadsTrend ?? combined.downloadsTrend;

        if (stats.storageUsedBytes) {
          combined.storageUsed = this.formatFileSize(stats.storageUsedBytes);
          combined.totalStorage = combined.storageUsed;
        } else if (stats.totalStorage) {
          combined.totalStorage = stats.totalStorage;
          combined.storageUsed = stats.storageUsed ?? stats.totalStorage;
        }

        if (stats.storageLimit) {
          combined.storageLimit = stats.storageLimit;
        }
      }
    }

    // Procesar archivos
    if (filesResult.status === 'fulfilled') {
      const files = this.extractArray(filesResult.value, ['files', 'data']);
      if (Array.isArray(files)) {
        combined.totalFiles = files.length;
        const totalBytes = files.reduce((sum, file) => sum + (file.size || file.fileSize || 0), 0);
        combined.totalStorage = this.formatFileSize(totalBytes);
        combined.storageUsed = combined.totalStorage;
      }
    }

    // Procesar comentarios
    if (commentsResult.status === 'fulfilled') {
      const comments = this.extractArray(commentsResult.value, ['comments', 'data']);
      if (Array.isArray(comments)) {
        combined.totalComments = comments.length;
        const today = new Date().toISOString().split('T')[0];
        combined.commentsToday = comments.filter((comment) => this.isSameDay(comment.createdAt ?? comment.timestamp, today)).length;
      }
    }

    // Procesar logs para actividad
    if (logsResult.status === 'fulfilled') {
      const logs = this.extractArray(logsResult.value, ['logs', 'data']);
      if (Array.isArray(logs)) {
        const today = new Date().toISOString().split('T')[0];
        const uploads = logs.filter((log) => log.action === 'FILE_UPLOAD' && this.isSameDay(log.timestamp, today));
        const downloads = logs.filter((log) => log.action === 'FILE_DOWNLOAD' && this.isSameDay(log.timestamp, today));

        combined.uploadsToday = uploads.length || combined.uploadsToday;
        combined.downloadsToday = downloads.length || combined.downloadsToday;

        combined.recentActivity = logs
          .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
          .slice(0, 10)
          .map((log) => ({
            type: (log.action || 'activity').toLowerCase(),
            action: this.getLogActionLabel(log.action),
            user: log.user || log.username || 'Usuario',
            file: log.file || log.details || 'N/A',
            timestamp: log.timestamp || log.createdAt || new Date().toISOString(),
            status: log.status || 'info'
          }));
      }
    }

    return combined;
  }

  applyDashboardData(stats) {
    this.updateWidgets(stats);
    this.updateTrends({
      files: stats.filesTrend,
      users: stats.usersTrend,
      comments: stats.commentsTrend,
      downloads: stats.downloadsTrend
    });
    this.updateActivityTable(stats.recentActivity);

    store.updateDashboardStats({
      totalFiles: stats.totalFiles,
      totalUsers: stats.totalUsers,
      totalComments: stats.totalComments,
      downloadsToday: stats.downloadsToday,
      uploadsToday: stats.uploadsToday,
      commentsToday: stats.commentsToday,
      totalStorage: stats.totalStorage,
      storageUsed: stats.storageUsed,
      storageLimit: stats.storageLimit
    });

    store.updateState('dashboard', {
      recentActivity: stats.recentActivity
    });

    this.updateNotificationWidget();
  }

  unwrapData(payload) {
    if (!payload) return null;
    if (payload.data) return payload.data;
    return payload;
  }

  extractArray(payload, keys = []) {
    if (Array.isArray(payload)) return payload;
    if (!payload) return [];
    for (const key of keys) {
      if (Array.isArray(payload[key])) return payload[key];
      if (payload[key]) payload = payload[key];
    }
    return Array.isArray(payload) ? payload : [];
  }

  isSameDay(dateString, targetIsoPrefix) {
    if (!dateString) return false;
    try {
      return new Date(dateString).toISOString().startsWith(targetIsoPrefix);
    } catch (error) {
      return false;
    }
  }

  getLogActionLabel(action) {
    if (!action) return 'Actividad';
    const labels = {
      FILE_UPLOAD: 'Subida',
      FILE_DOWNLOAD: 'Descarga',
      COMMENT_ADDED: 'Comentario',
      PERMISSION_CHANGED: 'Permisos',
      FILE_ERROR: 'Error de archivo'
    };
    return labels[action] || action.replace(/_/g, ' ').toLowerCase();
  }

  updateWidgets(stats) {
    if (!stats) return;
    // Actualizar valores de widgets principales
    this.updateWidgetValue('widget-files', stats.totalFiles);
    this.updateWidgetValue('widget-users', stats.totalUsers);
    this.updateWidgetValue('widget-comments', stats.totalComments);
    this.updateWidgetValue('widget-downloads', stats.downloadsToday);

    // Actualizar también las estadísticas de la barra lateral
    this.updateWidgetValue('stat-documents', stats.totalFiles);
    this.updateWidgetValue('stat-users', stats.totalUsers);
    this.updateWidgetValue('stat-storage', stats.totalStorage);
    this.updateWidgetValue('stat-downloads', stats.downloadsToday);
  }

  updateWidgetValue(elementId, value) {
    const element = document.getElementById(elementId);
    if (!element) return;

    element.textContent = typeof value === 'string' ? value : this.formatNumber(value);
  }

  updateTrends(trends) {
    if (!trends) return;
    
    this.updateTrendElement('files-trend', trends.files);
    this.updateTrendElement('users-trend', trends.users);
    this.updateTrendElement('comments-trend', trends.comments);
    this.updateTrendElement('downloads-trend', trends.downloads);
  }

  updateTrendElement(elementId, value = 0) {
    const element = document.getElementById(elementId);
    if (!element) return;

    const numericValue = Number(value) || 0;
    element.textContent = numericValue > 0 ? `+${numericValue}%` : `${numericValue}%`;
    element.className = numericValue > 0 ? 'trend-up' : numericValue < 0 ? 'trend-down' : 'trend-neutral';
  }

  updateActivityTable(activities) {
    const tbody = document.getElementById('activity-table');
    if (!tbody) return;

    if (!Array.isArray(activities) || activities.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" class="text-center text-muted py-4">
            <p>Sin actividad reciente</p>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = activities.map((activity) => `
      <tr>
        <td>${activity.file || 'N/A'}</td>
        <td>
          <span class="badge bg-${this.getActionColor(activity.type)}">
            ${activity.action || 'Actividad'}
          </span>
        </td>
        <td>${activity.user || 'Usuario desconocido'}</td>
        <td>
          <small class="text-muted">
            ${formatRelativeTime(activity.timestamp)}
          </small>
        </td>
        <td>
          <span class="status-${activity.status || 'info'}">
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
    
    return statusMap[status] || (status ? status.toString() : 'Info');
  }

  formatNumber(value) {
    if (typeof value !== 'number' || Number.isNaN(value)) return '0';
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
    if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
    return value.toString();
  }

  formatFileSize(bytes) {
    if (!bytes || bytes <= 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  }

  setupEventListeners() {
    // Configurar funciones globales para los botones
    window.refreshDashboard = () => this.refreshDashboard();
    window.exportActivity = () => this.exportActivity();
    window.exportStats = () => this.exportStats();
    window.cleanupSystem = () => this.cleanupSystem();
    window.showSystemHealth = () => this.showSystemHealth();
    window.showQuickActions = () => this.showQuickActions();
    window.filterActivity = () => this.filterActivity();
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

  showQuickActions() {
    showNotification('Acceso rápido disponible desde el panel lateral derecho.', 'info', 2500);
  }

  filterActivity() {
    showNotification('Filtros avanzados de actividad estarán disponibles próximamente.', 'info', 2500);
  }
  exportActivity() {
    try {
      const dashboard = store.getState('dashboard');
      const activities = dashboard?.recentActivity || [];

      if (!activities.length) {
        showNotification('No hay actividad para exportar', 'warning');
        return;
      }

      const csvContent = 'data:text/csv;charset=utf-8,'
        + 'Archivo,Acción,Usuario,Fecha,Estado\n'
        + activities.map((activity) => (
          `"${activity.file}","${activity.action}","${activity.user}","${formatDate(activity.timestamp)}","${this.getStatusText(activity.status)}"`
        )).join('\n');

      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `actividad_reciente_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      showNotification('Actividad exportada exitosamente', 'success');
    } catch (error) {
      console.error('Error exporting activity:', error);
      showNotification('Error al exportar la actividad', 'error');
    }
  }

  async exportStats() {
    try {
      showNotification('Exportando estadísticas...', 'info');
      const blob = await docuFlowAPI.export.statsCsv();

      if (blob) {
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `estadisticas_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
        showNotification('Estadísticas exportadas exitosamente', 'success');
      } else {
        throw new Error('Respuesta inválida del servidor');
      }
    } catch (error) {
      console.error('Error exportando estadísticas:', error);
      showNotification('Error al exportar estadísticas', 'error');
    }
  }

  async cleanupSystem() {
    if (!confirm('¿Está seguro de que desea limpiar archivos huérfanos del sistema?')) return;

    try {
      showNotification('Iniciando limpieza del sistema...', 'info');
      const orphaned = await docuFlowAPI.gcs.getOrphaned();

      if (Array.isArray(orphaned) && orphaned.length > 0) {
        showNotification(`Encontrados ${orphaned.length} archivos huérfanos. Limpiando...`, 'warning');
        setTimeout(() => {
          showNotification(`Limpieza completada. ${orphaned.length} archivos procesados.`, 'success');
          this.refreshDashboard();
        }, 2000);
      } else {
        showNotification('No se encontraron archivos huérfanos para limpiar', 'info');
      }
    } catch (error) {
      console.error('Error en limpieza del sistema:', error);
      showNotification('Error durante la limpieza del sistema', 'error');
    }
  }

  showSystemHealth() {
    if (this.healthController) {
      this.healthController.showHealthModal();
    } else {
      showNotification('Sistema de monitoreo no disponible', 'warning');
    }
  }

  setupAutoRefresh() {
    // Actualizar cada 5 minutos
    this.refreshInterval = setInterval(() => {
      this.loadDashboardData();
    }, 5 * 60 * 1000);
  }

  loadDemoData() {
    const demoStats = {
      totalFiles: 156,
      totalUsers: 23,
      totalComments: 89,
      downloadsToday: 12,
      uploadsToday: 8,
      commentsToday: 15,
      totalStorage: '2.4 GB',
      storageUsed: '2.1 GB'
    };

    this.applyDashboardData({
      ...demoStats,
      storageLimit: '10 GB',
      filesTrend: 12,
      usersTrend: 8,
      commentsTrend: -2,
      downloadsTrend: 15,
      recentActivity: this.loadDemoActivity()
    });
  }

  loadDemoActivity() {
    const demoActivity = [
      {
        type: 'file_upload',
        file: 'Documento_Importante.pdf',
        action: 'Subida',
        user: 'Juan Pérez',
        timestamp: new Date(Date.now() - 10 * 60000).toISOString(),
        status: 'success'
      },
      {
        type: 'comment_added',
        file: 'Presentación_Q4.pptx',
        action: 'Comentario',
        user: 'María García',
        timestamp: new Date(Date.now() - 25 * 60000).toISOString(),
        status: 'info'
      },
      {
        type: 'file_download',
        file: 'Informe_Anual.xlsx',
        action: 'Descarga',
        user: 'Carlos López',
        timestamp: new Date(Date.now() - 45 * 60000).toISOString(),
        status: 'success'
      }
    ];

    return demoActivity;
  }

  updateNotificationWidget() {
    if (!this.notificationController) return;

    const container = document.getElementById('recent-notifications-widget');
    const countBadge = document.getElementById('dashboard-notification-count');
    if (!container) return;

    const recentNotifications = this.notificationController.notifications
      .slice()
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 3);

    const unreadCount = this.notificationController.notifications.filter((n) => !n.read).length;
    if (countBadge) {
      countBadge.textContent = unreadCount;
      countBadge.style.display = unreadCount > 0 ? 'inline' : 'none';
    }

    if (recentNotifications.length === 0) {
      container.innerHTML = `
        <div class="text-center text-muted py-3">
          <i class="bi bi-bell-slash fs-4 mb-2"></i>
          <p class="mb-0 small">No hay notificaciones</p>
        </div>
      `;
      return;
    }

    container.innerHTML = recentNotifications.map((notification) => `
      <div class="notification-item-mini ${notification.read ? 'read' : 'unread'} mb-2">
        <div class="d-flex justify-content-between align-items-start">
          <div class="flex-grow-1">
            <div class="d-flex align-items-center gap-1 mb-1">
              <span class="badge bg-${this.notificationController.getTypeColor(notification.type)} badge-sm">
                ${notification.type}
              </span>
              <small class="text-muted">${this.notificationController.formatTimeAgo(notification.createdAt)}</small>
            </div>
            <h6 class="notification-title-mini mb-1">${notification.title || 'Notificación'}</h6>
            <p class="notification-message-mini mb-0">${this.notificationController.truncateMessage(notification.message, 40)}</p>
          </div>
          ${!notification.read ? `
            <button class="btn btn-sm btn-link p-0 ms-1" onclick="notificationController.markAsRead(${notification.id})" title="Marcar como leída">
              <i class="bi bi-check2 text-primary"></i>
            </button>` : ''}
        </div>
      </div>
    `).join('');
  }

  // Función para mostrar todas las notificaciones
  showAllNotifications() {
    const modal = document.createElement('div');
    modal.className = 'modal fade';
    modal.innerHTML = `
      <div class="modal-dialog modal-lg">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">
              <i class="bi bi-bell me-2"></i>Todas las Notificaciones
            </h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body">
            <div id="all-notifications-list">
              <div class="text-center">
                <div class="spinner-border" role="status">
                  <span class="visually-hidden">Cargando notificaciones...</span>
                </div>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-outline-warning" onclick="markAllAsRead()">
              <i class="bi bi-check2-all me-2"></i>Marcar todas como leídas
            </button>
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cerrar</button>
          </div>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    const bsModal = new bootstrap.Modal(modal);
    bsModal.show();
    
    // Cargar todas las notificaciones
    this.loadAllNotifications();
    
    modal.addEventListener('hidden.bs.modal', () => {
      modal.remove();
    });
  }

  async loadAllNotifications() {
    if (!this.notificationController) return;
    
    const container = document.getElementById('all-notifications-list');
    if (!container) return;
    
    try {
      const notifications = this.notificationController.notifications;
      
      if (!notifications.length) {
        container.innerHTML = `
          <div class="text-center text-muted py-4">
            <i class="bi bi-bell-slash fs-1 mb-3"></i>
            <p>No hay notificaciones disponibles</p>
          </div>
        `;
        return;
      }
      
      container.innerHTML = notifications.map((notification) => `
        <div class="notification-item-full ${notification.read ? 'read' : 'unread'} mb-3" data-id="${notification.id}">
          <div class="d-flex justify-content-between align-items-start">
            <div class="notification-content flex-grow-1">
              <div class="d-flex align-items-center gap-2 mb-2">
                <span class="badge bg-${this.notificationController.getTypeColor(notification.type)}">
                  ${notification.type}
                </span>
                ${notification.priority > 1 ? `
                  <span class="priority-indicator text-warning">
                    ${'★'.repeat(notification.priority)}
                  </span>
                ` : ''}
                <small class="text-muted">${this.notificationController.formatTimeAgo(notification.createdAt)}</small>
              </div>
              <h6 class="notification-title mb-2">${notification.title || 'Notificación'}</h6>
              <p class="notification-message mb-0">${notification.message}</p>
            </div>
            <div class="notification-actions ms-3">
              ${!notification.read ? `
                <button class="btn btn-sm btn-outline-primary me-1" onclick="notificationController.markAsRead(${notification.id})" title="Marcar como leída">
                  <i class="bi bi-check2"></i>
                </button>` : ''}
              <button class="btn btn-sm btn-outline-danger" onclick="notificationController.deactivateNotification(${notification.id})" title="Eliminar">
                <i class="bi bi-trash"></i>
              </button>
            </div>
          </div>
        </div>
      `).join('');
      
    } catch (error) {
      console.error('Error cargando notificaciones:', error);
      container.innerHTML = `
        <div class="alert alert-danger">
          <i class="bi bi-exclamation-triangle me-2"></i>
          Error al cargar las notificaciones
        </div>
      `;
    }
  }

  destroy() {
    // Limpiar suscriptores
    if (this.unsubscribers.length) {
      this.unsubscribers.forEach((unsubscribe) => {
        if (typeof unsubscribe === 'function') {
          try {
            unsubscribe();
          } catch (error) {
            console.warn('Error unsubscribing dashboard listener:', error);
          }
        }
      });
      this.unsubscribers = [];
    }

    // Limpiar controlador de salud
    if (this.healthController) {
      this.healthController.destroy?.();
      this.healthController = null;
    }
    
    // Limpiar controlador de notificaciones
    if (this.notificationController) {
      this.notificationController.destroy?.();
      this.notificationController = null;
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
      delete window.exportStats;
      delete window.cleanupSystem;
      delete window.showSystemHealth;
      delete window.showAllNotifications;
      delete window.markAllAsRead;
      delete window.systemHealthController;
      delete window.notificationController;
    }
  }
}

// Funciones globales
window.showAllNotifications = function() {
  if (window.dashboardController) {
    window.dashboardController.showAllNotifications();
  }
};

window.markAllAsRead = function() {
  if (window.notificationController) {
    window.notificationController.notifications.forEach((notification) => {
      if (!notification.read) {
        window.notificationController.markAsRead(notification.id);
      }
    });
    window.dashboardController?.updateNotificationWidget();
  }
};

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
  if (window.dashboardController?.destroy) {
    window.dashboardController.destroy();
  }
});

export { DashboardController };
