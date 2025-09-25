// Dashboard Controller moderno con store y API client
import { store } from '../../shared/services/store.js';
import { docuFlowAPI } from '../../shared/services/apiClient.js';
import { initializeNavbar, showNotification, formatDate, formatRelativeTime } from '../../shared/utils/uiHelpers.js';

class DashboardController {
  constructor() {
    this.unsubscribers = [];
    this.refreshInterval = null;
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
      showNotification('Error al cargar el dashboard', 'error');
    }
  }

  setupStoreSubscriptions() {
    // Suscribirse a cambios en las estadísticas del dashboard
    const dashboardUnsubscriber = store.subscribe('dashboard', (dashboard) => {
      this.updateWidgets(dashboard.stats);
      this.updateActivityTable(dashboard.recentActivity);
    });
    
    // Suscribirse a cambios en archivos
    const filesUnsubscriber = store.subscribe('files', (files) => {
      store.updateDashboardStats({ totalFiles: files.length });
    });

    // Suscribirse a cambios en comentarios
    const commentsUnsubscriber = store.subscribe('comments', (comments) => {
      store.updateDashboardStats({ totalComments: comments.length });
    });

    this.unsubscribers.push(dashboardUnsubscriber, filesUnsubscriber, commentsUnsubscriber);
  }

  async loadDashboardData() {
    try {
      store.setLoading(true);

      // Cargar estadísticas del dashboard
      const [statsResult, activityResult] = await Promise.allSettled([
        docuFlowAPI.dashboard.getStats(),
        docuFlowAPI.dashboard.getRecentActivity()
      ]);

      if (statsResult.status === 'fulfilled' && statsResult.value.success) {
        store.updateDashboardStats(statsResult.value.data);
      } else {
        // Datos de demostración si no hay backend
        this.loadDemoData();
      }

      if (activityResult.status === 'fulfilled' && activityResult.value.success) {
        const dashboard = store.getState('dashboard');
        store.setState('dashboard', {
          ...dashboard,
          recentActivity: activityResult.value.data
        });
      } else {
        this.loadDemoActivity();
      }

    } catch (error) {
      console.error('Error loading dashboard data:', error);
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
      },
      {
        id: 4,
        type: 'permission_changed',
        file: 'Proyecto_Confidencial.doc',
        action: 'Permisos',
        user: 'Admin',
        timestamp: new Date(Date.now() - 60 * 60000).toISOString(),
        status: 'warning'
      },
      {
        id: 5,
        type: 'file_error',
        file: 'Archivo_Corrupto.pdf',
        action: 'Error',
        user: 'Sistema',
        timestamp: new Date(Date.now() - 120 * 60000).toISOString(),
        status: 'danger'
      }
    ];

    const dashboard = store.getState('dashboard');
    store.setState('dashboard', {
      ...dashboard,
      recentActivity: demoActivity
    });
  }

  updateWidgets(stats) {
    // Actualizar valores de widgets
    this.updateWidgetValue('widget-files', stats.totalFiles);
    this.updateWidgetValue('widget-users', stats.totalUsers);
    this.updateWidgetValue('widget-comments', stats.totalComments);
    this.updateWidgetValue('widget-downloads', stats.downloadsToday);
    
    // Actualizar estadísticas laterales
    this.updateWidgetValue('stat-documents', stats.documents);
    this.updateWidgetValue('stat-processed', stats.processed);
    this.updateWidgetValue('stat-pending', stats.pending);
    this.updateWidgetValue('stat-errors', stats.errors);
  }

  updateWidgetValue(elementId, value, animateUp = true) {
    const element = document.getElementById(elementId);
    if (!element) return;

    // Animar cambio de valor
    element.style.transform = animateUp ? 'translateY(-10px)' : 'translateY(10px)';
    element.style.opacity = '0.7';
    
    setTimeout(() => {
      element.textContent = this.formatNumber(value);
      element.style.transform = 'translateY(0)';
      element.style.opacity = '1';
    }, 150);
  }

  updateTrends(trends) {
    this.updateTrendElement('files-trend', trends.files);
    this.updateTrendElement('users-trend', trends.users);
    this.updateTrendElement('comments-trend', trends.comments);
    this.updateTrendElement('downloads-trend', trends.downloads);
  }

  updateTrendElement(elementId, value) {
    const element = document.getElementById(elementId);
    if (!element) return;

    element.textContent = value > 0 ? `+${value}%` : `${value}%`;
    element.className = value > 0 ? 'trend-up' : value < 0 ? 'trend-down' : 'trend-neutral';
  }

  updateActivityTable(activities) {
    const tbody = document.getElementById('activity-table');
    if (!tbody || !activities || activities.length === 0) {
      if (tbody) {
        tbody.innerHTML = `
          <tr>
            <td colspan="5" class="text-center text-muted py-4">
              <div class="d-flex flex-column align-items-center">
                <i class="bi bi-clock-history display-6 text-muted mb-2"></i>
                <p class="mb-0">Sin actividad reciente</p>
                <small class="text-muted">Los eventos aparecerán aquí cuando ocurran</small>
              </div>
            </td>
          </tr>
        `;
      }
      return;
    }

    tbody.innerHTML = activities.map(activity => `
      <tr class="animate-fade-in">
        <td>
          <div class="d-flex align-items-center">
            <i class="bi bi-${this.getFileIcon(activity.file)} me-2 text-primary"></i>
            <span class="fw-medium">${activity.file}</span>
          </div>
        </td>
        <td>
          <span class="badge bg-${this.getActionColor(activity.type)} bg-opacity-10 text-${this.getActionColor(activity.type)}">
            ${activity.action}
          </span>
        </td>
        <td>
          <div class="d-flex align-items-center">
            <div class="avatar-sm me-2">
              <div class="avatar-title rounded-circle bg-primary bg-opacity-10 text-primary">
                ${activity.user.charAt(0).toUpperCase()}
              </div>
            </div>
            ${activity.user}
          </div>
        </td>
        <td>
          <small class="text-muted" title="${formatDate(activity.timestamp)}">
            ${formatRelativeTime(activity.timestamp)}
          </small>
        </td>
        <td>
          <span class="status-badge status-${activity.status}">
            ${this.getStatusText(activity.status)}
          </span>
        </td>
      </tr>
    `).join('');
  }

  getFileIcon(filename) {
    if (!filename) return 'file-earmark';
    
    const ext = filename.split('.').pop().toLowerCase();
    const iconMap = {
      pdf: 'file-pdf',
      doc: 'file-word',
      docx: 'file-word',
      xls: 'file-excel',
      xlsx: 'file-excel',
      ppt: 'file-ppt',
      pptx: 'file-ppt',
      jpg: 'file-image',
      jpeg: 'file-image',
      png: 'file-image',
      gif: 'file-image',
      txt: 'file-text',
      zip: 'file-zip'
    };
    
    return iconMap[ext] || 'file-earmark';
  }

  getActionColor(type) {
    const colorMap = {
      file_upload: 'success',
      file_download: 'info',
      comment_added: 'warning',
      permission_changed: 'primary',
      file_error: 'danger',
      file_deleted: 'secondary'
    };
    
    return colorMap[type] || 'secondary';
  }

  getStatusText(status) {
    const statusMap = {
      success: 'Exitoso',
      info: 'Info',
      warning: 'Advertencia',
      danger: 'Error',
      secondary: 'Procesando'
    };
    
    return statusMap[status] || status;
  }

  formatNumber(num) {
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
    window.showQuickActions = () => this.showQuickActions();
    window.exportActivity = () => this.exportActivity();
    window.filterActivity = () => this.filterActivity();
  }

  async refreshDashboard() {
    showNotification('Actualizando dashboard...', 'info', 1000);
    await this.loadDashboardData();
    showNotification('Dashboard actualizado', 'success');
  }

  showQuickActions() {
    // Aquí podrías mostrar un modal con acciones rápidas
    showNotification('Función de acciones rápidas próximamente', 'info');
  }

  exportActivity() {
    const activities = store.getState('dashboard').recentActivity;
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
  }

  filterActivity() {
    showNotification('Función de filtrado próximamente', 'info');
  }

  setupAutoRefresh() {
    // Actualizar cada 5 minutos
    this.refreshInterval = setInterval(() => {
      this.loadDashboardData();
    }, 5 * 60 * 1000);
  }

  destroy() {
    // Limpiar suscriptores
    this.unsubscribers.forEach(unsubscribe => unsubscribe());
    
    // Limpiar interval
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
    
    // Limpiar funciones globales
    delete window.refreshDashboard;
    delete window.showQuickActions;
    delete window.exportActivity;
    delete window.filterActivity;
  }
}

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
  window.dashboardController = new DashboardController();
});

