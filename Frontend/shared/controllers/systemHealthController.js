// Controlador de monitoreo de salud del sistema
import { apiClient } from '../../shared/services/apiClient.js';
import { showNotification } from '../../shared/utils/uiHelpers.js';

class SystemHealthController {
  constructor() {
    this.healthData = null;
    this.refreshInterval = null;
    this.isMonitoring = false;
  }

  async init() {
    try {
      await this.loadSystemHealth();
      this.startAutoRefresh();
      this.setupHealthIndicators();
      console.log('✅ Sistema de monitoreo de salud iniciado');
    } catch (error) {
      console.error('❌ Error inicializando monitoreo de salud:', error);
    }
  }

  async loadSystemHealth() {
    try {
      const [generalHealth, dbHealth] = await Promise.allSettled([
        apiClient.get('/health'),
        apiClient.get('/health/db')
      ]);

      // Procesar datos de salud general
      let systemData = {};
      if (generalHealth.status === 'fulfilled' && generalHealth.value) {
        systemData = generalHealth.value;
      }

      // Procesar datos de base de datos
      let dbData = {};
      if (dbHealth.status === 'fulfilled' && dbHealth.value) {
        dbData = dbHealth.value;
      }

      this.healthData = {
        system: systemData,
        database: dbData,
        lastCheck: new Date().toISOString(),
        overallStatus: this.calculateOverallStatus(systemData, dbData)
      };

      this.updateHealthDisplay();
      console.log('📊 Estado del sistema actualizado:', this.healthData);

    } catch (error) {
      console.error('❌ Error obteniendo estado del sistema:', error);
      this.healthData = {
        system: { status: 'DOWN', error: 'No disponible' },
        database: { status: 'DOWN', error: 'No disponible' },
        lastCheck: new Date().toISOString(),
        overallStatus: 'DOWN'
      };
      this.updateHealthDisplay();
    }
  }

  calculateOverallStatus(systemData, dbData) {
    const systemStatus = systemData?.status === 'UP';
    const dbStatus = dbData?.status === 'UP';
    
    if (systemStatus && dbStatus) return 'UP';
    if (!systemStatus && !dbStatus) return 'DOWN';
    return 'DEGRADED';
  }

  updateHealthDisplay() {
    if (!this.healthData) return;

    // Actualizar indicador en navbar
    this.updateNavbarIndicator();
    
    // Actualizar widget de salud si existe
    this.updateHealthWidget();
    
    // Actualizar cualquier modal de salud abierto
    this.updateHealthModal();
  }

  updateNavbarIndicator() {
    const indicator = document.getElementById('system-status-indicator');
    if (indicator) {
      indicator.className = `status-dot status-${this.healthData.overallStatus.toLowerCase()}`;
      indicator.title = `Sistema: ${this.healthData.overallStatus} - Última verificación: ${new Date(this.healthData.lastCheck).toLocaleTimeString()}`;
    }
  }

  updateHealthWidget() {
    const widget = document.getElementById('system-health-widget');
    if (widget && this.healthData) {
      const { system, database, overallStatus, lastCheck } = this.healthData;
      
      widget.innerHTML = `
        <div class="health-summary">
          <div class="health-header d-flex justify-content-between align-items-center mb-2">
            <h6 class="mb-0"><i class="bi bi-heart-pulse"></i> Estado del Sistema</h6>
            <span class="badge bg-${this.getStatusColor(overallStatus)}">${overallStatus}</span>
          </div>
          
          <div class="health-items">
            <div class="health-item d-flex justify-content-between align-items-center">
              <span><i class="bi bi-server"></i> Aplicación</span>
              <span class="status-indicator status-${system?.status?.toLowerCase() || 'down'}">
                ${system?.status || 'DOWN'}
              </span>
            </div>
            
            <div class="health-item d-flex justify-content-between align-items-center">
              <span><i class="bi bi-database"></i> Base de Datos</span>
              <span class="status-indicator status-${database?.status?.toLowerCase() || 'down'}">
                ${database?.status || 'DOWN'}
              </span>
            </div>
            
            ${system?.memoryUsage ? `
              <div class="health-item d-flex justify-content-between align-items-center">
                <span><i class="bi bi-memory"></i> Memoria</span>
                <span class="text-muted">${Math.round(system.memoryUsage)}%</span>
              </div>
            ` : ''}
            
            ${system?.diskUsage ? `
              <div class="health-item d-flex justify-content-between align-items-center">
                <span><i class="bi bi-hdd"></i> Disco</span>
                <span class="text-muted">${Math.round(system.diskUsage)}%</span>
              </div>
            ` : ''}
          </div>
          
          <div class="health-footer mt-2">
            <small class="text-muted">
              <i class="bi bi-clock"></i> 
              Última verificación: ${new Date(lastCheck).toLocaleTimeString()}
            </small>
          </div>
        </div>
      `;
    }
  }

