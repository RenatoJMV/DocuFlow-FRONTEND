import { docuFlowAPI } from '../../shared/services/apiClient.js';
import { initializeNavbar, showNotification, formatDate } from '../../shared/utils/uiHelpers.js';

class ExportController {
  constructor() {
    this.currentUser = JSON.parse(localStorage.getItem('user') || '{}');
    this.exportHistory = [];
    
    this.initializeComponents();
    this.setupEventListeners();
    this.loadExportHistory();
  }

  initializeComponents() {
    initializeNavbar('export');
    this.setupDatePickers();
  }

  setupDatePickers() {
    const today = new Date();
    const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, today.getDate());
    
    // Establecer fechas por defecto
    const startDateInputs = document.querySelectorAll('input[name="startDate"]');
    startDateInputs.forEach(input => {
      input.value = lastMonth.toISOString().split('T')[0];
    });
    
    const endDateInputs = document.querySelectorAll('input[name="endDate"]');
    endDateInputs.forEach(input => {
      input.value = today.toISOString().split('T')[0];
    });
  }

  setupEventListeners() {
    // Formularios de exportación
    const exportFormsIds = ['exportFilesForm', 'exportLogsForm', 'exportStatsForm'];
    exportFormsIds.forEach(formId => {
      const form = document.getElementById(formId);
      if (form) {
        form.addEventListener('submit', (e) => this.handleExport(e, formId));
      }
    });

    // Botones de descarga rápida
    const quickExportBtns = document.querySelectorAll('.quick-export-btn');
    quickExportBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const exportType = btn.dataset.exportType;
        this.quickExport(exportType);
      });
    });

    // Botón de limpiar historial
    const clearHistoryBtn = document.getElementById('clearHistoryBtn');
    if (clearHistoryBtn) {
      clearHistoryBtn.addEventListener('click', () => this.clearHistory());
    }

    // Botón de refrescar historial
    const refreshHistoryBtn = document.getElementById('refreshHistoryBtn');
    if (refreshHistoryBtn) {
      refreshHistoryBtn.addEventListener('click', () => this.loadExportHistory());
    }
  }

  async handleExport(e, formType) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const exportParams = this.buildExportParams(formData, formType);
    
    try {
      this.setFormLoading(formType, true);
      
      let exportData;
      let fileName;
      let mimeType = 'application/json';
      
      switch (formType) {
        case 'exportFilesForm':
          exportData = await docuFlowAPI.export.files(exportParams);
          fileName = `files-export-${this.getDateString()}.json`;
          break;
          
        case 'exportLogsForm':
          exportData = await docuFlowAPI.export.logs(exportParams);
          fileName = `logs-export-${this.getDateString()}.json`;
          break;
          
        case 'exportStatsForm':
          exportData = await docuFlowAPI.export.stats();
          fileName = `stats-export-${this.getDateString()}.json`;
          break;
          
        default:
          throw new Error('Tipo de exportación no válido');
      }
      
      // Descargar archivo
      this.downloadFile(exportData, fileName, mimeType);
      
      // Agregar al historial
      this.addToHistory({
        type: formType.replace('Form', '').replace('export', ''),
        fileName: fileName,
        timestamp: new Date().toISOString(),
        size: this.calculateSize(exportData),
        params: exportParams
      });
      
      showNotification('Exportación completada exitosamente', 'success');
      
    } catch (error) {
      console.error('Error during export:', error);
      showNotification('Error durante la exportación', 'error');
    } finally {
      this.setFormLoading(formType, false);
    }
  }

  buildExportParams(formData, formType) {
    const params = {};
    
    // Parámetros comunes
    if (formData.get('startDate')) {
      params.startDate = formData.get('startDate');
    }
    if (formData.get('endDate')) {
      params.endDate = formData.get('endDate');
    }
    
    // Parámetros específicos según el tipo
    switch (formType) {
      case 'exportFilesForm':
        if (formData.get('fileType')) params.fileType = formData.get('fileType');
        if (formData.get('userId')) params.userId = formData.get('userId');
        if (formData.get('includeMetadata')) params.includeMetadata = true;
        if (formData.get('includeComments')) params.includeComments = true;
        break;
        
      case 'exportLogsForm':
        if (formData.get('logType')) params.type = formData.get('logType');
        if (formData.get('userId')) params.userId = formData.get('userId');
        if (formData.get('minLevel')) params.minLevel = formData.get('minLevel');
        break;
        
      case 'exportStatsForm':
        if (formData.get('includeUsers')) params.includeUsers = true;
        if (formData.get('includeFiles')) params.includeFiles = true;
        if (formData.get('includeActivity')) params.includeActivity = true;
        break;
    }
    
    return params;
  }

  async quickExport(exportType) {
    const today = new Date();
    const lastWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    const defaultParams = {
      startDate: lastWeek.toISOString().split('T')[0],
      endDate: today.toISOString().split('T')[0]
    };
    
    try {
      this.setQuickExportLoading(exportType, true);
      
      let exportData;
      let fileName;
      
      switch (exportType) {
        case 'files':
          exportData = await docuFlowAPI.export.files(defaultParams);
          fileName = `quick-files-export-${this.getDateString()}.json`;
          break;
          
        case 'logs':
          exportData = await docuFlowAPI.export.logs(defaultParams);
          fileName = `quick-logs-export-${this.getDateString()}.json`;
          break;
          
        case 'stats':
          exportData = await docuFlowAPI.export.stats();
          fileName = `quick-stats-export-${this.getDateString()}.json`;
          break;
          
        default:
          throw new Error('Tipo de exportación rápida no válido');
      }
      
      this.downloadFile(exportData, fileName, 'application/json');
      
      this.addToHistory({
        type: `quick-${exportType}`,
        fileName: fileName,
        timestamp: new Date().toISOString(),
        size: this.calculateSize(exportData),
        params: defaultParams
      });
      
      showNotification(`Exportación rápida de ${exportType} completada`, 'success');
      
    } catch (error) {
      console.error('Error during quick export:', error);
      showNotification('Error durante la exportación rápida', 'error');
    } finally {
      this.setQuickExportLoading(exportType, false);
    }
  }

  downloadFile(data, fileName, mimeType) {
    let content;
    
    if (typeof data === 'object') {
      content = JSON.stringify(data, null, 2);
    } else {
      content = data;
    }
    
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  addToHistory(exportInfo) {
    this.exportHistory.unshift(exportInfo);
    
    // Limitar historial a últimas 50 exportaciones
    if (this.exportHistory.length > 50) {
      this.exportHistory = this.exportHistory.slice(0, 50);
    }
    
    // Guardar en localStorage
    localStorage.setItem('exportHistory', JSON.stringify(this.exportHistory));
    
    this.renderHistory();
    this.updateStats();
  }

  loadExportHistory() {
    try {
      const stored = localStorage.getItem('exportHistory');
      this.exportHistory = stored ? JSON.parse(stored) : [];
      this.renderHistory();
      this.updateStats();
    } catch (error) {
      console.error('Error loading export history:', error);
      this.exportHistory = [];
    }
  }

  renderHistory() {
    const container = document.getElementById('exportHistoryContainer');
    if (!container) return;

    if (this.exportHistory.length === 0) {
      container.innerHTML = `
        <div class="text-center text-muted py-4">
          <i class="bi bi-clock-history fs-1 mb-3"></i>
          <p>No hay historial de exportaciones</p>
          <small>Las exportaciones aparecerán aquí cuando las realices.</small>
        </div>
      `;
      return;
    }

    container.innerHTML = this.exportHistory.map(item => this.renderHistoryItem(item)).join('');
  }

  renderHistoryItem(item) {
    const typeInfo = this.getExportTypeInfo(item.type);
    
    return `
      <div class="export-history-item mb-2">
        <div class="card">
          <div class="card-body py-3">
            <div class="row align-items-center">
              <div class="col-auto">
                <div class="export-icon ${typeInfo.colorClass}">
                  <i class="bi ${typeInfo.icon}"></i>
                </div>
              </div>
              <div class="col">
                <div class="d-flex justify-content-between align-items-start">
                  <div>
                    <h6 class="mb-1">${typeInfo.label}</h6>
                    <div class="text-muted small">
                      <span class="me-3">
                        <i class="bi bi-file-text me-1"></i>
                        ${this.escapeHtml(item.fileName)}
                      </span>
                      <span class="me-3">
                        <i class="bi bi-clock me-1"></i>
                        ${formatDate(item.timestamp)}
                      </span>
                      <span class="me-3">
                        <i class="bi bi-hdd me-1"></i>
                        ${item.size}
                      </span>
                    </div>
                    ${item.params && Object.keys(item.params).length > 0 ? `
                      <div class="mt-1">
                        <small class="text-muted">
                          Parámetros: ${this.formatParams(item.params)}
                        </small>
                      </div>
                    ` : ''}
                  </div>
                  <div class="text-end">
                    <button class="btn btn-sm btn-outline-primary repeat-export-btn" 
                            data-export-type="${item.type}" 
                            data-params='${JSON.stringify(item.params || {})}' 
                            title="Repetir exportación">
                      <i class="bi bi-arrow-clockwise"></i>
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

  getExportTypeInfo(type) {
    const types = {
      'Files': {
        icon: 'bi-file-earmark-text',
        label: 'Exportación de Archivos',
        colorClass: 'text-primary'
      },
      'Logs': {
        icon: 'bi-journal-text',
        label: 'Exportación de Logs',
        colorClass: 'text-info'
      },
      'Stats': {
        icon: 'bi-bar-chart',
        label: 'Exportación de Estadísticas',
        colorClass: 'text-success'
      },
      'quick-files': {
        icon: 'bi-lightning',
        label: 'Exportación Rápida - Archivos',
        colorClass: 'text-warning'
      },
      'quick-logs': {
        icon: 'bi-lightning',
        label: 'Exportación Rápida - Logs',
        colorClass: 'text-warning'
      },
      'quick-stats': {
        icon: 'bi-lightning',
        label: 'Exportación Rápida - Estadísticas',
        colorClass: 'text-warning'
      }
    };
    
    return types[type] || {
      icon: 'bi-download',
      label: 'Exportación',
      colorClass: 'text-secondary'
    };
  }

  formatParams(params) {
    return Object.entries(params)
      .map(([key, value]) => `${key}: ${value}`)
      .join(', ');
  }

  clearHistory() {
    if (!confirm('¿Estás seguro de que deseas limpiar el historial de exportaciones?')) {
      return;
    }
    
    this.exportHistory = [];
    localStorage.removeItem('exportHistory');
    this.renderHistory();
    this.updateStats();
    showNotification('Historial de exportaciones limpiado', 'success');
  }

  updateStats() {
    const totalExports = this.exportHistory.length;
    const todayExports = this.exportHistory.filter(item => {
      const itemDate = new Date(item.timestamp).toDateString();
      const today = new Date().toDateString();
      return itemDate === today;
    }).length;
    
    const totalSize = this.exportHistory.reduce((sum, item) => {
      return sum + this.parseSizeToBytes(item.size);
    }, 0);
    
    this.updateStatCard('totalExports', totalExports);
    this.updateStatCard('todayExports', todayExports);
    this.updateStatCard('totalSize', this.formatBytes(totalSize));
  }

  updateStatCard(elementId, value) {
    const element = document.getElementById(elementId);
    if (element) {
      element.textContent = value;
    }
  }

  parseSizeToBytes(sizeStr) {
    if (!sizeStr) return 0;
    const units = { 'B': 1, 'KB': 1024, 'MB': 1024*1024, 'GB': 1024*1024*1024 };
    const match = sizeStr.match(/^([\d.]+)\s*([A-Z]+)$/);
    if (match) {
      const [, size, unit] = match;
      return parseFloat(size) * (units[unit] || 1);
    }
    return 0;
  }

  formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  calculateSize(data) {
    const jsonString = typeof data === 'string' ? data : JSON.stringify(data);
    const bytes = new Blob([jsonString]).size;
    return this.formatBytes(bytes);
  }

  getDateString() {
    return new Date().toISOString().split('T')[0];
  }

  setFormLoading(formType, isLoading) {
    const form = document.getElementById(formType);
    if (!form) return;
    
    const submitBtn = form.querySelector('button[type="submit"]');
    if (submitBtn) {
      submitBtn.disabled = isLoading;
      if (isLoading) {
        submitBtn.dataset.originalText = submitBtn.textContent;
        submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Exportando...';
      } else {
        submitBtn.textContent = submitBtn.dataset.originalText || 'Exportar';
      }
    }
  }

  setQuickExportLoading(exportType, isLoading) {
    const btn = document.querySelector(`[data-export-type="${exportType}"]`);
    if (!btn) return;
    
    btn.disabled = isLoading;
    if (isLoading) {
      btn.dataset.originalText = btn.textContent;
      btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Exportando...';
    } else {
      btn.textContent = btn.dataset.originalText || 'Exportar';
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
  new ExportController();
});

export default ExportController;