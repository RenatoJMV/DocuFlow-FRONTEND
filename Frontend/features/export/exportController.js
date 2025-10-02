// Controller completo para sistema de exportación de datos
import { docuFlowAPI } from '../../shared/services/apiClient.js';
import { store } from '../../shared/services/store.js';
import { showNotification, showLoading, hideLoading } from '../../shared/utils/uiHelpers.js';

class ExportController {
  constructor() {
    this.currentExports = [];
    this.exportHistory = [];
    this.scheduledReports = [];
    this.availableTemplates = {};
    this.exportProgress = new Map();
    
    // Configuraciones por defecto
    this.defaultOptions = {
      pdf: {
        format: 'A4',
        orientation: 'portrait',
        margins: { top: 20, bottom: 20, left: 20, right: 20 },
        includeCharts: true,
        includeImages: true,
        compression: true
      },
      excel: {
        sheetName: 'Datos',
        includeHeaders: true,
        autoWidth: true,
        freeze: true,
        charts: true
      },
      csv: {
        delimiter: ',',
        encoding: 'UTF-8',
        includeHeaders: true,
        quote: '"'
      }
    };

    // Tipos de reportes disponibles
    this.reportTypes = {
      dashboard: {
        name: 'Estadísticas del Dashboard',
        description: 'Resumen general del sistema con métricas principales',
        formats: ['pdf', 'excel', 'csv'],
        icon: 'fa-chart-pie'
      },
      files: {
        name: 'Reporte de Archivos',
        description: 'Lista detallada de archivos con metadatos',
        formats: ['pdf', 'excel', 'csv'],
        icon: 'fa-file-alt'
      },
      users: {
        name: 'Reporte de Usuarios',
        description: 'Información de usuarios y actividad',
        formats: ['pdf', 'excel', 'csv'],
        icon: 'fa-users'
      },
      logs: {
        name: 'Registros del Sistema',
        description: 'Logs de actividad y eventos del sistema',
        formats: ['pdf', 'excel', 'csv'],
        icon: 'fa-list-alt'
      },
      comments: {
        name: 'Reporte de Comentarios',
        description: 'Comentarios y discusiones por archivo',
        formats: ['pdf', 'excel', 'csv'],
        icon: 'fa-comments'
      },
      permissions: {
        name: 'Reporte de Permisos',
        description: 'Permisos y roles de usuarios',
        formats: ['pdf', 'excel'],
        icon: 'fa-shield-alt'
      },
      activity: {
        name: 'Actividad del Sistema',
        description: 'Actividad detallada de usuarios y sistema',
        formats: ['pdf', 'excel', 'csv'],
        icon: 'fa-history'
      },
      custom: {
        name: 'Reporte Personalizado',
        description: 'Reporte con datos y filtros personalizados',
        formats: ['pdf', 'excel', 'csv'],
        icon: 'fa-cogs'
      }
    };

    this.initializeController();
  }

  // Inicializar el controlador
  async initializeController() {
    try {
      this.initializeEventListeners();
      this.renderReportTypes();
      await this.loadExportHistory();
      await this.loadScheduledReports();
      this.initializeExportProgress();
      this.setupPeriodicUpdates();
    } catch (error) {
      console.error('Error initializing export controller:', error);
      showNotification('Error al inicializar el sistema de exportación', 'error');
    }
  }

