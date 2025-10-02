// Servicio especializado para sistema de exportación
import { docuFlowAPI } from './apiClient.js';
import { store } from './store.js';
import { showNotification } from '../utils/uiHelpers.js';

class ExportService {
  constructor() {
    this.activeExports = new Map();
    this.exportHistory = [];
    this.scheduledReports = [];
    this.templates = {};
    this.statistics = {
      pdf: 0,
      excel: 0,
      csv: 0,
      scheduled: 0
    };
    
    // Configuraciones predefinidas
    this.presets = {
      quick: {
        pdf: { format: 'A4', orientation: 'portrait', compression: true },
        excel: { autoWidth: true, includeHeaders: true },
        csv: { delimiter: ',', encoding: 'UTF-8' }
      },
      detailed: {
        pdf: { format: 'A4', orientation: 'landscape', includeCharts: true, includeImages: true },
        excel: { charts: true, freeze: true, autoWidth: true },
        csv: { includeHeaders: true, includeMetadata: true }
      },
      minimal: {
        pdf: { format: 'A4', orientation: 'portrait', compression: true, minimal: true },
        excel: { minimal: true, includeHeaders: true },
        csv: { delimiter: ',', minimal: true }
      }
    };

    // Validadores de datos
    this.validators = {
      dateRange: this.validateDateRange.bind(this),
      fileSize: this.validateFileSize.bind(this),
      format: this.validateFormat.bind(this),
      permissions: this.validatePermissions.bind(this)
    };

    this.initializeService();
  }

  // Inicializar el servicio
  async initializeService() {
    try {
      await this.loadExportStatistics();
      await this.loadExportHistory();
      await this.loadScheduledReports();
      await this.loadAvailableTemplates();
      
      // Configurar limpieza automática
      this.setupAutomaticCleanup();
      
      return true;
    } catch (error) {
      console.error('Error initializing export service:', error);
      return false;
    }
  }

  // Generar reporte con configuración personalizada
  async generateReport(type, format, options = {}, preset = 'quick') {
    try {
      // Validar parámetros
      this.validateExportRequest(type, format, options);
      
      // Aplicar preset y merge con opciones personalizadas
      const finalOptions = this.mergeOptionsWithPreset(options, preset, format);
      
      // Verificar permisos
      await this.validatePermissions(type, options);
      
      // Generar ID único para el reporte
      const reportId = this.generateReportId();
      
      // Registrar export en seguimiento
      this.trackExport(reportId, type, format, finalOptions);
      
      // Llamar API según el formato
      let response;
      switch (format) {
        case 'pdf':
          response = await docuFlowAPI.export.generatePdf(type, finalOptions);
          break;
        case 'excel':
          response = await docuFlowAPI.export.generateExcel(type, finalOptions);
          break;
        case 'csv':
          response = await docuFlowAPI.export.generateCsv(type, finalOptions);
          break;
        default:
          throw new Error(`Formato no soportado: ${format}`);
      }
      
      if (response.success) {
        // Actualizar estadísticas
        this.updateStatistics(format);
        
        // Notificar éxito
        this.notifyExportSuccess(type, format);
        
        return {
          success: true,
          reportId,
          data: response.data
        };
      }
      
      throw new Error(response.message || 'Error al generar el reporte');
      
    } catch (error) {
      console.error('Error generating report:', error);
      this.notifyExportError(error.message);
      throw error;
    }
  }

  // Validar solicitud de exportación
  validateExportRequest(type, format, options) {
    // Validar tipo de reporte
    const validTypes = ['dashboard', 'files', 'users', 'logs', 'comments', 'permissions', 'activity', 'custom'];
    if (!validTypes.includes(type)) {
      throw new Error(`Tipo de reporte no válido: ${type}`);
    }

    // Validar formato
    const validFormats = ['pdf', 'excel', 'csv'];
    if (!validFormats.includes(format)) {
      throw new Error(`Formato no válido: ${format}`);
    }

    // Validar rango de fechas
    if (options.dateRange) {
      this.validateDateRange(options.dateRange);
    }

    // Validar tamaño estimado
    if (options.estimatedSize) {
      this.validateFileSize(options.estimatedSize);
    }

    return true;
  }