// Limpiar al salir de la página
window.addEventListener('beforeunload', () => {
  if (window.dashboardController) {
    window.dashboardController.destroy();
  }
});
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
      },
      {
        id: 4,
        type: 'permission_changed',
        file: 'Proyecto_Confidencial.doc',
        action: 'Permisos',
        user: 'Admin',
        timestamp: new Date(Date.now() - 60 * 60000).toISOString(),
        status: 'warning'
      },
      {
        id: 5,
        type: 'file_error',
        file: 'Archivo_Corrupto.pdf',
        action: 'Error',
        user: 'Sistema',
        timestamp: new Date(Date.now() - 120 * 60000).toISOString(),
        status: 'danger'
      }
    ];

    const dashboard = store.getState('dashboard');
    store.setState('dashboard', {
      ...dashboard,
      recentActivity: demoActivity
    });
  }

  updateWidgets(stats) {
    // Actualizar valores de widgets
    this.updateWidgetValue('widget-files', stats.totalFiles);
    this.updateWidgetValue('widget-users', stats.totalUsers);
    this.updateWidgetValue('widget-comments', stats.totalComments);
    this.updateWidgetValue('widget-downloads', stats.downloadsToday);
    
    // Actualizar estadísticas laterales
    this.updateWidgetValue('stat-documents', stats.documents);
    this.updateWidgetValue('stat-processed', stats.processed);
    this.updateWidgetValue('stat-pending', stats.pending);
    this.updateWidgetValue('stat-errors', stats.errors);
  }

  updateWidgetValue(elementId, value, animateUp = true) {
    const element = document.getElementById(elementId);
    if (!element) return;

    // Animar cambio de valor
    element.style.transform = animateUp ? 'translateY(-10px)' : 'translateY(10px)';
    element.style.opacity = '0.7';
    
    setTimeout(() => {
      element.textContent = this.formatNumber(value);
      element.style.transform = 'translateY(0)';
      element.style.opacity = '1';
    }, 150);
  }

  updateTrends(trends) {
    this.updateTrendElement('files-trend', trends.files);
    this.updateTrendElement('users-trend', trends.users);
    this.updateTrendElement('comments-trend', trends.comments);
    this.updateTrendElement('downloads-trend', trends.downloads);
  }

  updateTrendElement(elementId, value) {
    const element = document.getElementById(elementId);
    if (!element) return;

    element.textContent = value > 0 ? `+${value}%` : `${value}%`;
    element.className = value > 0 ? 'trend-up' : value < 0 ? 'trend-down' : 'trend-neutral';
  }

  updateActivityTable(activities) {
    const tbody = document.getElementById('activity-table');
    if (!tbody || !activities || activities.length === 0) {
      if (tbody) {
        tbody.innerHTML = `
          <tr>
            <td colspan="5" class="text-center text-muted py-4">
              <div class="d-flex flex-column align-items-center">
                <i class="bi bi-clock-history display-6 text-muted mb-2"></i>
                <p class="mb-0">Sin actividad reciente</p>
                <small class="text-muted">Los eventos aparecerán aquí cuando ocurran</small>
              </div>
            </td>
          </tr>
        `;
      }
      return;
    }

    tbody.innerHTML = activities.map(activity => `
      <tr class="animate-fade-in">
        <td>
          <div class="d-flex align-items-center">
            <i class="bi bi-${this.getFileIcon(activity.file)} me-2 text-primary"></i>
            <span class="fw-medium">${activity.file}</span>
          </div>
        </td>
        <td>
          <span class="badge bg-${this.getActionColor(activity.type)} bg-opacity-10 text-${this.getActionColor(activity.type)}">
            ${activity.action}
          </span>
        </td>
        <td>
          <div class="d-flex align-items-center">
            <div class="avatar-sm me-2">
              <div class="avatar-title rounded-circle bg-primary bg-opacity-10 text-primary">
                ${activity.user.charAt(0).toUpperCase()}
              </div>
            </div>
            ${activity.user}
          </div>
        </td>
        <td>
          <small class="text-muted" title="${formatDate(activity.timestamp)}">
            ${formatRelativeTime(activity.timestamp)}
          </small>
        </td>
        <td>
          <span class="status-badge status-${activity.status}">
            ${this.getStatusText(activity.status)}
          </span>
        </td>
      </tr>
    `).join('');
  }

  getFileIcon(filename) {
    if (!filename) return 'file-earmark';
    
    const ext = filename.split('.').pop().toLowerCase();
    const iconMap = {
      pdf: 'file-pdf',
      doc: 'file-word',
      docx: 'file-word',
      xls: 'file-excel',
      xlsx: 'file-excel',
      ppt: 'file-ppt',
      pptx: 'file-ppt',
      jpg: 'file-image',
      jpeg: 'file-image',
      png: 'file-image',
      gif: 'file-image',
      txt: 'file-text',
      zip: 'file-zip'
    };
    
    return iconMap[ext] || 'file-earmark';
  }

  getActionColor(type) {
    const colorMap = {
      file_upload: 'success',
      file_download: 'info',
      comment_added: 'warning',
      permission_changed: 'primary',
      file_error: 'danger',
      file_deleted: 'secondary'
    };
    
    return colorMap[type] || 'secondary';
  }

  getStatusText(status) {
    const statusMap = {
      success: 'Exitoso',
      info: 'Info',
      warning: 'Advertencia',
      danger: 'Error',
      secondary: 'Procesando'
    };
    
    return statusMap[status] || status;
  }

  formatNumber(num) {
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
    window.showQuickActions = () => this.showQuickActions();
    window.exportActivity = () => this.exportActivity();
    window.filterActivity = () => this.filterActivity();
  }

  async refreshDashboard() {
    showNotification('Actualizando dashboard...', 'info', 1000);
    await this.loadDashboardData();
    showNotification('Dashboard actualizado', 'success');
  }

  showQuickActions() {
    // Aquí podrías mostrar un modal con acciones rápidas
    showNotification('Función de acciones rápidas próximamente', 'info');
  }

  exportActivity() {
    const activities = store.getState('dashboard').recentActivity;
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
  }

  filterActivity() {
    showNotification('Función de filtrado próximamente', 'info');
  }

  setupAutoRefresh() {
    // Actualizar cada 5 minutos
    this.refreshInterval = setInterval(() => {
      this.loadDashboardData();
    }, 5 * 60 * 1000);
  }

  destroy() {
    // Limpiar suscriptores
    this.unsubscribers.forEach(unsubscribe => unsubscribe());
    
    // Limpiar interval
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
    
    // Limpiar funciones globales
    delete window.refreshDashboard;
    delete window.showQuickActions;
    delete window.exportActivity;
    delete window.filterActivity;
  }
}

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
  window.dashboardController = new DashboardController();
});