  // Inicializar event listeners
  initializeEventListeners() {
    // Botones de exportación rápida
    const quickExportButtons = document.querySelectorAll('.quick-export-btn');
    quickExportButtons.forEach(button => {
      button.addEventListener('click', this.handleQuickExport.bind(this));
    });

    // Formulario de exportación personalizada
    const customExportForm = document.getElementById('custom-export-form');
    if (customExportForm) {
      customExportForm.addEventListener('submit', this.handleCustomExport.bind(this));
    }

    // Selector de tipo de reporte
    const reportTypeSelector = document.getElementById('report-type-selector');
    if (reportTypeSelector) {
      reportTypeSelector.addEventListener('change', this.handleReportTypeChange.bind(this));
    }

    // Selector de formato
    const formatSelectors = document.querySelectorAll('input[name="export-format"]');
    formatSelectors.forEach(selector => {
      selector.addEventListener('change', this.handleFormatChange.bind(this));
    });

    // Botón de vista previa
    const previewButton = document.getElementById('preview-export-btn');
    if (previewButton) {
      previewButton.addEventListener('click', this.handlePreviewExport.bind(this));
    }

    // Botón de programar reporte
    const scheduleButton = document.getElementById('schedule-report-btn');
    if (scheduleButton) {
      scheduleButton.addEventListener('click', this.showScheduleModal.bind(this));
    }

    // Formulario de programación
    const scheduleForm = document.getElementById('schedule-report-form');
    if (scheduleForm) {
      scheduleForm.addEventListener('submit', this.handleScheduleReport.bind(this));
    }

    // Filtros de fecha
    this.initializeDateFilters();
    
    // Plantillas personalizadas
    this.initializeTemplateManagement();
  }

  // Renderizar tipos de reportes
  renderReportTypes() {
    const container = document.getElementById('report-types-container');
    if (!container) return;

    const typesHTML = Object.entries(this.reportTypes).map(([key, type]) => `
      <div class="report-type-card" data-type="${key}">
        <div class="report-type-icon">
          <i class="fas ${type.icon}"></i>
        </div>
        <div class="report-type-info">
          <h6 class="report-type-name">${type.name}</h6>
          <p class="report-type-description">${type.description}</p>
          <div class="report-type-formats">
            ${type.formats.map(format => `
              <span class="format-badge">${format.toUpperCase()}</span>
            `).join('')}
          </div>
        </div>
        <div class="report-type-actions">
          <button type="button" class="btn btn-sm btn-outline-primary quick-export-btn" 
                  data-type="${key}" data-format="pdf">
            <i class="fas fa-file-pdf me-1"></i>PDF
          </button>
          <button type="button" class="btn btn-sm btn-outline-success quick-export-btn" 
                  data-type="${key}" data-format="excel">
            <i class="fas fa-file-excel me-1"></i>Excel
          </button>
          <button type="button" class="btn btn-sm btn-outline-info quick-export-btn" 
                  data-type="${key}" data-format="csv">
            <i class="fas fa-file-csv me-1"></i>CSV
          </button>
        </div>
      </div>
    `).join('');

    container.innerHTML = typesHTML;

    // Agregar event listeners a los nuevos botones
    container.querySelectorAll('.quick-export-btn').forEach(button => {
      button.addEventListener('click', this.handleQuickExport.bind(this));
    });
  }

  // Manejar exportación rápida
  async handleQuickExport(event) {
    const button = event.currentTarget;
    const type = button.getAttribute('data-type');
    const format = button.getAttribute('data-format');

    if (!this.reportTypes[type].formats.includes(format)) {
      showNotification(`El formato ${format.toUpperCase()} no está disponible para este tipo de reporte`, 'warning');
      return;
    }

    try {
      showLoading(`Generando ${format.toUpperCase()}...`);
      
      const options = this.getDefaultOptionsForType(type, format);
      const response = await this.generateReport(type, format, options);
      
      if (response.success) {
        await this.handleReportGenerated(response.data);
        this.updateExportHistory();
      }
    } catch (error) {
      console.error('Error in quick export:', error);
      showNotification('Error al generar el reporte', 'error');
    } finally {
      hideLoading();
    }
  }

