import { docuFlowAPI } from '../../shared/services/apiClient.js';
import { initializeNavbar, showNotification, formatDate } from '../../shared/utils/uiHelpers.js';

class NotificationsController {
  constructor() {
    this.notifications = [];
    this.unreadCount = 0;
    this.currentUser = JSON.parse(localStorage.getItem('user') || '{}');
    
    this.initializeComponents();
    this.setupEventListeners();
    this.loadNotifications();
    this.startPolling();
  }

  initializeComponents() {
    initializeNavbar('notifications');
  }

  setupEventListeners() {
    // Botón de marcar todas como leídas
    const markAllReadBtn = document.getElementById('markAllReadBtn');
    if (markAllReadBtn) {
      markAllReadBtn.addEventListener('click', () => this.markAllAsRead());
    }

    // Botón de refrescar
    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => this.loadNotifications());
    }

    // Filtros
    const filterSelect = document.getElementById('notificationFilter');
    if (filterSelect) {
      filterSelect.addEventListener('change', (e) => {
        this.currentFilter = e.target.value;
        this.renderNotifications();
      });
    }

    // Botón de limpiar todas
    const clearAllBtn = document.getElementById('clearAllBtn');
    if (clearAllBtn) {
      clearAllBtn.addEventListener('click', () => this.clearAllNotifications());
    }
  }

  async loadNotifications() {
    try {
      this.showLoading(true);
      const notifications = await docuFlowAPI.notifications.getAll();
      this.notifications = notifications.data || notifications || [];
      this.updateUnreadCount();
      this.renderNotifications();
      this.updateStats();
      
    } catch (error) {
      console.error('Error loading notifications:', error);
      showNotification('Error al cargar notificaciones', 'error');
      this.loadDemoNotifications();
    } finally {
      this.showLoading(false);
    }
  }

  loadDemoNotifications() {
    this.notifications = [
      {
        id: 1,
        title: 'Nuevo archivo compartido',
        message: 'Se ha compartido contigo el archivo "Informe_Mensual.pdf"',
        type: 'FILE_SHARED',
        isRead: false,
        createdAt: new Date().toISOString(),
        userId: this.currentUser.id,
        data: { fileId: 123, fileName: 'Informe_Mensual.pdf' }
      },
      {
        id: 2,
        title: 'Comentario agregado',
        message: 'Juan Pérez agregó un comentario en tu documento',
        type: 'COMMENT_ADDED',
        isRead: false,
        createdAt: new Date(Date.now() - 3600000).toISOString(),
        userId: this.currentUser.id,
        data: { commentId: 456, documentId: 789 }
      },
      {
        id: 3,
        title: 'Archivo procesado',
        message: 'Tu archivo "Presentacion.pptx" ha sido procesado exitosamente',
        type: 'FILE_PROCESSED',
        isRead: true,
        createdAt: new Date(Date.now() - 7200000).toISOString(),
        userId: this.currentUser.id,
        data: { fileId: 321 }
      },
      {
        id: 4,
        title: 'Mantenimiento programado',
        message: 'El sistema estará en mantenimiento el próximo domingo de 2:00 a 4:00 AM',
        type: 'SYSTEM_MAINTENANCE',
        isRead: true,
        createdAt: new Date(Date.now() - 86400000).toISOString(),
        userId: this.currentUser.id,
        data: { maintenanceDate: '2024-01-21T02:00:00Z' }
      },
      {
        id: 5,
        title: 'Nuevo usuario registrado',
        message: 'Ana García se ha registrado en el sistema',
        type: 'USER_REGISTERED',
        isRead: false,
        createdAt: new Date(Date.now() - 1800000).toISOString(),
        userId: this.currentUser.id,
        data: { newUserId: 555, userName: 'Ana García' }
      }
    ];
    
    this.updateUnreadCount();
    this.renderNotifications();
    this.updateStats();
  }

  renderNotifications() {
    const container = document.getElementById('notificationsContainer');
    if (!container) return;

    let filteredNotifications = [...this.notifications];
    
    // Aplicar filtros
    if (this.currentFilter === 'unread') {
      filteredNotifications = filteredNotifications.filter(n => !n.isRead);
    } else if (this.currentFilter === 'read') {
      filteredNotifications = filteredNotifications.filter(n => n.isRead);
    }

    // Ordenar por fecha (más recientes primero)
    filteredNotifications.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    if (filteredNotifications.length === 0) {
      container.innerHTML = `
        <div class="text-center text-muted py-4">
          <i class="bi bi-bell-slash fs-1 mb-3"></i>
          <p>No hay notificaciones ${this.currentFilter === 'unread' ? 'sin leer' : 
                                     this.currentFilter === 'read' ? 'leídas' : ''}</p>
          <small>Las notificaciones aparecerán aquí cuando ocurran eventos importantes.</small>
        </div>
      `;
      return;
    }

    container.innerHTML = filteredNotifications.map(notification => 
      this.renderNotificationItem(notification)
    ).join('');
    
    this.setupNotificationActions();
  }

  renderNotificationItem(notification) {
    const typeInfo = this.getNotificationTypeInfo(notification.type);
    const isUnread = !notification.isRead;
    
    return `
      <div class="notification-item mb-2 ${isUnread ? 'unread' : ''}" data-notification-id="${notification.id}">
        <div class="card ${isUnread ? 'border-primary' : ''}">
          <div class="card-body">
            <div class="row align-items-start">
              <div class="col-auto">
                <div class="notification-icon ${typeInfo.colorClass}">
                  <i class="bi ${typeInfo.icon}"></i>
                </div>
                ${isUnread ? '<div class="unread-indicator"></div>' : ''}
              </div>
              <div class="col">
                <div class="d-flex justify-content-between align-items-start">
                  <div class="flex-grow-1">
                    <h6 class="mb-1 ${isUnread ? 'fw-bold' : ''}">${this.escapeHtml(notification.title)}</h6>
                    <p class="mb-2 text-muted">${this.escapeHtml(notification.message)}</p>
                    <small class="text-muted">
                      <i class="bi bi-clock me-1"></i>
                      ${formatDate(notification.createdAt)}
                    </small>
                  </div>
                  <div class="notification-actions">
                    ${isUnread ? `
                      <button class="btn btn-sm btn-outline-primary mark-read-btn" 
                              data-notification-id="${notification.id}" 
                              title="Marcar como leída">
                        <i class="bi bi-check"></i>
                      </button>
                    ` : ''}
                    <button class="btn btn-sm btn-outline-danger delete-btn" 
                            data-notification-id="${notification.id}" 
                            title="Eliminar">
                      <i class="bi bi-trash"></i>
                    </button>
                  </div>
                </div>
                ${notification.data && this.shouldShowAction(notification.type) ? 
                  this.renderActionButton(notification) : ''}
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  renderActionButton(notification) {
    const actions = {
      'FILE_SHARED': `
        <button class="btn btn-sm btn-outline-primary mt-2 action-btn" 
                data-action="viewFile" 
                data-file-id="${notification.data.fileId}">
          <i class="bi bi-eye me-1"></i>Ver archivo
        </button>
      `,
      'COMMENT_ADDED': `
        <button class="btn btn-sm btn-outline-primary mt-2 action-btn" 
                data-action="viewComment" 
                data-document-id="${notification.data.documentId}">
          <i class="bi bi-chat me-1"></i>Ver comentario
        </button>
      `,
      'FILE_PROCESSED': `
        <button class="btn btn-sm btn-outline-success mt-2 action-btn" 
                data-action="downloadFile" 
                data-file-id="${notification.data.fileId}">
          <i class="bi bi-download me-1"></i>Descargar
        </button>
      `
    };
    
    return actions[notification.type] || '';
  }

  shouldShowAction(type) {
    return ['FILE_SHARED', 'COMMENT_ADDED', 'FILE_PROCESSED'].includes(type);
  }

  getNotificationTypeInfo(type) {
    const types = {
      'FILE_SHARED': {
        icon: 'bi-share',
        colorClass: 'text-info',
        label: 'Archivo compartido'
      },
      'COMMENT_ADDED': {
        icon: 'bi-chat-dots',
        colorClass: 'text-primary',
        label: 'Nuevo comentario'
      },
      'FILE_PROCESSED': {
        icon: 'bi-check-circle',
        colorClass: 'text-success',
        label: 'Archivo procesado'
      },
      'SYSTEM_MAINTENANCE': {
        icon: 'bi-gear',
        colorClass: 'text-warning',
        label: 'Mantenimiento'
      },
      'USER_REGISTERED': {
        icon: 'bi-person-plus',
        colorClass: 'text-success',
        label: 'Nuevo usuario'
      },
      'ERROR': {
        icon: 'bi-exclamation-triangle',
        colorClass: 'text-danger',
        label: 'Error'
      }
    };
    
    return types[type] || {
      icon: 'bi-bell',
      colorClass: 'text-secondary',
      label: 'Notificación'
    };
  }

  setupNotificationActions() {
    // Botones de marcar como leída
    document.querySelectorAll('.mark-read-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const notificationId = e.target.closest('[data-notification-id]').dataset.notificationId;
        this.markAsRead(notificationId);
      });
    });

    // Botones de eliminar
    document.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const notificationId = e.target.closest('[data-notification-id]').dataset.notificationId;
        this.deleteNotification(notificationId);
      });
    });

    // Botones de acción
    document.querySelectorAll('.action-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const action = btn.dataset.action;
        const fileId = btn.dataset.fileId;
        const documentId = btn.dataset.documentId;
        this.handleNotificationAction(action, { fileId, documentId });
      });
    });
  }

  async markAsRead(notificationId) {
    try {
      await docuFlowAPI.notifications.markAsRead(notificationId);
      
      // Actualizar estado local
      const notification = this.notifications.find(n => n.id == notificationId);
      if (notification) {
        notification.isRead = true;
      }
      
      this.updateUnreadCount();
      this.renderNotifications();
      
    } catch (error) {
      console.error('Error marking notification as read:', error);
      showNotification('Error al marcar notificación como leída', 'error');
    }
  }

  async markAllAsRead() {
    const unreadNotifications = this.notifications.filter(n => !n.isRead);
    
    if (unreadNotifications.length === 0) {
      showNotification('No hay notificaciones sin leer', 'info');
      return;
    }

    try {
      // Marcar todas como leídas
      await Promise.all(
        unreadNotifications.map(notification => 
          docuFlowAPI.notifications.markAsRead(notification.id)
        )
      );

      // Actualizar estado local
      this.notifications.forEach(notification => {
        notification.isRead = true;
      });

      this.updateUnreadCount();
      this.renderNotifications();
      showNotification('Todas las notificaciones marcadas como leídas', 'success');
      
    } catch (error) {
      console.error('Error marking all as read:', error);
      showNotification('Error al marcar todas como leídas', 'error');
    }
  }

  async deleteNotification(notificationId) {
    if (!confirm('¿Estás seguro de que deseas eliminar esta notificación?')) return;

    try {
      await docuFlowAPI.notifications.delete(notificationId);
      
      // Eliminar del estado local
      this.notifications = this.notifications.filter(n => n.id != notificationId);
      
      this.updateUnreadCount();
      this.renderNotifications();
      this.updateStats();
      showNotification('Notificación eliminada', 'success');
      
    } catch (error) {
      console.error('Error deleting notification:', error);
      showNotification('Error al eliminar notificación', 'error');
    }
  }

  async clearAllNotifications() {
    if (!confirm('¿Estás seguro de que deseas eliminar TODAS las notificaciones? Esta acción no se puede deshacer.')) return;

    try {
      await Promise.all(
        this.notifications.map(notification => 
          docuFlowAPI.notifications.delete(notification.id)
        )
      );

      this.notifications = [];
      this.updateUnreadCount();
      this.renderNotifications();
      this.updateStats();
      showNotification('Todas las notificaciones eliminadas', 'success');
      
    } catch (error) {
      console.error('Error clearing all notifications:', error);
      showNotification('Error al limpiar notificaciones', 'error');
    }
  }

  handleNotificationAction(action, data) {
    switch (action) {
      case 'viewFile':
        window.location.href = `../files/upload.html?fileId=${data.fileId}`;
        break;
      case 'viewComment':
        window.location.href = `../comments/comments.html?documentId=${data.documentId}`;
        break;
      case 'downloadFile':
        this.downloadFile(data.fileId);
        break;
    }
  }

  async downloadFile(fileId) {
    try {
      const blob = await docuFlowAPI.files.download(fileId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `file-${fileId}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading file:', error);
      showNotification('Error al descargar archivo', 'error');
    }
  }

  updateUnreadCount() {
    this.unreadCount = this.notifications.filter(n => !n.isRead).length;
    
    // Actualizar contador en el navbar
    const navBadge = document.querySelector('.navbar .notification-badge');
    if (navBadge) {
      if (this.unreadCount > 0) {
        navBadge.textContent = this.unreadCount;
        navBadge.style.display = 'inline';
      } else {
        navBadge.style.display = 'none';
      }
    }

    // Actualizar contador en la página
    const countElement = document.getElementById('unreadCount');
    if (countElement) {
      countElement.textContent = this.unreadCount;
    }
  }

  updateStats() {
    const totalCount = this.notifications.length;
    const readCount = this.notifications.filter(n => n.isRead).length;
    
    const totalElement = document.getElementById('totalNotifications');
    if (totalElement) totalElement.textContent = totalCount;
    
    const readElement = document.getElementById('readNotifications');
    if (readElement) readElement.textContent = readCount;
  }

  startPolling() {
    // Verificar nuevas notificaciones cada 30 segundos
    setInterval(() => {
      this.loadNotifications();
    }, 30000);
  }

  showLoading(show) {
    const container = document.getElementById('notificationsContainer');
    if (show && container) {
      container.innerHTML = `
        <div class="text-center py-4">
          <div class="spinner-border text-primary" role="status">
            <span class="visually-hidden">Cargando...</span>
          </div>
          <p class="mt-2">Cargando notificaciones...</p>
        </div>
      `;
    }
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Inicializar controlador cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
  new NotificationsController();
});

export default NotificationsController;