// Limpiar al salir de la página
window.addEventListener('beforeunload', () => {
  if (window.dashboardController) {
    window.dashboardController.destroy();
  }
});
  label.appendChild(select);
  label.appendChild(span);

  // Insertar debajo del widget de comentarios
  const widget = document.getElementById('widget-comments');
  if (widget && widget.parentElement) {
    widget.parentElement.appendChild(label);
  }

  select.addEventListener('change', async (e) => {
    const docId = Number(e.target.value);
    if (!docId) {
      span.textContent = '';
      return;
    }
    const { success, comments } = await apiGetCommentsByDocument(docId);
    span.textContent = success ? ` ${comments.length}` : ' error';
  });
}

async function loadDashboard() {
  const token = getToken();
  if (!token) {
    window.location.href = '../auth/login.html';
    return;
  }

  // Archivos subidos
  const filesRes = await apiGetFiles();
  document.getElementById('widget-files').textContent = filesRes.files?.length ?? 0;

  // Usuarios registrados
  const usersRes = await apiGetUsers();
  document.getElementById('widget-users').textContent = usersRes.users?.length ?? 0;

  // Comentarios (total)
  const commentsCountRes = await apiGetTotalComments();
  document.getElementById('widget-comments').textContent = commentsCountRes.count ?? 0;
  setupDocumentCommentCount();

  // Descargas de hoy
  const downloadsRes = await apiGetDownloadsToday();
  document.getElementById('widget-downloads').textContent = downloadsRes.count ?? 0;

  // Logs / Actividad reciente
  const logsRes = await apiGetLogs();
  const tbody = document.getElementById('activity-table');
  tbody.innerHTML = '';
  if (logsRes.logs && logsRes.logs.length > 0) {
    logsRes.logs.slice(0, 10).forEach(log => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${log.documentName || '-'}</td>
        <td><span class="activity-badge">${log.action}</span></td>
        <td>${log.username}</td>
        <td>${new Date(log.timestamp).toLocaleString()}</td>
      `;
      tbody.appendChild(tr);
    });
  } else {
    tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">Sin actividad reciente</td></tr>';
  }
}

document.addEventListener('DOMContentLoaded', loadDashboard);
