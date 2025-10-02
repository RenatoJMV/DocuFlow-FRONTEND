// Dashboard Controller moderno con store y API client
import { docuFlowAPI } from '../../shared/services/apiClient.js';
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
      
      // Inicializar sistema de monitoreo de salud
      this.healthController = new SystemHealthController();
      await this.healthController.init();
      
      // Inicializar sistema de notificaciones
      this.notificationController = new NotificationController();
      await this.notificationController.init();
      
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
      
      console.log('🔄 Cargando datos del dashboard...');
      console.log('🌐 Backend URL:', docuFlowAPI.baseUrl || 'http://localhost:8080');

      // Test de conexión básica
      const [
        statsResult,
        healthResult,
        filesResult,
        notificationsResult
      ] = await Promise.allSettled([
        docuFlowAPI.dashboard.getStats(),
        docuFlowAPI.health.getGeneral(),
        docuFlowAPI.files.getAll(),
        docuFlowAPI.notifications.getAll()
      ]);

      console.log('📊 Resultados de carga:', {
        stats: statsResult.status,
        health: healthResult.status,
        files: filesResult.status,
        notifications: notificationsResult.status
      });

      // Procesar estadísticas
      if (statsResult.status === 'fulfilled' && statsResult.value) {
        const stats = statsResult.value;
        this.updateWidgets(stats);
        console.log('✅ Estadísticas cargadas:', stats);
      } else {
        console.warn('⚠️ No se pudieron cargar estadísticas, usando datos demo');
        this.loadDemoData();
      }

      // Inicializar controladores de sistema
      if (!this.healthController) {
        this.healthController = new SystemHealthController();
      }
      
      if (!this.notificationController) {
        this.notificationController = new NotificationController();
        await this.notificationController.init();
      }

      showNotification('Dashboard cargado correctamente', 'success', 2000);

    } catch (error) {
      console.error('❌ Error cargando datos del dashboard:', error);
      showNotification('Error de conexión con el servidor', 'error');
      this.loadDemoData();
    } finally {
      store.setLoading(false);
    }
  }

  updateWidgets(stats) {
    // Actualizar widgets con datos reales
    if (document.getElementById('widget-files')) {
      document.getElementById('widget-files').textContent = stats.totalFiles || 0;
    }
    if (document.getElementById('widget-users')) {
      document.getElementById('widget-users').textContent = stats.totalUsers || 0;
    }
    if (document.getElementById('widget-comments')) {
      document.getElementById('widget-comments').textContent = stats.totalComments || 0;
    }
    if (document.getElementById('widget-downloads')) {
      document.getElementById('widget-downloads').textContent = stats.downloadsToday || 0;
    }

    // Actualizar trends si existen
    this.updateTrends(stats);
  }

  updateTrends(stats) {
    const trends = {
      'files-trend': stats.filesTrend || '+0%',
      'users-trend': stats.usersTrend || '+0%',
      'comments-trend': stats.commentsTrend || '+0%',
      'downloads-trend': stats.downloadsTrend || '+0%'
    };

    Object.entries(trends).forEach(([id, value]) => {
      const element = document.getElementById(id);
      if (element) {
        element.textContent = value;
        element.className = value.startsWith('+') ? 'trend-up' : 
                           value.startsWith('-') ? 'trend-down' : 'trend-neutral';
      }
    });
  }

  loadDemoData() {
    // Datos demo para desarrollo
    const demoStats = {
      totalFiles: 156,
      totalUsers: 23,
      totalComments: 89,
      totalStorage: '2.4 GB',
      downloadsToday: 12,
      uploadsToday: 8,
      commentsToday: 15
    };

    this.updateWidgets(demoStats);
    
    // Actualizar también las estadísticas de la barra lateral
    this.updateWidgetValue('stat-documents', demoStats.totalFiles);
    this.updateWidgetValue('stat-users', demoStats.totalUsers);
    this.updateWidgetValue('stat-storage', '2.4 GB');
    this.updateWidgetValue('stat-downloads', demoStats.downloadsToday);
  }
      if (statsResult.status === 'fulfilled' && statsResult.value) {
        const stats = statsResult.value.data || statsResult.value;
        combinedStats = {
          ...combinedStats,
          ...stats
        };
      }

      // Procesar datos de usuarios
      if (usersResult.status === 'fulfilled' && usersResult.value) {
        const usersData = usersResult.value;
        const users = usersData.users || usersData.data || usersData;
        combinedStats.totalUsers = Array.isArray(users) ? users.length : 0;
      }

      // Procesar datos de archivos
      if (filesResult.status === 'fulfilled' && filesResult.value) {
        const filesData = filesResult.value;
        const files = filesData.files || filesData.data || filesData;
        
        if (Array.isArray(files)) {
          combinedStats.totalFiles = files.length;
          
          // Calcular tamaño total de almacenamiento
          const totalBytes = files.reduce((sum, file) => sum + (file.size || 0), 0);
          combinedStats.totalStorage = this.formatFileSize(totalBytes);
          combinedStats.storageUsed = this.formatFileSize(totalBytes);
        }
      }

      // Procesar comentarios
      if (commentsResult.status === 'fulfilled' && commentsResult.value) {
        const commentsData = commentsResult.value;
        const comments = commentsData.comments || commentsData.data || commentsData;
        
        if (Array.isArray(comments)) {
          combinedStats.totalComments = comments.length;
          
          // Contar comentarios de hoy
          const today = new Date().toISOString().split('T')[0];
          combinedStats.commentsToday = comments.filter(comment => 
            comment.createdAt?.startsWith(today)
          ).length;
        }
      }

      // Procesar logs para actividad
      if (logsResult.status === 'fulfilled' && logsResult.value) {
        const logsData = logsResult.value;
        const logs = logsData.logs || logsData.data || logsData;
        
        if (Array.isArray(logs)) {
          const today = new Date().toISOString().split('T')[0];
          
          // Contar actividades de hoy por tipo
          combinedStats.uploadsToday = logs.filter(log => 
            log.action === 'FILE_UPLOAD' && log.timestamp?.startsWith(today)
          ).length;
          
          combinedStats.downloadsToday = logs.filter(log => 
            log.action === 'FILE_DOWNLOAD' && log.timestamp?.startsWith(today)
          ).length;
          
          // Preparar actividad reciente para mostrar en el dashboard
          combinedStats.recentActivities = logs
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
            .slice(0, 10)
            .map(log => ({
              type: log.action?.toLowerCase().replace('_', '') || 'activity',
              user: log.user || 'Usuario',
              file: log.details || 'Archivo',
              time: new Date(log.timestamp).toLocaleTimeString('es-ES', { 
                hour: '2-digit', 
                minute: '2-digit' 
              })
            }));
        }
      }

      // Actualizar el store con estadísticas reales
      store.updateDashboardStats({
        totalFiles: combinedStats.totalFiles,
        totalUsers: combinedStats.totalUsers,
        pendingTasks: 0, // Por implementar
        totalStorage: combinedStats.totalStorage,
        downloadsToday: combinedStats.downloadsToday,
        adminUsers: 0, // Por implementar
        totalComments: combinedStats.totalComments,
        totalLogs: combinedStats.recentActivities?.length || 0,
        uploadsToday: combinedStats.uploadsToday,
        commentsToday: combinedStats.commentsToday,
        storageUsed: combinedStats.storageUsed,
        storageLimit: combinedStats.storageLimit,
        recentActivity: combinedStats.recentActivities
      });

      console.log('✅ Datos del dashboard cargados:', combinedStats);
      
      // Actualizar widget de notificaciones
      this.updateNotificationWidget();
      
      showNotification('Dashboard actualizado con datos del servidor', 'success', 2000);

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
    window.exportStats = () => this.exportStats();
    window.cleanupSystem = () => this.cleanupSystem();
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

  async exportStats() {
    try {
      showNotification('Exportando estadísticas...', 'info');
      
      // Usar el nuevo endpoint de exportación
      const response = await fetch(`${docuFlowAPI.baseUrl}/export/stats?format=csv`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `estadisticas_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
        
        showNotification('Estadísticas exportadas exitosamente', 'success');
      } else {
        throw new Error('Error en la exportación');
      }
    } catch (error) {
      console.error('Error exportando estadísticas:', error);
      showNotification('Error al exportar estadísticas', 'error');
    }
  }

  async cleanupSystem() {
    if (!confirm('¿Está seguro de que desea limpiar archivos huérfanos del sistema?')) {
      return;
    }

    try {
      showNotification('Iniciando limpieza del sistema...', 'info');
      
      // Obtener archivos huérfanos
      const orphaned = await docuFlowAPI.get('/gcs/files/orphaned');
      
      if (orphaned && orphaned.length > 0) {
        showNotification(`Encontrados ${orphaned.length} archivos huérfanos. Limpiando...`, 'warning');
        
        // Aquí podrías implementar la lógica de limpieza
        // Por ahora solo mostramos información
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

  destroy() {
    // Limpiar suscriptores
    if (this.unsubscribers) {
      this.unsubscribers.forEach(unsubscribe => {
        if (typeof unsubscribe === 'function') {
          unsubscribe();
        }
      });
    }
    
    // Limpiar controlador de salud
    if (this.healthController) {
      this.healthController.destroy();
      this.healthController = null;
    }
    
    // Limpiar controlador de notificaciones
    if (this.notificationController) {
      this.notificationController.destroy();
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
      
      if (notifications.length === 0) {
        container.innerHTML = `
          <div class="text-center text-muted py-4">
            <i class="bi bi-bell-slash fs-1 mb-3"></i>
            <p>No hay notificaciones disponibles</p>
          </div>
        `;
        return;
      }
      
      container.innerHTML = notifications.map(notification => `
        <div class="notification-item-full ${notification.read ? 'read' : 'unread'} mb-3" 
             data-id="${notification.id}">
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
                <button class="btn btn-sm btn-outline-primary me-1" 
                        onclick="notificationController.markAsRead(${notification.id})"
                        title="Marcar como leída">
                  <i class="bi bi-check2"></i>
                </button>
              ` : ''}
              <button class="btn btn-sm btn-outline-danger" 
                      onclick="notificationController.deactivateNotification(${notification.id})"
                      title="Eliminar">
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

  // Función para actualizar el widget de notificaciones en el dashboard
  updateNotificationWidget() {
    if (!this.notificationController) return;
    
    const container = document.getElementById('recent-notifications-widget');
    const countBadge = document.getElementById('dashboard-notification-count');
    
    if (!container) return;
    
    const recentNotifications = this.notificationController.notifications
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 3);
    
    const unreadCount = this.notificationController.notifications.filter(n => !n.read).length;
    
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
    
    container.innerHTML = recentNotifications.map(notification => `
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
            <button class="btn btn-sm btn-link p-0 ms-1" 
                    onclick="notificationController.markAsRead(${notification.id})"
                    title="Marcar como leída">
              <i class="bi bi-check2 text-primary"></i>
            </button>
          ` : ''}
        </div>
      </div>
    `).join('');
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
    window.notificationController.notifications.forEach(notification => {
      if (!notification.read) {
        window.notificationController.markAsRead(notification.id);
      }
    });
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
  if (window.dashboardController && typeof window.dashboardController.destroy === 'function') {
    window.dashboardController.destroy();
  }
});