  // Validar rango de fechas
  validateDateRange(dateRange) {
    if (!dateRange.start || !dateRange.end) {
      return true; // Rango opcional
    }

    const startDate = new Date(dateRange.start);
    const endDate = new Date(dateRange.end);
    const now = new Date();

    if (startDate > endDate) {
      throw new Error('La fecha de inicio no puede ser posterior a la fecha de fin');
    }

    if (startDate > now) {
      throw new Error('La fecha de inicio no puede ser futura');
    }

    // Verificar que el rango no sea excesivamente largo
    const daysDiff = Math.abs(endDate - startDate) / (1000 * 60 * 60 * 24);
    if (daysDiff > 365) {
      throw new Error('El rango de fechas no puede exceder un año');
    }

    return true;
  }

  // Validar tamaño de archivo
  validateFileSize(estimatedSize) {
    const maxSize = 100 * 1024 * 1024; // 100MB
    if (estimatedSize > maxSize) {
      throw new Error('El tamaño estimado del reporte excede el límite permitido (100MB)');
    }
    return true;
  }

  // Validar formato específico
  validateFormat(format, options) {
    if (format === 'pdf' && options.pdf) {
      const validOrientations = ['portrait', 'landscape'];
      if (options.pdf.orientation && !validOrientations.includes(options.pdf.orientation)) {
        throw new Error('Orientación de PDF no válida');
      }
    }
    return true;
  }

  // Validar permisos del usuario
  async validatePermissions(type, options) {
    const user = store.getState('user');
    if (!user) {
      throw new Error('Usuario no autenticado');
    }

    // Verificar permisos según el tipo de reporte
    const requiredPermissions = {
      dashboard: ['read_dashboard'],
      files: ['read_files'],
      users: ['read_users'],
      logs: ['read_logs'],
      comments: ['read_comments'],
      permissions: ['read_permissions', 'admin'],
      activity: ['read_activity'],
      custom: ['export_custom']
    };

    const required = requiredPermissions[type] || [];
    const userPermissions = user.permissions || [];

    const hasPermission = required.some(perm => 
      userPermissions.includes(perm) || user.role === 'admin'
    );

    if (!hasPermission) {
      throw new Error(`No tienes permisos para exportar reportes de tipo: ${type}`);
    }

    return true;
  }

  // Combinar opciones con preset
  mergeOptionsWithPreset(options, preset, format) {
    const presetOptions = this.presets[preset]?.[format] || {};
    
    return {
      ...presetOptions,
      ...options,
      // Preservar configuraciones específicas del formato
      [format]: {
        ...presetOptions,
        ...(options[format] || {})
      }
    };
  }

