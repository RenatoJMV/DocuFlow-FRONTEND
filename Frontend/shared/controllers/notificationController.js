// Controlador de notificaciones en tiempo real
import { apiClient } from '../../shared/services/apiClient.js';
import { showNotification } from '../../shared/utils/uiHelpers.js';

let notificationController = null;

class NotificationController {
  constructor() {
    this.notifications = [];
    this.currentUser = JSON.parse(localStorage.getItem('user') || '{}');
    this.pollingInterval = null;
    this.isPolling = false;
  }

  async init() {
    try {
      await this.loadNotifications();
      this.setupEventListeners();
      this.startPolling();
      this.updateNavbarNotifications();
      notificationController = this;
      if (typeof window !== 'undefined') {
        window.notificationController = this;
      }
      console.log('✅ Sistema de notificaciones iniciado');
    } catch (error) {
      console.error('❌ Error inicializando notificaciones:', error);
    }
  }

  async loadNotifications() {
    try {
  const response = await apiClient.get('/api/notifications');
      this.notifications = response?.notifications || response?.data || response || [];
      
      console.log(`📩 ${this.notifications.length} notificaciones cargadas`);
      this.updateNotificationBadge();
      this.updateNavbarNotifications();
      
    } catch (error) {
      console.error('❌ Error cargando notificaciones:', error);
      this.notifications = this.getDemoNotifications();
      this.updateNotificationBadge();
      this.updateNavbarNotifications();
    }
  }

  updateNotificationBadge() {
    const unreadCount = this.notifications.filter(n => !n.read).length;
    const badge = document.getElementById('notification-badge');
    
    if (badge) {
      badge.textContent = unreadCount;
      badge.style.display = unreadCount > 0 ? 'inline' : 'none';
    }
  }

  updateNavbarNotifications() {
    const container = document.getElementById('navbar-notifications');
    if (!container) return;

    const recentNotifications = this.notifications
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 5);

    if (recentNotifications.length === 0) {
      container.innerHTML = '<li class="dropdown-item-text text-muted">No hay notificaciones</li>';
      return;
    }