  // Manejar exportación personalizada
  async handleCustomExport(event) {
    event.preventDefault();
    
    const formData = new FormData(event.target);
    const exportConfig = this.extractExportConfig(formData);
    
    try {
      // Validar configuración
      this.validateExportConfig(exportConfig);
      
      showLoading(`Generando ${exportConfig.format.toUpperCase()} personalizado...`);
      
      const response = await this.generateReport(
        exportConfig.type, 
        exportConfig.format, 
        exportConfig.options
      );
      
      if (response.success) {
        await this.handleReportGenerated(response.data);
        this.updateExportHistory();
        showNotification('Reporte personalizado generado exitosamente', 'success');
      }
    } catch (error) {
      console.error('Error in custom export:', error);
      showNotification(error.message || 'Error al generar el reporte personalizado', 'error');
    } finally {
      hideLoading();
    }
  }

  // Extraer configuración de exportación del formulario
  extractExportConfig(formData) {
    const config = {
      type: formData.get('report-type'),
      format: formData.get('export-format'),
      options: {
        dateRange: {
          start: formData.get('date-start'),
          end: formData.get('date-end')
        },
        filters: {
          includeArchived: formData.get('include-archived') === 'on',
          includeDeleted: formData.get('include-deleted') === 'on',
          userIds: formData.getAll('user-filter'),
          departments: formData.getAll('department-filter'),
          fileTypes: formData.getAll('file-type-filter')
        },
        customization: {
          includeCharts: formData.get('include-charts') === 'on',
          includeImages: formData.get('include-images') === 'on',
          includeMetadata: formData.get('include-metadata') === 'on',
          groupBy: formData.get('group-by'),
          sortBy: formData.get('sort-by'),
          sortOrder: formData.get('sort-order')
        }
      }
    };

    // Agregar opciones específicas del formato
    if (config.format === 'pdf') {
      config.options.pdf = {
        orientation: formData.get('pdf-orientation') || 'portrait',
        format: formData.get('pdf-format') || 'A4',
        template: formData.get('pdf-template')
      };
    } else if (config.format === 'excel') {
      config.options.excel = {
        sheetName: formData.get('excel-sheet-name') || 'Datos',
        includeCharts: formData.get('excel-charts') === 'on',
        autoWidth: formData.get('excel-auto-width') === 'on'
      };
    } else if (config.format === 'csv') {
      config.options.csv = {
        delimiter: formData.get('csv-delimiter') || ',',
        encoding: formData.get('csv-encoding') || 'UTF-8'
      };
    }

    return config;
  }

  // Validar configuración de exportación
  validateExportConfig(config) {
    if (!config.type || !this.reportTypes[config.type]) {
      throw new Error('Tipo de reporte no válido');
    }

    if (!config.format || !this.reportTypes[config.type].formats.includes(config.format)) {
      throw new Error('Formato no compatible con el tipo de reporte seleccionado');
    }

    // Validar fechas
    if (config.options.dateRange.start && config.options.dateRange.end) {
      const startDate = new Date(config.options.dateRange.start);
      const endDate = new Date(config.options.dateRange.end);
      
      if (startDate > endDate) {
        throw new Error('La fecha de inicio no puede ser posterior a la fecha de fin');
      }
      
      if (startDate > new Date()) {
        throw new Error('La fecha de inicio no puede ser futura');
      }
    }

    return true;
  }

  // Generar reporte
  async generateReport(type, format, options = {}) {
    const mergedOptions = {
      ...this.defaultOptions[format],
      ...options
    };

    switch (format) {
      case 'pdf':
        return await docuFlowAPI.export.generatePdf(type, mergedOptions);
      case 'excel':
        return await docuFlowAPI.export.generateExcel(type, mergedOptions);
      case 'csv':
        return await docuFlowAPI.export.generateCsv(type, mergedOptions);
      default:
        throw new Error(`Formato no soportado: ${format}`);
    }
  }

  // Manejar reporte generado
  async handleReportGenerated(reportData) {
    const reportId = reportData.reportId;
    
    // Iniciar seguimiento de progreso
    this.trackReportProgress(reportId);
    
    // Si el reporte está listo inmediatamente, descargarlo
    if (reportData.status === 'completed') {
      await this.downloadReport(reportId, reportData.format);
    } else {
      // Mostrar progreso y esperar
      this.showProgressModal(reportId, reportData);
    }
  }