  // Generar ID único para reporte
  generateReportId() {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 15);
    return `${timestamp}-${random}`;
  }

  // Rastrear exportación activa
  trackExport(reportId, type, format, options) {
    this.activeExports.set(reportId, {
      id: reportId,
      type,
      format,
      options,
      startTime: new Date(),
      status: 'processing',
      progress: 0
    });
  }

  // Actualizar progreso de exportación
  updateExportProgress(reportId, progress, status = 'processing') {
    const exportInfo = this.activeExports.get(reportId);
    if (exportInfo) {
      exportInfo.progress = progress;
      exportInfo.status = status;
      exportInfo.lastUpdate = new Date();
      
      // Emitir evento de progreso
      this.emitProgressEvent(reportId, exportInfo);
    }
  }

  // Emitir evento de progreso
  emitProgressEvent(reportId, exportInfo) {
    const event = new CustomEvent('exportProgress', {
      detail: { reportId, exportInfo }
    });
    document.dispatchEvent(event);
  }

  // Completar exportación
  completeExport(reportId, result) {
    const exportInfo = this.activeExports.get(reportId);
    if (exportInfo) {
      exportInfo.status = 'completed';
      exportInfo.progress = 100;
      exportInfo.endTime = new Date();
      exportInfo.result = result;
      
      // Mover al historial
      this.exportHistory.unshift({
        ...exportInfo,
        completedAt: new Date()
      });
      
      // Remover de activos
      this.activeExports.delete(reportId);
      
      // Emitir evento de completado
      const event = new CustomEvent('exportCompleted', {
        detail: { reportId, result }
      });
      document.dispatchEvent(event);
    }
  }

  // Obtener estado de exportación
  getExportStatus(reportId) {
    return this.activeExports.get(reportId);
  }

  // Cancelar exportación
  async cancelExport(reportId) {
    const exportInfo = this.activeExports.get(reportId);
    if (exportInfo) {
      try {
        // Intentar cancelar en el servidor
        await docuFlowAPI.export.cancelReport?.(reportId);
        
        exportInfo.status = 'cancelled';
        exportInfo.endTime = new Date();
        
        this.activeExports.delete(reportId);
        
        showNotification('Exportación cancelada', 'info');
        return true;
      } catch (error) {
        console.error('Error cancelling export:', error);
        showNotification('Error al cancelar la exportación', 'error');
        return false;
      }
    }
    return false;
  }

  // Programar reporte
  async scheduleReport(scheduleConfig) {
    try {
      // Validar configuración de programación
      this.validateScheduleConfig(scheduleConfig);
      
      const response = await docuFlowAPI.export.scheduleReport(scheduleConfig);
      
      if (response.success) {
        // Actualizar lista local
        this.scheduledReports.push(response.data);
        this.updateStatistics('scheduled', 1);
        
        return response.data;
      }
      
      throw new Error(response.message || 'Error al programar el reporte');
      
    } catch (error) {
      console.error('Error scheduling report:', error);
      throw error;
    }
  }

  // Validar configuración de programación
  validateScheduleConfig(config) {
    const requiredFields = ['reportType', 'format', 'frequency'];
    for (const field of requiredFields) {
      if (!config[field]) {
        throw new Error(`Campo requerido: ${field}`);
      }
    }

    const validFrequencies = ['daily', 'weekly', 'monthly', 'quarterly'];
    if (!validFrequencies.includes(config.frequency)) {
      throw new Error('Frecuencia no válida');
    }

    if (config.recipients && config.recipients.length > 0) {
      config.recipients.forEach(email => {
        if (!this.isValidEmail(email)) {
          throw new Error(`Email no válido: ${email}`);
        }
      });
    }

    return true;
  }

  // Cargar plantillas disponibles
  async loadAvailableTemplates() {
    try {
      const types = ['dashboard', 'files', 'users', 'logs'];
      const templatePromises = types.map(type => 
        docuFlowAPI.export.getAvailableTemplates(type)
      );
      
      const responses = await Promise.all(templatePromises);
      
      responses.forEach((response, index) => {
        if (response.success) {
          this.templates[types[index]] = response.data;
        }
      });
      
    } catch (error) {
      console.error('Error loading templates:', error);
    }
  }

  // Crear plantilla personalizada
  async createCustomTemplate(templateData) {
    try {
      this.validateTemplateData(templateData);
      
      const response = await docuFlowAPI.export.createCustomTemplate(templateData);
      
      if (response.success) {
        // Actualizar plantillas locales
        const type = templateData.type;
        if (!this.templates[type]) {
          this.templates[type] = [];
        }
        this.templates[type].push(response.data);
        
        return response.data;
      }
      
      throw new Error(response.message || 'Error al crear la plantilla');
      
    } catch (error) {
      console.error('Error creating template:', error);
      throw error;
    }
  }

  // Validar datos de plantilla
  validateTemplateData(templateData) {
    const requiredFields = ['name', 'type', 'format', 'config'];
    for (const field of requiredFields) {
      if (!templateData[field]) {
        throw new Error(`Campo requerido en la plantilla: ${field}`);
      }
    }

    if (templateData.name.length < 3) {
      throw new Error('El nombre de la plantilla debe tener al menos 3 caracteres');
    }

    return true;
  }

  // Cargar estadísticas de exportación
  async loadExportStatistics() {
    try {
      const response = await docuFlowAPI.export.getExportStats?.();
      
      if (response?.success) {
        this.statistics = { ...this.statistics, ...response.data };
      }
    } catch (error) {
      console.error('Error loading export statistics:', error);
    }
  }

  // Cargar historial de exportaciones
  async loadExportHistory() {
    try {
      const response = await docuFlowAPI.export.getExportHistory();
      
      if (response.success) {
        this.exportHistory = response.data;
        return this.exportHistory;
      }
    } catch (error) {
      console.error('Error loading export history:', error);
      return [];
    }
  }

  // Cargar reportes programados
  async loadScheduledReports() {
    try {
      const response = await docuFlowAPI.export.getScheduledReports();
      
      if (response.success) {
        this.scheduledReports = response.data;
        return this.scheduledReports;
      }
    } catch (error) {
      console.error('Error loading scheduled reports:', error);
      return [];
    }
  }

  // Actualizar estadísticas
  updateStatistics(format, increment = 1) {
    if (this.statistics.hasOwnProperty(format)) {
      this.statistics[format] += increment;
    }
  }

  // Obtener estadísticas
  getStatistics() {
    return { ...this.statistics };
  }

  // Notificar éxito de exportación
  notifyExportSuccess(type, format) {
    const messages = {
      pdf: 'PDF generado exitosamente',
      excel: 'Archivo Excel generado exitosamente',
      csv: 'Archivo CSV generado exitosamente'
    };
    
    showNotification(messages[format] || 'Reporte generado exitosamente', 'success');
  }

  // Notificar error de exportación
  notifyExportError(message) {
    showNotification(`Error en exportación: ${message}`, 'error');
  }

  // Configurar limpieza automática
  setupAutomaticCleanup() {
    // Limpiar exports completados cada 10 minutos
    setInterval(() => {
      this.cleanupCompletedExports();
    }, 600000);
    
    // Limpiar historial antiguo cada hora
    setInterval(() => {
      this.cleanupOldHistory();
    }, 3600000);
  }

  // Limpiar exports completados
  cleanupCompletedExports() {
    const now = new Date();
    const maxAge = 30 * 60 * 1000; // 30 minutos
    
    for (const [reportId, exportInfo] of this.activeExports.entries()) {
      if (exportInfo.status === 'completed' && 
          now - exportInfo.endTime > maxAge) {
        this.activeExports.delete(reportId);
      }
    }
  }

  // Limpiar historial antiguo
  cleanupOldHistory() {
    const maxHistoryItems = 100;
    if (this.exportHistory.length > maxHistoryItems) {
      this.exportHistory = this.exportHistory.slice(0, maxHistoryItems);
    }
  }

  // Utilidades
  isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  formatDuration(startTime, endTime) {
    const duration = endTime - startTime;
    const seconds = Math.floor(duration / 1000);
    const minutes = Math.floor(seconds / 60);
    
    if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    }
    return `${seconds}s`;
  }

  // Obtener presets disponibles
  getAvailablePresets() {
    return Object.keys(this.presets);
  }

  // Obtener configuración de preset
  getPresetConfig(preset, format) {
    return this.presets[preset]?.[format] || {};
  }

  // Limpiar servicio
  cleanup() {
    // Cancelar todas las exportaciones activas
    for (const reportId of this.activeExports.keys()) {
      this.cancelExport(reportId);
    }
    
    this.activeExports.clear();
  }
}

// Crear instancia del servicio
const exportService = new ExportService();

export { ExportService, exportService };
export default exportService;