  updateHealthModal() {
    const modal = document.getElementById('system-health-modal');
    if (modal && this.healthData) {
      const body = modal.querySelector('.modal-body');
      if (body) {
        body.innerHTML = this.createDetailedHealthView();
      }
    }
  }

  createDetailedHealthView() {
    const { system, database, overallStatus, lastCheck } = this.healthData;
    
    return `
      <div class="health-details">
        <div class="row">
          <div class="col-md-6">
            <div class="card h-100">
              <div class="card-header d-flex justify-content-between align-items-center">
                <h6 class="mb-0"><i class="bi bi-server"></i> Sistema</h6>
                <span class="badge bg-${this.getStatusColor(system?.status)}">
                  ${system?.status || 'DOWN'}
                </span>
              </div>
              <div class="card-body">
                ${system?.status === 'UP' ? `
                  <div class="metric-row">
                    <span>Tiempo activo:</span>
                    <strong>${system.uptime || 'N/A'}</strong>
                  </div>
                  <div class="metric-row">
                    <span>Memoria total:</span>
                    <strong>${system.totalMemory || 'N/A'}</strong>
                  </div>
                  <div class="metric-row">
                    <span>Memoria libre:</span>
                    <strong>${system.freeMemory || 'N/A'}</strong>
                  </div>
                  <div class="metric-row">
                    <span>Uso de CPU:</span>
                    <strong>${system.cpuUsage ? Math.round(system.cpuUsage) + '%' : 'N/A'}</strong>
                  </div>
                ` : `
                  <div class="alert alert-danger">
                    <i class="bi bi-exclamation-triangle"></i>
                    Sistema no disponible
                    ${system?.error ? `<br><small>${system.error}</small>` : ''}
                  </div>
                `}
              </div>
            </div>
          </div>
          
          <div class="col-md-6">
            <div class="card h-100">
              <div class="card-header d-flex justify-content-between align-items-center">
                <h6 class="mb-0"><i class="bi bi-database"></i> Base de Datos</h6>
                <span class="badge bg-${this.getStatusColor(database?.status)}">
                  ${database?.status || 'DOWN'}
                </span>
              </div>
              <div class="card-body">
                ${database?.status === 'UP' ? `
                  <div class="metric-row">
                    <span>Conexiones activas:</span>
                    <strong>${database.activeConnections || 'N/A'}</strong>
                  </div>
                  <div class="metric-row">
                    <span>Pool de conexiones:</span>
                    <strong>${database.connectionPoolSize || 'N/A'}</strong>
                  </div>
                  <div class="metric-row">
                    <span>Tiempo de respuesta:</span>
                    <strong>${database.responseTime || 'N/A'}ms</strong>
                  </div>
                ` : `
                  <div class="alert alert-danger">
                    <i class="bi bi-exclamation-triangle"></i>
                    Base de datos no disponible
                    ${database?.error ? `<br><small>${database.error}</small>` : ''}
                  </div>
                `}
              </div>
            </div>
          </div>
        </div>
        
        <div class="row mt-3">
          <div class="col-12">
            <div class="card">
              <div class="card-header">
                <h6 class="mb-0"><i class="bi bi-info-circle"></i> Información General</h6>
              </div>
              <div class="card-body">
                <div class="row">
                  <div class="col-md-4">
                    <div class="metric-row">
                      <span>Estado general:</span>
                      <strong class="text-${this.getStatusColor(overallStatus)}">${overallStatus}</strong>
                    </div>
                  </div>
                  <div class="col-md-4">
                    <div class="metric-row">
                      <span>Última verificación:</span>
                      <strong>${new Date(lastCheck).toLocaleString()}</strong>
                    </div>
                  </div>
                  <div class="col-md-4">
                    <div class="metric-row">
                      <span>Monitoreo:</span>
                      <strong class="text-${this.isMonitoring ? 'success' : 'warning'}">
                        ${this.isMonitoring ? 'Activo' : 'Inactivo'}
                      </strong>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  getStatusColor(status) {
    const colors = {
      'UP': 'success',
      'DOWN': 'danger',
      'DEGRADED': 'warning'
    };
    return colors[status] || 'secondary';
  }

  setupHealthIndicators() {
    // Agregar estilos CSS si no existen
    if (!document.getElementById('health-styles')) {
      const styles = document.createElement('style');
      styles.id = 'health-styles';
      styles.textContent = `
        .status-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          display: inline-block;
          position: absolute;
          top: 5px;
          right: 5px;
        }
        
