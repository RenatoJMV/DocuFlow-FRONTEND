// Dashboard Controller simplificado sin sistemas de seguridad complejos
import { docuFlowAPI } from '../../shared/services/apiClientSimple.js';
import authService from '../../shared/services/authServiceSimple.js';
import { showNotification, formatDate } from '../../shared/utils/uiHelpers.js';

class SimpleDashboardController {
  constructor() {
    this.refreshInterval = null;
    this.stats = {};
    this.init();
  }

  async init() {
    try {
      // Verificar autenticación
      if (!authService.isLoggedIn()) {
        window.location.href = '../auth/login.html';
        return;
      }

      this.setupEventListeners();
      await this.loadDashboardData();
      this.updateUI();
      this.startAutoRefresh();

    } catch (error) {
      console.error('Error inicializando dashboard:', error);
      showNotification('Error inicializando dashboard', 'error');
    }
  }

  setupEventListeners() {
    // Botón de refrescar
    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => this.loadDashboardData());
    }

    // Navegación rápida
    const quickActions = document.querySelectorAll('.quick-action');
    quickActions.forEach(action => {
      action.addEventListener('click', (e) => {
        const target = e.currentTarget.dataset.target;
        if (target) {
          window.location.href = target;
        }
      });
    });

    // Logout
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', async () => {
        await authService.logout();
        window.location.href = '../auth/login.html';
      });
    }
  }

  async loadDashboardData() {
    try {
      showNotification('Actualizando datos...', 'info', 1000);

      // Cargar estadísticas básicas (desde modo demo)
      const statsResponse = await this.getDemoStats();
      
      if (statsResponse.success) {
        this.stats = statsResponse.data;
        this.renderStats();
        this.renderRecentActivity();
        this.renderQuickActions();
      }

    } catch (error) {
      console.error('Error cargando datos del dashboard:', error);
      showNotification('Error cargando datos', 'error');
    }
  }

  getDemoStats() {
    // Datos de demostración para el dashboard
    return Promise.resolve({
      success: true,
      data: {
        totalFiles: 156,
        totalUsers: 23,
        totalComments: 89,
        pendingTasks: 12,
        storageUsed: 2.4, // GB
        storageLimit: 10, // GB
        recentFiles: [
          {
            id: 1,
            name: 'Informe_Mensual.pdf',
            uploadedBy: 'admin@docuflow.com',
            uploadedAt: new Date().toISOString(),
            size: 1024000
          },
          {
            id: 2,
            name: 'Presentacion_Q4.pptx',
            uploadedBy: 'user@docuflow.com',
            uploadedAt: new Date(Date.now() - 3600000).toISOString(),
            size: 2048000
          }
        ],
        recentActivity: [
          {
            id: 1,
            action: 'file_upload',
            user: 'admin@docuflow.com',
            target: 'Informe_Mensual.pdf',
            timestamp: new Date().toISOString()
          },
          {
            id: 2,
            action: 'comment_added',
            user: 'user@docuflow.com',
            target: 'Documento_Revision.docx',
            timestamp: new Date(Date.now() - 1800000).toISOString()
          }
        ]
      }
    });
  }

  renderStats() {
    const statsContainer = document.getElementById('dashboardStats');
    if (!statsContainer) return;

    const storagePercentage = (this.stats.storageUsed / this.stats.storageLimit) * 100;

    statsContainer.innerHTML = `
      <div class="row">
        <div class="col-md-3 mb-4">
          <div class="stat-card">
            <div class="stat-icon">
              <i class="bi bi-file-earmark text-primary"></i>
            </div>
            <div class="stat-info">
              <h3>${this.stats.totalFiles}</h3>
              <p>Total de Archivos</p>
            </div>
          </div>
        </div>
        <div class="col-md-3 mb-4">
          <div class="stat-card">
            <div class="stat-icon">
              <i class="bi bi-people text-success"></i>
            </div>
            <div class="stat-info">
              <h3>${this.stats.totalUsers}</h3>
              <p>Usuarios Activos</p>
            </div>
          </div>
        </div>
        <div class="col-md-3 mb-4">
          <div class="stat-card">
            <div class="stat-icon">
              <i class="bi bi-chat-dots text-info"></i>
            </div>
            <div class="stat-info">
              <h3>${this.stats.totalComments}</h3>
              <p>Comentarios</p>
            </div>
          </div>
        </div>
        <div class="col-md-3 mb-4">
          <div class="stat-card">
            <div class="stat-icon">
              <i class="bi bi-check-square text-warning"></i>
            </div>
            <div class="stat-info">
              <h3>${this.stats.pendingTasks}</h3>
              <p>Tareas Pendientes</p>
            </div>
          </div>
        </div>
      </div>
      <div class="row">
        <div class="col-md-6">
          <div class="storage-card">
            <h6>Almacenamiento</h6>
            <div class="progress mb-2">
              <div class="progress-bar" role="progressbar" style="width: ${storagePercentage}%" 
                   aria-valuenow="${storagePercentage}" aria-valuemin="0" aria-valuemax="100">
              </div>
            </div>
            <small class="text-muted">${this.stats.storageUsed} GB de ${this.stats.storageLimit} GB utilizados</small>
          </div>
        </div>
        <div class="col-md-6">
          <div class="system-status">
            <h6>Estado del Sistema</h6>
            <div class="status-item">
              <i class="bi bi-circle-fill text-success"></i>
              <span>Sistema Operativo</span>
            </div>
            <div class="status-item">
              <i class="bi bi-circle-fill text-success"></i>
              <span>Base de Datos</span>
            </div>
            <div class="status-item">
              <i class="bi bi-circle-fill text-success"></i>
              <span>Almacenamiento</span>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  renderRecentActivity() {
    const activityContainer = document.getElementById('recentActivity');
    if (!activityContainer) return;

    const activities = this.stats.recentActivity || [];

    activityContainer.innerHTML = `
      <h5>Actividad Reciente</h5>
      ${activities.length === 0 ? 
        '<p class="text-muted">No hay actividad reciente</p>' :
        activities.map(activity => `
          <div class="activity-item">
            <div class="activity-icon">
              <i class="bi ${this.getActivityIcon(activity.action)}"></i>
            </div>
            <div class="activity-info">
              <p class="mb-1">
                <strong>${activity.user}</strong> 
                ${this.getActivityText(activity.action)} 
                <em>${activity.target}</em>
              </p>
              <small class="text-muted">${this.formatDate(activity.timestamp)}</small>
            </div>
          </div>
        `).join('')
      }
    `;
  }

  renderQuickActions() {
    const actionsContainer = document.getElementById('quickActions');
    if (!actionsContainer) return;

    const user = authService.getCurrentUser();
    const canUpload = authService.hasPermission('upload_files');
    const canViewLogs = authService.hasPermission('view_logs');
    const isAdmin = authService.isAdmin();

    actionsContainer.innerHTML = `
      <h5>Acciones Rápidas</h5>
      <div class="row">
        ${canUpload ? `
          <div class="col-md-6 mb-3">
            <div class="quick-action" data-target="../files/upload.html">
              <i class="bi bi-cloud-upload text-primary"></i>
              <span>Subir Archivos</span>
            </div>
          </div>
        ` : ''}
        <div class="col-md-6 mb-3">
          <div class="quick-action" data-target="../files/upload.html">
            <i class="bi bi-search text-info"></i>
            <span>Buscar Archivos</span>
          </div>
        </div>
        ${canViewLogs ? `
          <div class="col-md-6 mb-3">
            <div class="quick-action" data-target="../logs/logs.html">
              <i class="bi bi-journal-text text-secondary"></i>
              <span>Ver Logs</span>
            </div>
          </div>
        ` : ''}
        ${isAdmin ? `
          <div class="col-md-6 mb-3">
            <div class="quick-action" data-target="../permissions/permissions.html">
              <i class="bi bi-shield-check text-success"></i>
              <span>Gestionar Permisos</span>
            </div>
          </div>
        ` : ''}
      </div>
    `;
  }

  updateUI() {
    const user = authService.getCurrentUser();
    
    // Actualizar información del usuario
    const userInfo = document.getElementById('userInfo');
    if (userInfo) {
      userInfo.innerHTML = `
        <div class="user-welcome">
          <h4>Bienvenido, ${user.name}</h4>
          <p class="text-muted">Rol: ${user.role}</p>
        </div>
      `;
    }

    // Actualizar navbar si existe
    const navbar = document.querySelector('.navbar-brand');
    if (navbar) {
      navbar.textContent = 'DocuFlow Dashboard';
    }
  }

  startAutoRefresh() {
    // Refrescar cada 5 minutos
    this.refreshInterval = setInterval(() => {
      this.loadDashboardData();
    }, 300000);
  }

  getActivityIcon(action) {
    const icons = {
      file_upload: 'bi-cloud-upload text-success',
      file_download: 'bi-cloud-download text-info',
      file_delete: 'bi-trash text-danger',
      comment_added: 'bi-chat-dots text-primary',
      task_completed: 'bi-check-circle text-success',
      user_login: 'bi-box-arrow-in-right text-primary'
    };
    return icons[action] || 'bi-info-circle text-muted';
  }

  getActivityText(action) {
    const texts = {
      file_upload: 'subió el archivo',
      file_download: 'descargó el archivo',
      file_delete: 'eliminó el archivo',
      comment_added: 'comentó en',
      task_completed: 'completó la tarea en',
      user_login: 'inició sesión'
    };
    return texts[action] || 'realizó una acción en';
  }

  formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);

    if (diffMins < 1) return 'Hace un momento';
    if (diffMins < 60) return `Hace ${diffMins} minuto${diffMins > 1 ? 's' : ''}`;
    if (diffHours < 24) return `Hace ${diffHours} hora${diffHours > 1 ? 's' : ''}`;
    
    return date.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  destroy() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
  }
}

// Instancia global
const dashboardController = new SimpleDashboardController();

// Hacer disponible globalmente
window.dashboardController = dashboardController;

export default dashboardController;