    container.innerHTML = recentNotifications.map(notification => `
      <li>
        <div class="dropdown-item notification-item-compact ${notification.read ? 'read' : 'unread'}" 
             data-id="${notification.id}">
          <div class="d-flex justify-content-between align-items-start">
            <div class="notification-content flex-grow-1">
              <div class="d-flex align-items-center gap-2 mb-1">
                <span class="badge bg-${this.getTypeColor(notification.type)} badge-sm">
                  ${notification.type}
                </span>
                ${notification.priority > 1 ? `
                  <span class="priority-indicator text-warning">
                    ${'★'.repeat(notification.priority)}
                  </span>
                ` : ''}
              </div>
              <h6 class="notification-title mb-1">${notification.title || 'Notificación'}</h6>
              <p class="notification-message mb-1">${this.truncateMessage(notification.message, 60)}</p>
              <small class="text-muted">${this.formatTimeAgo(notification.createdAt)}</small>
            </div>
            ${!notification.read ? `
              <button class="btn btn-sm btn-link p-0 ms-2" 
                      onclick="notificationController.markAsRead(${notification.id})"
                      title="Marcar como leída">
                <i class="bi bi-check2"></i>
              </button>
            ` : ''}
          </div>
        </div>
      </li>
    `).join('');
  }

  async markAsRead(notificationId) {
    try {
      const notification = this.notifications.find(n => n.id === notificationId);
      if (notification) {
        notification.read = true;
        this.updateNotificationBadge();
        this.updateNavbarNotifications();
      }
    } catch (error) {
      console.error('Error marcando notificación como leída:', error);
    }
  }

  async createNotification(notificationData) {
    try {
  const newNotification = await apiClient.post('/api/notifications', notificationData);
      
      if (newNotification) {
        this.notifications.unshift(newNotification);
        this.updateNotificationBadge();
        this.updateNavbarNotifications();
        showNotification('Notificación creada', 'success');
      }
    } catch (error) {
      console.error('Error creando notificación:', error);
      showNotification('Error al crear notificación', 'error');
    }
  }

  async deactivateNotification(notificationId) {
    try {
  await apiClient.put(`/api/notifications/${notificationId}/deactivate`);
      
      this.notifications = this.notifications.filter(n => n.id !== notificationId);
      this.updateNotificationBadge();
      this.updateNavbarNotifications();
      
      showNotification('Notificación desactivada', 'success');
    } catch (error) {
      console.error('Error desactivando notificación:', error);
      showNotification('Error al desactivar notificación', 'error');
    }
  }

  setupEventListeners() {
    if (!document.getElementById('notification-styles')) {
      const styles = document.createElement('style');
      styles.id = 'notification-styles';
      styles.textContent = `
        .notification-dropdown {
          width: 350px;
          max-height: 400px;
          overflow-y: auto;
        }
        
        .notification-item-compact {
          padding: 0.75rem;
          border-bottom: 1px solid #f0f0f0;
          transition: background-color 0.2s;
        }
        
        .notification-item-compact:hover {
          background-color: #f8f9fa;
        }
        
        .notification-item-compact.unread {
          background-color: #fff3e0;
          border-left: 3px solid #ff9800;
        }
        
        .notification-title {
          font-size: 0.875rem;
          font-weight: 600;
          margin: 0;
        }
        
        .notification-message {
          font-size: 0.8rem;
          color: #6c757d;
          margin: 0;
          line-height: 1.3;
        }
        
        .badge-sm {
          font-size: 0.65rem;
          padding: 0.2rem 0.4rem;
        }
        
        .priority-indicator {
          font-size: 0.7rem;
        }
        
        .notification-list {
          max-height: 300px;
          overflow-y: auto;
        }
        
        .notification-list::-webkit-scrollbar {
          width: 4px;
        }
        
        .notification-list::-webkit-scrollbar-track {
          background: #f1f1f1;
        }
        
        .notification-list::-webkit-scrollbar-thumb {
          background: #c1c1c1;
          border-radius: 2px;
        }
      `;
      document.head.appendChild(styles);
    }
  }

  startPolling() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
    }
    
    this.isPolling = true;
    this.pollingInterval = setInterval(() => {
      this.loadNotifications();
    }, 60000);
    
    console.log('🔄 Polling de notificaciones iniciado (60s)');
  }

  stopPolling() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
    this.isPolling = false;
    console.log('⏹️ Polling de notificaciones detenido');
  }

  getTypeColor(type) {
    const colors = {
      'SYSTEM': 'primary',
      'USER_ACTION': 'info', 
      'SECURITY': 'warning',
      'ERROR': 'danger',
      'SUCCESS': 'success',
      'FILE_UPLOAD': 'info',
      'FILE_DOWNLOAD': 'secondary',
      'COMMENT': 'warning'
    };
    return colors[type] || 'secondary';
  }

  truncateMessage(message, maxLength) {
    if (!message) return '';
    return message.length > maxLength 
      ? message.substring(0, maxLength) + '...' 
      : message;
  }

  formatTimeAgo(dateString) {
    const now = new Date();
    const date = new Date(dateString);
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Ahora';
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}d`;
    
    return date.toLocaleDateString('es-ES', { 
      month: 'short', 
      day: 'numeric' 
    });
  }

  getDemoNotifications() {
    return [
      {
        id: 1,
        type: 'SYSTEM',
        title: 'Sistema iniciado',
        message: 'DocuFlow se ha iniciado correctamente',
        read: false,
        priority: 1,
        createdAt: new Date().toISOString(),
        targetUserId: this.currentUser.id
      },
      {
        id: 2,
        type: 'FILE_UPLOAD',
        title: 'Archivo subido',
        message: 'Se ha subido un nuevo documento: informe.pdf',
        read: false,
        priority: 2,
        createdAt: new Date(Date.now() - 300000).toISOString(),
        targetUserId: this.currentUser.id
      },
      {
        id: 3,
        type: 'COMMENT',
        title: 'Nuevo comentario',
        message: 'Juan Pérez ha comentado en tu documento',
        read: true,
        priority: 2,
        createdAt: new Date(Date.now() - 900000).toISOString(),
        targetUserId: this.currentUser.id
      }
    ];
  }

  async createSystemNotification(type, title, message, priority = 1) {
    const notification = {
      type: type,
      title: title,
      message: message,
      priority: priority,
      targetType: 'USER',
      targetUserId: this.currentUser.id,
      metadata: {
        source: 'system',
        timestamp: new Date().toISOString()
      }
    };

    await this.createNotification(notification);
  }

  destroy() {
    this.stopPolling();
    const styles = document.getElementById('notification-styles');
    if (styles) {
      styles.remove();
    }
    if (notificationController === this) {
      notificationController = null;
    }
    if (typeof window !== 'undefined' && window.notificationController === this) {
      delete window.notificationController;
    }
    console.log('🗑️ NotificationController destruido');
  }
}

window.createNotification = function(type, title, message, priority = 1) {
  const controller = window.notificationController || notificationController;
  if (controller) {
    controller.createSystemNotification(type, title, message, priority);
  }
};

export { NotificationController };