        .status-dot.status-up { background-color: #28a745; }
        .status-dot.status-down { background-color: #dc3545; }
        .status-dot.status-degraded { background-color: #ffc107; }
        
        .status-indicator {
          padding: 2px 8px;
          border-radius: 12px;
          font-size: 0.75rem;
          font-weight: 500;
        }
        
        .status-indicator.status-up {
          background-color: #d4edda;
          color: #155724;
        }
        
        .status-indicator.status-down {
          background-color: #f8d7da;
          color: #721c24;
        }
        
        .status-indicator.status-degraded {
          background-color: #fff3cd;
          color: #856404;
        }
        
        .health-item {
          padding: 4px 0;
          border-bottom: 1px solid #eee;
        }
        
        .health-item:last-child {
          border-bottom: none;
        }
        
        .metric-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 4px 0;
        }
      `;
      document.head.appendChild(styles);
    }
  }

  startAutoRefresh() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
    
    this.isMonitoring = true;
    this.refreshInterval = setInterval(() => {
      this.loadSystemHealth();
    }, 30000); // Verificar cada 30 segundos
    
    console.log('🔄 Monitoreo automático iniciado (30s)');
  }

  stopAutoRefresh() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
    this.isMonitoring = false;
    console.log('⏹️ Monitoreo automático detenido');
  }

  showHealthModal() {
    // Crear modal si no existe
    let modal = document.getElementById('system-health-modal');
    if (!modal) {
      modal = this.createHealthModal();
      document.body.appendChild(modal);
    }
    
    // Actualizar contenido
    this.updateHealthModal();
    
    // Mostrar modal
    const bsModal = new bootstrap.Modal(modal);
    bsModal.show();
  }

  createHealthModal() {
    const modal = document.createElement('div');
    modal.className = 'modal fade';
    modal.id = 'system-health-modal';
    modal.innerHTML = `
      <div class="modal-dialog modal-lg">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">
              <i class="bi bi-heart-pulse"></i> 
              Estado del Sistema
            </h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body">
            <div class="text-center">
              <div class="spinner-border" role="status">
                <span class="visually-hidden">Cargando...</span>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">
              Cerrar
            </button>
            <button type="button" class="btn btn-primary" onclick="systemHealthController.loadSystemHealth()">
              <i class="bi bi-arrow-clockwise"></i> Actualizar
            </button>
          </div>
        </div>
      </div>
    `;
    return modal;
  }

  destroy() {
    this.stopAutoRefresh();
    const modal = document.getElementById('system-health-modal');
    if (modal) {
      modal.remove();
    }
    console.log('🗑️ SystemHealthController destruido');
  }
}

// Instancia global
let systemHealthController = null;

// Función global para mostrar el modal
window.showSystemHealth = function() {
  if (systemHealthController) {
    systemHealthController.showHealthModal();
  } else {
    showNotification('Sistema de monitoreo no disponible', 'warning');
  }
};

export { SystemHealthController };