  // Seguir progreso del reporte
  async trackReportProgress(reportId) {
    const progressContainer = document.getElementById('export-progress-container');
    if (!progressContainer) return;

    const progressHTML = `
      <div class="export-progress-item" id="progress-${reportId}">
        <div class="d-flex justify-content-between align-items-center mb-2">
          <span class="export-filename">Reporte ${reportId}</span>
          <span class="export-status badge bg-info">Procesando...</span>
        </div>
        <div class="progress mb-2">
          <div class="progress-bar progress-bar-striped progress-bar-animated" 
               role="progressbar" style="width: 0%"></div>
        </div>
        <div class="export-actions">
          <button type="button" class="btn btn-sm btn-outline-secondary" 
                  onclick="window.exportController?.cancelExport('${reportId}')">
            <i class="fas fa-times me-1"></i>Cancelar
          </button>
        </div>
      </div>
    `;

    progressContainer.insertAdjacentHTML('beforeend', progressHTML);

    // Iniciar polling de progreso
    this.pollReportProgress(reportId);
  }

  // Hacer polling del progreso del reporte
  async pollReportProgress(reportId) {
    const maxAttempts = 60; // 5 minutos máximo
    let attempts = 0;

    const poll = async () => {
      try {
        const response = await docuFlowAPI.export.getReportStatus(reportId);
        
        if (response.success) {
          const status = response.data;
          this.updateProgressDisplay(reportId, status);
          
          if (status.status === 'completed') {
            await this.downloadReport(reportId, status.format);
            this.removeProgressDisplay(reportId);
            return;
          }
          
          if (status.status === 'error') {
            this.handleReportError(reportId, status.error);
            return;
          }
          
          // Continuar polling si aún está procesando
          if (status.status === 'processing' && attempts < maxAttempts) {
            attempts++;
            setTimeout(poll, 5000); // Poll cada 5 segundos
          } else if (attempts >= maxAttempts) {
            this.handleReportTimeout(reportId);
          }
        }
      } catch (error) {
        console.error('Error polling report progress:', error);
        this.handleReportError(reportId, 'Error de conexión');
      }
    };

    poll();
  }

  // Actualizar visualización del progreso
  updateProgressDisplay(reportId, status) {
    const progressItem = document.getElementById(`progress-${reportId}`);
    if (!progressItem) return;

    const progressBar = progressItem.querySelector('.progress-bar');
    const statusBadge = progressItem.querySelector('.export-status');

    if (progressBar) {
      progressBar.style.width = `${status.progress || 0}%`;
    }

    if (statusBadge) {
      statusBadge.textContent = this.getStatusText(status.status);
      statusBadge.className = `badge ${this.getStatusClass(status.status)}`;
    }
  }

  // Obtener texto del estado
  getStatusText(status) {
    const statusTexts = {
      queued: 'En cola',
      processing: 'Procesando...',
      completed: 'Completado',
      error: 'Error',
      cancelled: 'Cancelado'
    };
    return statusTexts[status] || status;
  }

  // Obtener clase CSS del estado
  getStatusClass(status) {
    const statusClasses = {
      queued: 'bg-secondary',
      processing: 'bg-info',
      completed: 'bg-success',
      error: 'bg-danger',
      cancelled: 'bg-warning'
    };
    return statusClasses[status] || 'bg-secondary';
  }

  // Descargar reporte
  async downloadReport(reportId, format) {
    try {
      await docuFlowAPI.export.downloadReport(reportId, format);
      showNotification('Descarga iniciada', 'success');
    } catch (error) {
      console.error('Error downloading report:', error);
      showNotification('Error al descargar el reporte', 'error');
    }
  }

  // Manejar vista previa
  async handlePreviewExport(event) {
    event.preventDefault();
    
    const formData = new FormData(document.getElementById('custom-export-form'));
    const exportConfig = this.extractExportConfig(formData);
    
    try {
      showLoading('Generando vista previa...');
      
      const response = await docuFlowAPI.export.getReportPreview(
        exportConfig.type,
        exportConfig.options
      );
      
      if (response.success) {
        this.showPreviewModal(response.data);
      }
    } catch (error) {
      console.error('Error generating preview:', error);
      showNotification('Error al generar la vista previa', 'error');
    } finally {
      hideLoading();
    }
  }

  // Mostrar modal de vista previa
  showPreviewModal(previewData) {
    const modal = document.getElementById('preview-modal');
    if (!modal) return;

    const previewContainer = modal.querySelector('#preview-content');
    if (previewContainer) {
      previewContainer.innerHTML = this.renderPreviewContent(previewData);
    }

    const bootstrapModal = new bootstrap.Modal(modal);
    bootstrapModal.show();
  }

  // Renderizar contenido de vista previa
  renderPreviewContent(previewData) {
    return `
      <div class="preview-header">
        <h6>Vista Previa del Reporte</h6>
        <p class="text-muted">Mostrando las primeras ${previewData.sampleSize || 10} filas</p>
      </div>
      <div class="preview-table-container">
        <table class="table table-sm table-bordered">
          <thead class="table-light">
            <tr>
              ${previewData.headers.map(header => `<th>${header}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${previewData.rows.map(row => `
              <tr>
                ${row.map(cell => `<td>${this.formatPreviewCell(cell)}</td>`).join('')}
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      <div class="preview-footer">
        <p class="text-muted">
          Total de registros: ${previewData.totalRows || 'N/A'} | 
          Columnas: ${previewData.headers.length}
        </p>
      </div>
    `;
  }

  // Formatear celda de vista previa
  formatPreviewCell(cell) {
    if (cell === null || cell === undefined) return '<em class="text-muted">null</em>';
    if (typeof cell === 'boolean') return cell ? 'Sí' : 'No';
    if (typeof cell === 'number') return cell.toLocaleString('es-ES');
    if (typeof cell === 'string' && cell.length > 50) {
      return cell.substring(0, 50) + '...';
    }
    return String(cell);
  }

  // Cargar historial de exportaciones
  async loadExportHistory() {
    try {
      const response = await docuFlowAPI.export.getExportHistory();
      
      if (response.success) {
        this.exportHistory = response.data;
        this.renderExportHistory();
      }
    } catch (error) {
      console.error('Error loading export history:', error);
    }
  }

  // Renderizar historial de exportaciones
  renderExportHistory() {
    const container = document.getElementById('export-history-container');
    if (!container) return;

    if (this.exportHistory.length === 0) {
      container.innerHTML = `
        <div class="text-center py-4">
          <i class="fas fa-history text-muted mb-3" style="font-size: 2rem;"></i>
          <p class="text-muted">No hay exportaciones recientes</p>
        </div>
      `;
      return;
    }

    const historyHTML = this.exportHistory.map(item => `
      <div class="export-history-item">
        <div class="d-flex justify-content-between align-items-start">
          <div class="export-info">
            <div class="export-title">
              <i class="fas ${this.reportTypes[item.type]?.icon || 'fa-file'}"></i>
              ${this.reportTypes[item.type]?.name || item.type}
            </div>
            <div class="export-details">
              <span class="format-badge">${item.format.toUpperCase()}</span>
              <span class="text-muted">•</span>
              <span class="export-date">${this.formatDate(item.createdAt)}</span>
              <span class="text-muted">•</span>
              <span class="export-size">${this.formatFileSize(item.fileSize)}</span>
            </div>
          </div>
          <div class="export-actions">
            <span class="badge ${this.getStatusClass(item.status)}">${this.getStatusText(item.status)}</span>
            ${item.status === 'completed' ? `
              <button type="button" class="btn btn-sm btn-outline-primary ms-2" 
                      onclick="window.exportController?.downloadReport('${item.id}', '${item.format}')">
                <i class="fas fa-download"></i>
              </button>
            ` : ''}
            <button type="button" class="btn btn-sm btn-outline-danger ms-1" 
                    onclick="window.exportController?.deleteReport('${item.id}')">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </div>
      </div>
    `).join('');

    container.innerHTML = historyHTML;
  }

  // Programar reporte
  async handleScheduleReport(event) {
    event.preventDefault();
    
    const formData = new FormData(event.target);
    const scheduleData = {
      reportType: formData.get('schedule-report-type'),
      format: formData.get('schedule-format'),
      frequency: formData.get('schedule-frequency'),
      time: formData.get('schedule-time'),
      recipients: formData.getAll('schedule-recipients'),
      options: this.getDefaultOptionsForType(
        formData.get('schedule-report-type'),
        formData.get('schedule-format')
      )
    };

    try {
      const response = await docuFlowAPI.export.scheduleReport(scheduleData);
      
      if (response.success) {
        showNotification('Reporte programado exitosamente', 'success');
        await this.loadScheduledReports();
        
        // Cerrar modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('schedule-modal'));
        modal?.hide();
      }
    } catch (error) {
      console.error('Error scheduling report:', error);
      showNotification('Error al programar el reporte', 'error');
    }
  }

  // Obtener opciones por defecto para un tipo
  getDefaultOptionsForType(type, format) {
    const baseOptions = { ...this.defaultOptions[format] };
    
    // Personalizar según el tipo de reporte
    switch (type) {
      case 'dashboard':
        return {
          ...baseOptions,
          includeCharts: true,
          sections: ['stats', 'activity', 'charts']
        };
      case 'files':
        return {
          ...baseOptions,
          includeMetadata: true,
          includeThumbnails: format === 'pdf'
        };
      case 'logs':
        return {
          ...baseOptions,
          dateRange: {
            start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            end: new Date().toISOString().split('T')[0]
          }
        };
      default:
        return baseOptions;
    }
  }

  // Utilidades de formato
  formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  // Inicializar filtros de fecha
  initializeDateFilters() {
    const startDateInput = document.getElementById('date-start');
    const endDateInput = document.getElementById('date-end');

    if (startDateInput && endDateInput) {
      // Establecer fecha máxima como hoy
      const today = new Date().toISOString().split('T')[0];
      startDateInput.max = today;
      endDateInput.max = today;

      // Sincronizar fechas
      startDateInput.addEventListener('change', () => {
        endDateInput.min = startDateInput.value;
      });

      endDateInput.addEventListener('change', () => {
        startDateInput.max = endDateInput.value;
      });
    }
  }

  // Inicializar gestión de plantillas
  initializeTemplateManagement() {
    const templateSelector = document.getElementById('template-selector');
    if (templateSelector) {
      templateSelector.addEventListener('change', this.handleTemplateChange.bind(this));
    }

    const createTemplateBtn = document.getElementById('create-template-btn');
    if (createTemplateBtn) {
      createTemplateBtn.addEventListener('click', this.showCreateTemplateModal.bind(this));
    }
  }

  // Configurar actualizaciones periódicas
  setupPeriodicUpdates() {
    // Actualizar historial cada 30 segundos
    setInterval(() => {
      this.loadExportHistory();
    }, 30000);

    // Limpiar exports completados cada 5 minutos
    setInterval(() => {
      this.cleanupCompletedExports();
    }, 300000);
  }

  // Inicializar progreso de exportación
  initializeExportProgress() {
    const progressContainer = document.getElementById('export-progress-container');
    if (progressContainer) {
      progressContainer.innerHTML = '<p class="text-muted text-center">No hay exportaciones en progreso</p>';
    }
  }

  // Limpiar exports completados
  cleanupCompletedExports() {
    const progressContainer = document.getElementById('export-progress-container');
    if (!progressContainer) return;

    const completedItems = progressContainer.querySelectorAll('.export-progress-item');
    completedItems.forEach(item => {
      const statusBadge = item.querySelector('.export-status');
      if (statusBadge && statusBadge.textContent === 'Completado') {
        item.remove();
      }
    });

    if (progressContainer.children.length === 0) {
      progressContainer.innerHTML = '<p class="text-muted text-center">No hay exportaciones en progreso</p>';
    }
  }

  // Cargar reportes programados
  async loadScheduledReports() {
    try {
      const response = await docuFlowAPI.export.getScheduledReports();
      
      if (response.success) {
        this.scheduledReports = response.data;
        this.renderScheduledReports();
      }
    } catch (error) {
      console.error('Error loading scheduled reports:', error);
    }
  }

  // Renderizar reportes programados
  renderScheduledReports() {
    const container = document.getElementById('scheduled-reports-container');
    if (!container) return;

    if (this.scheduledReports.length === 0) {
      container.innerHTML = `
        <div class="text-center py-4">
          <i class="fas fa-calendar-alt text-muted mb-3" style="font-size: 2rem;"></i>
          <p class="text-muted">No hay reportes programados</p>
        </div>
      `;
      return;
    }

    const scheduledHTML = this.scheduledReports.map(schedule => `
      <div class="scheduled-report-item">
        <div class="d-flex justify-content-between align-items-center">
          <div class="schedule-info">
            <div class="schedule-title">
              <i class="fas ${this.reportTypes[schedule.reportType]?.icon || 'fa-file'}"></i>
              ${this.reportTypes[schedule.reportType]?.name || schedule.reportType}
            </div>
            <div class="schedule-details">
              <span class="format-badge">${schedule.format.toUpperCase()}</span>
              <span class="text-muted">•</span>
              <span class="schedule-frequency">${this.formatFrequency(schedule.frequency)}</span>
              <span class="text-muted">•</span>
              <span class="schedule-time">${schedule.time}</span>
            </div>
          </div>
          <div class="schedule-actions">
            <span class="badge bg-info">Activo</span>
            <button type="button" class="btn btn-sm btn-outline-danger ms-2" 
                    onclick="window.exportController?.cancelScheduledReport('${schedule.id}')">
              <i class="fas fa-times"></i>
            </button>
          </div>
        </div>
      </div>
    `).join('');

    container.innerHTML = scheduledHTML;
  }

  // Formatear frecuencia
  formatFrequency(frequency) {
    const frequencies = {
      daily: 'Diario',
      weekly: 'Semanal',
      monthly: 'Mensual',
      quarterly: 'Trimestral'
    };
    return frequencies[frequency] || frequency;
  }

  // Cancelar reporte programado
  async cancelScheduledReport(scheduleId) {
    try {
      const response = await docuFlowAPI.export.cancelScheduledReport(scheduleId);
      
      if (response.success) {
        await this.loadScheduledReports();
        showNotification('Reporte programado cancelado', 'success');
      }
    } catch (error) {
      console.error('Error cancelling scheduled report:', error);
      showNotification('Error al cancelar el reporte programado', 'error');
    }
  }

  // Eliminar reporte
  async deleteReport(reportId) {
    if (!confirm('¿Estás seguro de que deseas eliminar este reporte?')) {
      return;
    }

    try {
      const response = await docuFlowAPI.export.deleteReport(reportId);
      
      if (response.success) {
        await this.loadExportHistory();
        showNotification('Reporte eliminado exitosamente', 'success');
      }
    } catch (error) {
      console.error('Error deleting report:', error);
      showNotification('Error al eliminar el reporte', 'error');
    }
  }

  // Actualizar historial
  async updateExportHistory() {
    await this.loadExportHistory();
  }

  // Destruir controlador
  destroy() {
    // Limpiar event listeners si es necesario
    const quickExportButtons = document.querySelectorAll('.quick-export-btn');
    quickExportButtons.forEach(button => {
      button.removeEventListener('click', this.handleQuickExport);
    });
  }
}

// Exportar controlador
export default ExportController;

// Inicializar controlador cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
  window.exportController = new ExportController();
});