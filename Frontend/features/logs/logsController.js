import { docuFlowAPI } from '../../shared/services/apiClient.js';
import { store } from '../../shared/services/store.js';
import { enforcePageAuth } from '../../shared/utils/authGuard.js';
import { initializeNavbar, showNotification } from '../../shared/utils/uiHelpers.js';

class LogsController {
  constructor() {
    if (!enforcePageAuth({
      message: 'Debes iniciar sesión para revisar los registros del sistema.'
    })) {
      return;
    }

    this.allLogs = [];
    this.filteredLogs = [];
    this.currentPage = 1;
    this.itemsPerPage = 20;
    this.currentFilters = {
      date: '',
      user: '',
      action: '',
      level: ''
    };
    this.selectedLogId = null;
    this.pagination = null;
    this.actionLookup = null;
    this.levelLookup = null;
    this.timeZone = 'America/Lima';
    this.timeZoneLabel = 'Perú (UTC-5)';
    this.recentLogs = [];
    this.dailyArchives = [];
  this.formatterCache = new Map();
    
    this.initializeComponents();
    this.setupEventListeners();
    this.loadLogs();
  }

  initializeComponents() {
    // Create navbar
    initializeNavbar('logs');
    
    // Setup filters
    this.setupFilters();
    this.updateTimezoneInfo();
  }

  setupFilters() {
    // Populate action filter with available actions
    const actionFilter = document.getElementById('filterAction');
    if (actionFilter) {
      const actions = this.getAvailableActions();
      actionFilter.innerHTML = `
        <option value="">Todas las acciones</option>
        ${actions.map(action => 
          `<option value="${action.id}">${action.name}</option>`
        ).join('')}
      `;
    }

    // Populate level filter
    const levelFilter = document.getElementById('filterLevel');
    if (levelFilter) {
      const levels = this.getAvailableLevels();
      levelFilter.innerHTML = `
        <option value="">Todos los niveles</option>
        ${levels.map(level => 
          `<option value="${level.id}">${level.name}</option>`
        ).join('')}
      `;
    }
  }

  getAvailableActions() {
    return [
      { id: 'login', name: 'Iniciar sesión', icon: 'bi-box-arrow-in-right' },
      { id: 'logout', name: 'Cerrar sesión', icon: 'bi-box-arrow-right' },
      { id: 'session_timeout', name: 'Sesión expirada', icon: 'bi-hourglass-split' },
      { id: 'auth_failure', name: 'Error de autenticación', icon: 'bi-exclamation-octagon' },
      { id: 'upload', name: 'Subir archivo', icon: 'bi-upload' },
      { id: 'file_upload', name: 'Subida de archivo', icon: 'bi-cloud-upload' },
      { id: 'download', name: 'Descargar archivo', icon: 'bi-download' },
      { id: 'file_download', name: 'Descarga de archivo', icon: 'bi-cloud-download' },
      { id: 'delete', name: 'Eliminar archivo', icon: 'bi-trash' },
      { id: 'file_delete', name: 'Eliminación de archivo', icon: 'bi-trash3' },
      { id: 'restore', name: 'Restaurar archivo', icon: 'bi-arrow-counterclockwise' },
      { id: 'file_restore', name: 'Restauración de archivo', icon: 'bi-arrow-counterclockwise' },
      { id: 'edit', name: 'Editar archivo', icon: 'bi-pencil' },
      { id: 'document_update', name: 'Actualizar documento', icon: 'bi-pencil-square' },
      { id: 'view', name: 'Visualizar documento', icon: 'bi-eye' },
      { id: 'document_view', name: 'Visualización de documento', icon: 'bi-eye' },
      { id: 'share', name: 'Compartir archivo', icon: 'bi-share' },
      { id: 'file_share', name: 'Compartir archivo', icon: 'bi-share' },
      { id: 'preview', name: 'Previsualizar', icon: 'bi-eye-fill' },
      { id: 'comment', name: 'Comentar', icon: 'bi-chat-text' },
      { id: 'comment_added', name: 'Comentario agregado', icon: 'bi-chat-left-dots' },
      { id: 'permission_change', name: 'Cambio de permisos', icon: 'bi-shield-check' },
      { id: 'role_change', name: 'Cambio de rol', icon: 'bi-person-gear' },
      { id: 'audit', name: 'Auditoría', icon: 'bi-clipboard-check' },
      { id: 'export', name: 'Exportación', icon: 'bi-download' },
      { id: 'analytics_export', name: 'Exportación de analítica', icon: 'bi-graph-up-arrow' },
      { id: 'integration_sync', name: 'Sincronización', icon: 'bi-arrow-repeat' },
      { id: 'system_health_check', name: 'Chequeo de salud', icon: 'bi-heart-pulse' },
      { id: 'system_error', name: 'Error del sistema', icon: 'bi-exclamation-triangle' },
      { id: 'security_alert', name: 'Alerta de seguridad', icon: 'bi-shield-exclamation' },
      { id: 'api_request', name: 'Llamada API', icon: 'bi-braces' },
      { id: 'unknown', name: 'Evento', icon: 'bi-info-circle' }
    ];
  }

  getAvailableLevels() {
    return [
      { id: 'info', name: 'Información', color: 'info' },
      { id: 'notice', name: 'Aviso', color: 'primary' },
      { id: 'success', name: 'Éxito', color: 'success' },
      { id: 'warning', name: 'Advertencia', color: 'warning' },
      { id: 'error', name: 'Error', color: 'danger' },
      { id: 'critical', name: 'Crítico', color: 'danger' },
      { id: 'fatal', name: 'Fatal', color: 'dark' },
      { id: 'debug', name: 'Debug', color: 'secondary' },
      { id: 'trace', name: 'Trace', color: 'secondary' },
      { id: 'audit', name: 'Auditoría', color: 'info' }
    ];
  }

  ensureLookups() {
    if (!this.actionLookup) {
      this.actionLookup = new Map();
      this.getAvailableActions().forEach((action) => {
        const variants = new Set([
          action.id,
          action.id.replace(/_/g, '-'),
          action.id.replace(/-/g, '_'),
          action.id.replace(/\s+/g, '_'),
          action.id.replace(/\s+/g, '-'),
          action.id.toUpperCase(),
          action.id.toLowerCase()
        ]);

        variants.forEach((variant) => {
          if (!variant) return;
          this.actionLookup.set(variant.toString().toLowerCase(), action);
        });
      });
    }

    if (!this.levelLookup) {
      this.levelLookup = new Map();
      this.getAvailableLevels().forEach((level) => {
        const variants = new Set([
          level.id,
          level.id.replace(/_/g, '-'),
          level.id.replace(/-/g, '_'),
          level.id.toUpperCase(),
          level.id.toLowerCase()
        ]);

        variants.forEach((variant) => {
          if (!variant) return;
          this.levelLookup.set(variant.toString().toLowerCase(), level);
        });
      });
    }
  }

  getActionInfo(actionId) {
    if (!actionId) return null;
    this.ensureLookups();
    return this.actionLookup.get(actionId.toString().toLowerCase()) || null;
  }

  getLevelInfo(levelId) {
    if (!levelId) return null;
    this.ensureLookups();
    return this.levelLookup.get(levelId.toString().toLowerCase()) || null;
  }

  getLogsTableBody() {
    return document.getElementById('recentLogsContainer');
  }

  formatActionLabel(actionId) {
    if (!actionId) return 'Acción';
    return actionId
      .toString()
      .replace(/[_-]+/g, ' ')
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  escapeHtml(value) {
    if (value === null || value === undefined) {
      return '';
    }

    return value
      .toString()
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  normalizeTimestamp(value) {
    if (!value) {
      return new Date().toISOString();
    }

    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
      return new Date().toISOString();
    }

    return date.toISOString();
  }

  normalizeNullableValue(value, { treatNA = true } = {}) {
    if (value === null || value === undefined) {
      return null;
    }

    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed === '') {
        return null;
      }
      if (treatNA && ['n/a', 'na', 'null', 'undefined'].includes(trimmed.toLowerCase())) {
        return null;
      }
      return trimmed;
    }

    return value;
  }

  pickFirstLabel(candidates = [], preferredKeys = [], options = {}) {
    if (!Array.isArray(candidates)) {
      return this.normalizeNullableValue(
        this.extractLabel(candidates, preferredKeys, options)
      );
    }

    for (const candidate of candidates) {
      const label = this.normalizeNullableValue(
        this.extractLabel(candidate, preferredKeys, options)
      );
      if (label) {
        return label;
      }
    }

    return null;
  }

  extractLabel(value, preferredKeys = [], options = {}) {
    if (value === null || value === undefined) {
      return '';
    }

    if (typeof value === 'string') {
      const trimmed = value.trim();
      return trimmed;
    }

    if (typeof value === 'number' || typeof value === 'bigint') {
      return String(value);
    }

    if (value instanceof Date) {
      return value.toISOString();
    }

    if (typeof value === 'boolean') {
      return options.booleanAsWord ? (value ? 'Sí' : 'No') : String(value);
    }

    if (Array.isArray(value)) {
      const parts = value
        .map((item) => this.extractLabel(item, preferredKeys, options))
        .filter(Boolean);
      return parts.join(options.arraySeparator || ', ');
    }

    if (typeof value === 'object') {
      for (const key of preferredKeys) {
        if (Object.prototype.hasOwnProperty.call(value, key)) {
          const label = this.extractLabel(value[key], preferredKeys, options);
          if (label) {
            return label;
          }
        }
      }

      if (options.deep) {
        for (const childValue of Object.values(value)) {
          const deepLabel = this.extractLabel(childValue, preferredKeys, options);
          if (deepLabel) {
            return deepLabel;
          }
        }
      }

      const entries = Object.entries(value)
        .map(([key, val]) => {
          const normalized = this.extractLabel(val, preferredKeys, options);
          if (!normalized) return '';
          if (options.includeKeys === false) {
            return normalized;
          }
          return `${this.formatActionLabel(key)}: ${normalized}`;
        })
        .filter(Boolean);

      return entries.join(options.entrySeparator || ' · ');
    }

    return '';
  }

  resolveUserInfo(raw) {
    const primary = this.pickFirstLabel(
      [
        raw.username,
        raw.user,
        raw.userName,
        raw?.user?.name,
        raw?.user?.username,
        raw.actor,
        raw.performedBy,
        raw.account,
        raw.owner,
        raw.identity,
        raw.email
      ],
      ['name', 'fullName', 'username', 'userName', 'displayName', 'email'],
      { includeKeys: false, deep: true }
    ) || 'Sistema';

    const secondary = this.pickFirstLabel(
      [
        raw?.user?.email,
        raw.email,
        raw?.user?.username,
        raw.metadata?.userEmail,
        raw.details?.userEmail,
        raw.accountEmail
      ],
      ['email', 'username', 'userName'],
      { includeKeys: false, deep: true }
    );

    const target = this.pickFirstLabel(
      [
        raw.target,
        raw.targetUser,
        raw.targetName,
        raw.metadata?.target,
        raw.metadata?.targetName,
        raw.details?.target,
        raw.details?.targetName,
        raw.payload?.target,
        raw.payload?.targetName
      ],
      ['name', 'fullName', 'username', 'userName', 'email'],
      { includeKeys: false, deep: true }
    );

    const normalizedSecondary = secondary && secondary !== primary ? secondary : '';
    const normalizedTarget = target && target !== primary && target !== normalizedSecondary ? target : '';

    return {
      primary,
      secondary: normalizedSecondary,
      target: normalizedTarget
    };
  }

  resolveDetailInfo(raw, actionKey) {
    const primary = this.truncateText(
      this.pickFirstLabel(
        [
          raw.details,
          raw.detail,
          raw.message,
          raw.description,
          raw.eventDescription,
          raw.summary,
          raw.info,
          raw.result,
          raw.payload?.message,
          raw.responseMessage
        ],
        ['message', 'description', 'detail', 'summary', 'info', 'result', 'status', 'reason', 'error'],
        { includeKeys: false, deep: true, arraySeparator: '; ' }
      ) || `${this.formatActionLabel(actionKey)} · Sin detalles`,
      220
    );

    const context = this.truncateText(
      this.pickFirstLabel(
        [
          raw.metadata,
          raw.context,
          raw.payload,
          raw.additionalInfo,
          raw.data,
          raw.resource,
          raw.environment,
          raw.details?.metadata
        ],
        ['fileName', 'documentName', 'name', 'title', 'path', 'reference', 'status', 'changes'],
        { includeKeys: true, deep: true, entrySeparator: ' · ' }
      ),
      260
    );

    return { primary, context };
  }

  resolveDocumentInfo(raw) {
    const sources = [
      raw.document,
      raw.resource,
      raw.entity,
      raw.file,
      raw.payload?.document,
      raw.details?.document,
      raw.metadata?.document
    ];

    const id = this.pickFirstLabel(
      [
        raw.documentId,
        raw.documentReference,
        raw.document?.id,
        raw.document?.documentId,
        raw.details?.documentId,
        raw.metadata?.documentId
      ],
      ['id', 'documentId', 'reference'],
      { includeKeys: false, deep: true }
    );

    const name = this.pickFirstLabel(
      [
        raw.documentName,
        raw.documentTitle,
        raw.document?.name,
        raw.document?.title,
        raw.fileName,
        raw.metadata?.fileName,
        raw.details?.fileName
      ],
      ['name', 'title', 'fileName', 'documentName'],
      { includeKeys: false, deep: true }
    ) || this.pickFirstLabel(
      sources,
      ['name', 'title', 'fileName', 'documentName'],
      { includeKeys: false, deep: true }
    );

    const summary = this.truncateText(
      this.pickFirstLabel(
        sources,
        ['name', 'title', 'fileName', 'documentName', 'path', 'type'],
        { includeKeys: true, deep: true, entrySeparator: ' · ' }
      ),
      200
    );

    return {
      id: id || null,
      name: name || null,
      summary: summary && summary !== name ? summary : ''
    };
  }

  truncateText(value, maxLength = 140) {
    if (!value || typeof value !== 'string') {
      return value || '';
    }

    if (value.length <= maxLength) {
      return value;
    }

    return `${value.slice(0, maxLength - 1)}…`;
  }

  extractLogsArray(payload) {
    if (!payload) return [];
    if (Array.isArray(payload)) return payload;

    const candidates = [
      payload.logs,
      payload.data,
      payload.data?.logs,
      payload.data?.content,
      payload.content,
      payload.items,
      payload.results,
      payload._embedded?.logs
    ];

    for (const candidate of candidates) {
      if (Array.isArray(candidate)) {
        return candidate;
      }
    }

    if (typeof payload === 'object') {
      const nestedArrays = Object.values(payload).filter((value) => Array.isArray(value));
      if (nestedArrays.length === 1) {
        return nestedArrays[0];
      }

      const structured = nestedArrays.find((array) =>
        array.some((item) => item && typeof item === 'object' && (item.action || item.timestamp || item.date))
      );

      if (structured) {
        return structured;
      }
    }

    return [];
  }

  normalizeLogEntry(raw) {
    if (!raw || typeof raw !== 'object') {
      return null;
    }

    const actionCandidate = this.pickFirstLabel(
      [
        raw.action,
        raw.actionType,
        raw.eventType,
        raw.event,
        raw.operation,
        raw.type,
        raw.eventName
      ],
      [],
      { includeKeys: false }
    ) || 'unknown';

    const rawActionString = actionCandidate.toString().trim();
    const normalizedActionKey = rawActionString
      .replace(/[^a-zA-Z0-9_-]+/g, '_')
      .replace(/[_-]+/g, '_')
      .toLowerCase() || 'unknown';

    const actionInfo = this.getActionInfo(normalizedActionKey)
      || this.getActionInfo(rawActionString.toLowerCase())
      || this.getActionInfo(rawActionString.replace(/\s+/g, '-').toLowerCase());

    const levelCandidate = this.pickFirstLabel(
      [
        raw.level,
        raw.severity,
        raw.status,
        raw.logLevel,
        raw.priority
      ],
      [],
      { includeKeys: false }
    );

    const normalizedLevel = (levelCandidate ? levelCandidate.toString().toLowerCase() : '')
      || this.mapActionToLevel(normalizedActionKey);

    const timestampCandidate = this.pickFirstLabel(
      [
        raw.timestamp,
        raw.createdAt,
        raw.eventDate,
        raw.date,
        raw.loggedAt,
        raw.time,
        raw.occurredAt
      ]
    );
    const timestamp = this.normalizeTimestamp(timestampCandidate);

    const userInfo = this.resolveUserInfo(raw);
    const detailInfo = this.resolveDetailInfo(raw, normalizedActionKey);
    const documentInfo = this.resolveDocumentInfo(raw);
    const targetLabel = userInfo.target || this.pickFirstLabel(
      [
        raw.target,
        raw.targetUser,
        raw.targetName,
        raw.metadata?.target,
        raw.metadata?.targetName,
        raw.details?.target,
        raw.details?.targetName,
        raw.payload?.target,
        raw.payload?.targetName
      ],
      ['name', 'fullName', 'username', 'userName', 'email'],
      { includeKeys: false, deep: true }
    ) || null;

    const ip = this.pickFirstLabel(
      [raw.ip, raw.ipAddress, raw.remoteIp, raw.sourceIp, raw.clientIp, raw.originIp]
    ) || 'N/A';

    const userAgent = this.pickFirstLabel(
      [
        raw.userAgent,
        raw.agent,
        raw.userAgentInfo,
        raw.browser,
        raw.device,
        raw.platform,
        raw.environment?.browser
      ],
      ['userAgent', 'browser', 'device', 'platform', 'os'],
      { includeKeys: true, deep: true }
    ) || 'N/A';

    const id = this.pickFirstLabel(
      [raw.id, raw.logId, raw._id, raw.identifier, raw.uuid],
      ['id', 'uuid', 'logId'],
      { includeKeys: false }
    ) || `${Date.now()}-${Math.random().toString(16).slice(2)}`;

    return {
      id,
      timestamp,
      level: normalizedLevel,
      action: normalizedActionKey,
      actionLabel: actionInfo?.name || this.formatActionLabel(normalizedActionKey),
      actionIcon: actionInfo?.icon || null,
      username: userInfo.primary,
      userSecondary: userInfo.secondary,
  targetLabel,
      details: detailInfo.primary,
      detailContext: detailInfo.context,
      ip,
      userAgent,
      documentId: documentInfo.id,
      documentName: documentInfo.name,
      documentSummary: documentInfo.summary
    };
  }

  setupEventListeners() {
    // Filter inputs
    const dateFilter = document.getElementById('filterDate');
    const userFilter = document.getElementById('filterUser');
    const actionFilter = document.getElementById('filterAction');
    const levelFilter = document.getElementById('filterLevel');

    if (dateFilter) {
      dateFilter.addEventListener('change', () => this.applyFilters());
    }

    if (userFilter) {
      userFilter.addEventListener('input', () => this.debounceFilter());
    }

    if (actionFilter) {
      actionFilter.addEventListener('change', () => this.applyFilters());
    }

    if (levelFilter) {
      levelFilter.addEventListener('change', () => this.applyFilters());
    }

    // Action buttons
    const clearFiltersBtn = document.getElementById('clearAllFilters');
    const applyFiltersBtn = document.getElementById('applyFilters');
    const clearDateBtn = document.getElementById('clearDate');
    const refreshBtn = document.getElementById('refreshLogs');
    const exportBtn = document.getElementById('downloadLogs');

    if (clearFiltersBtn) {
      clearFiltersBtn.addEventListener('click', () => this.clearFilters());
    }

    if (applyFiltersBtn) {
      applyFiltersBtn.addEventListener('click', () => this.applyFilters());
    }

    if (clearDateBtn) {
      clearDateBtn.addEventListener('click', () => {
        const dateInput = document.getElementById('filterDate');
        if (dateInput) {
          dateInput.value = '';
        }
        this.applyFilters();
      });
    }

    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => this.loadLogs());
    }

    if (exportBtn) {
      exportBtn.addEventListener('click', () => this.exportLogs());
    }

    const clearOldLogsBtn = document.getElementById('clearOldLogs');
    if (clearOldLogsBtn) {
      clearOldLogsBtn.addEventListener('click', () => this.handleClearOldLogs());
    }

    const exportAnalyticsBtn = document.getElementById('exportAnalytics');
    if (exportAnalyticsBtn) {
      exportAnalyticsBtn.addEventListener('click', () => this.handleExportAnalytics());
    }

    const systemHealthBtn = document.getElementById('systemHealth');
    if (systemHealthBtn) {
      systemHealthBtn.addEventListener('click', () => this.handleSystemHealthCheck());
    }

    // Real-time toggle
    const realtimeToggle = document.getElementById('realtimeToggle');
    if (realtimeToggle) {
      realtimeToggle.addEventListener('change', (e) => {
        this.toggleRealtimeUpdates(e.target.checked);
      });
    }

    const logsTableBody = this.getLogsTableBody();
    if (logsTableBody) {
      logsTableBody.addEventListener('click', (event) => this.handleLogsTableClick(event));
    }

    const archivesList = document.getElementById('dailyArchivesList');
    if (archivesList) {
      archivesList.addEventListener('click', (event) => this.handleArchiveClick(event));
    }
  }

  debounceFilter() {
    clearTimeout(this.filterTimeout);
    this.filterTimeout = setTimeout(() => {
      this.applyFilters();
    }, 300);
  }

  async loadLogs() {
    try {
      // Show loading state
      this.showLoadingState();
      
  // Cargar logs del endpoint real del backend Spring Boot
  console.log('📋 Cargando logs desde el endpoint /api/logs...');
  const response = await docuFlowAPI.logs.getAll();
      
      // Extraer logs del response
      const logs = this.extractLogsArray(response);

      if (Array.isArray(logs) && logs.length > 0) {
        this.ensureLookups();
        this.allLogs = logs
          .map((log) => this.normalizeLogEntry(log))
          .filter(Boolean);

        console.log(`✅ ${this.allLogs.length} logs cargados desde el backend`);
        showNotification(`${this.allLogs.length} registros cargados del servidor`, 'success', 2000);
      } else {
        console.log('⚠️ No se encontraron logs en el servidor');
        this.allLogs = [];
        showNotification('No se encontraron registros en el servidor', 'info', 2000);
      }
      
      this.applyFilters();
      this.updateStats();
      
    } catch (error) {
      console.error('❌ Error cargando logs del backend:', error);
      showNotification('No se pudieron cargar los registros. Verifique la API.', 'warning');
      this.allLogs = [];
      this.applyFilters();
      this.updateStats();
    }
  }

  getFallbackIconForAction(actionKey = '') {
    const key = actionKey?.toString().toLowerCase() || '';

    if (key.includes('upload') || key.includes('create')) {
      return 'bi-cloud-upload';
    }
    if (key.includes('download') || key.includes('export')) {
      return 'bi-cloud-download';
    }
    if (key.includes('delete') || key.includes('remove') || key.includes('purge')) {
      return 'bi-trash';
    }
    if (key.includes('restore') || key.includes('recover')) {
      return 'bi-arrow-counterclockwise';
    }
    if (key.includes('share')) {
      return 'bi-share';
    }
    if (key.includes('view') || key.includes('preview')) {
      return 'bi-eye';
    }
    if (key.includes('comment')) {
      return 'bi-chat-left-text';
    }
    if (key.includes('permission') || key.includes('role')) {
      return 'bi-shield-check';
    }
    if (key.includes('login') || key.includes('auth')) {
      return 'bi-person-lock';
    }
    if (key.includes('logout')) {
      return 'bi-box-arrow-right';
    }
    if (key.includes('sync') || key.includes('integration')) {
      return 'bi-arrow-repeat';
    }
    if (key.includes('health') || key.includes('status')) {
      return 'bi-heart-pulse';
    }
    if (key.includes('error') || key.includes('fail') || key.includes('critical')) {
      return 'bi-exclamation-triangle';
    }
    if (key.includes('warning')) {
      return 'bi-exclamation-diamond';
    }
    return 'bi-activity';
  }

  mapActionToLevel(action) {
    // Mapear acciones del backend a niveles para el frontend
  const normalized = (action || '').toString().toLowerCase();
  const sanitized = normalized.replace(/-/g, '_');
    const actionLevelMap = {
      upload: 'info',
      file_upload: 'info',
      download: 'info',
      file_download: 'info',
      delete: 'warning',
      file_delete: 'warning',
      restore: 'info',
      file_restore: 'info',
      comment: 'info',
      comment_added: 'info',
      login: 'success',
      logout: 'info',
      auth_failure: 'error',
      session_timeout: 'warning',
      error: 'error',
      system_error: 'error',
      security_alert: 'critical',
      permission_change: 'success',
      role_change: 'success',
      analytics_export: 'info',
      export: 'info',
      audit: 'audit',
      system_health_check: 'info',
      integration_sync: 'info',
      api_request: 'info'
    };

    return actionLevelMap[sanitized] || actionLevelMap[normalized] || 'info';
  }

  generateLogDetails(action) {
    const details = {
      login: 'Usuario inició sesión exitosamente',
      logout: 'Usuario cerró sesión',
      upload: 'Archivo subido: documento.pdf',
      download: 'Archivo descargado: reporte.xlsx',
      delete: 'Archivo eliminado permanentemente',
      edit: 'Documento modificado',
      share: 'Documento compartido con 3 usuarios',
      comment: 'Nuevo comentario agregado',
      permission_change: 'Permisos actualizados',
      role_change: 'Rol cambiado a Editor',
      system_error: 'Error en el procesamiento de archivos'
    };
    
    return details[action] || 'Acción realizada';
  }

  showLoadingState() {
    const tbody = this.getLogsTableBody();
    if (tbody) {
      tbody.innerHTML = `
        <div class="timeline-loading">
          <div class="spinner-border text-primary me-2" role="status">
            <span class="visually-hidden">Cargando...</span>
          </div>
          Cargando actividades recientes...
        </div>
      `;
    }
  }

  applyFilters() {
    const dateFilter = document.getElementById('filterDate')?.value || '';
    const userFilterInput = document.getElementById('filterUser');
    const userFilter = userFilterInput?.value ? userFilterInput.value.toLowerCase() : '';
    const actionFilter = document.getElementById('filterAction')?.value || '';
    const levelFilter = document.getElementById('filterLevel')?.value || '';

    this.currentFilters = {
      date: dateFilter,
      user: userFilter,
      action: actionFilter,
      level: levelFilter
    };

    const now = Date.now();
    const threshold = now - (24 * 60 * 60 * 1000);
    const recentLogs = [];
    const archivedLogs = [];

    for (const log of this.allLogs) {
      const timestamp = new Date(log.timestamp).getTime();
      if (Number.isNaN(timestamp)) {
        continue;
      }

      if (timestamp >= threshold) {
        recentLogs.push(log);
      } else {
        archivedLogs.push(log);
      }
    }

  this.recentLogs = recentLogs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  this.dailyArchives = this.buildDailyArchives(archivedLogs);
    this.renderDailyArchives();

    let filtered = [...this.recentLogs];

    if (dateFilter) {
      filtered = filtered.filter((log) => this.formatPeruDateKey(log.timestamp) === dateFilter);
    }

    if (userFilter) {
      filtered = filtered.filter((log) => log.username?.toLowerCase().includes(userFilter));
    }

    if (actionFilter) {
      filtered = filtered.filter((log) => log.action === actionFilter);
    }

    if (levelFilter) {
      filtered = filtered.filter((log) => log.level === levelFilter);
    }

    this.filteredLogs = filtered;

    const selectedVisible = this.filteredLogs.some((log) => String(log.id) === String(this.selectedLogId));
    if (!selectedVisible) {
      this.clearLogDetailsPanel();
    }

    this.renderLogs();
    this.updateAnalytics();
    this.updateFilterInfo();
    this.updateShowingCount();
    this.updateTimezoneInfo();
  }

  renderLogs() {
    const logsToShow = this.filteredLogs;

    const listContainer = this.getLogsTableBody();
    const emptyState = document.getElementById('logsEmptyState');

    if (logsToShow.length === 0) {
      if (listContainer) listContainer.innerHTML = '';
      if (emptyState) emptyState.classList.remove('d-none');
      return;
    }

    if (emptyState) emptyState.classList.add('d-none');

    if (listContainer) {
      listContainer.innerHTML = logsToShow
        .map((log) => this.renderTimelineItem(log, String(log.id) === String(this.selectedLogId)))
        .join('');
    }

    this.highlightSelectedRow();
  }

  renderTimelineItem(log, isSelected = false) {
    const actionInfo = this.getActionInfo(log.action);
    const levelInfo = this.getLevelInfo(log.level);

    const levelLabel = this.escapeHtml(levelInfo?.name || this.formatActionLabel(log.level || 'info'));
    const levelColor = levelInfo?.color || 'secondary';
    const markerClass = levelColor ? `level-${levelColor}` : '';
    const actionLabel = this.escapeHtml(actionInfo?.name || log.actionLabel || this.formatActionLabel(log.action));
    const actionIcon = this.escapeHtml(actionInfo?.icon || this.getFallbackIconForAction(log.action));
    const usernameLabel = this.escapeHtml(log.username || '—');
    const userSecondary = log.userSecondary ? `<div class="timeline-context">${this.escapeHtml(log.userSecondary)}</div>` : '';
    const targetInfo = log.targetLabel ? `<div class="timeline-context">Objetivo: ${this.escapeHtml(log.targetLabel)}</div>` : '';

    const detailsPrimary = this.escapeHtml(log.details || '—');
    const detailContext = log.detailContext ? `<div class="timeline-context">${this.escapeHtml(log.detailContext)}</div>` : '';

    const metadataChips = [];
    if (log.documentName) {
      metadataChips.push(`<span class="timeline-chip"><i class="bi bi-file-earmark-text"></i>${this.escapeHtml(log.documentName)}</span>`);
    }
    if (log.documentId && log.documentId !== log.documentName) {
      metadataChips.push(`<span class="timeline-chip">ID ${this.escapeHtml(String(log.documentId))}</span>`);
    }
    const documentSummary = log.documentSummary ? `<div class="timeline-context">${this.escapeHtml(log.documentSummary)}</div>` : '';
    const metadataBlock = metadataChips.length > 0
      ? `<div class="timeline-chips">${metadataChips.join('')}</div>`
      : '';

    const timestampInfo = this.formatDateTimeForTimeline(log.timestamp);
    const relativeLabel = this.formatRelativeTimestamp(log.timestamp);
    const ipLabel = this.escapeHtml(log.ip || '—');
    const documentIdAttr = log.documentId !== null && log.documentId !== undefined
      ? this.escapeHtml(String(log.documentId))
      : '';

    return `
      <article class="timeline-item${isSelected ? ' selected' : ''}" data-log-id="${log.id}">
        <span class="timeline-marker ${markerClass}"></span>
        <div class="timeline-card">
          <div class="timeline-meta">
            <div>
              <strong>${timestampInfo.dateLabel} · ${timestampInfo.timeLabel}</strong>
              <div class="timeline-relative">
                <i class="bi bi-clock-history"></i>
                <span>${relativeLabel || '—'}</span>
              </div>
            </div>
            <div class="timeline-timezone">
              <i class="bi bi-geo-alt"></i>
              <span>${timestampInfo.zoneLabel}</span>
            </div>
          </div>

          <div class="timeline-content">
            <div class="timeline-title">
              <span class="timeline-level badge bg-${levelColor}">${levelLabel}</span>
              <i class="bi ${actionIcon} text-primary"></i>
              <span>${actionLabel}</span>
            </div>

            <div class="timeline-user">
              <strong>${usernameLabel}</strong>
              ${userSecondary}
              ${targetInfo}
            </div>

            <div class="timeline-details">${detailsPrimary}</div>
            ${detailContext}
            ${metadataBlock}
            ${documentSummary}

            <div class="timeline-ip">IP: ${ipLabel}</div>

            <div class="timeline-actions">
              <button class="btn btn-sm btn-outline-primary" data-action="view" data-log-id="${log.id}">
                <i class="bi bi-eye"></i>
              </button>
              ${(log.documentId !== null && log.documentId !== undefined) || log.documentName ? `
                <button class="btn btn-sm btn-outline-info" data-action="document" data-log-id="${log.id}" data-document-id="${documentIdAttr}" ${log.documentName ? `data-document-name="${this.escapeHtml(log.documentName)}"` : ''}>
                  <i class="bi bi-file-earmark"></i>
                </button>
              ` : ''}
            </div>
          </div>
        </div>
      </article>
    `;
  }

  handleLogsTableClick(event) {
    const actionButton = event.target.closest('[data-action]');
    if (actionButton) {
      const logId = actionButton.dataset.logId;
      const action = actionButton.dataset.action;

      if (action === 'view') {
        this.showLogDetails(logId);
      } else if (action === 'document') {
        this.showLogDetails(logId);
        this.goToDocument(actionButton.dataset.documentId);
      }

      event.preventDefault();
      event.stopPropagation();
      return;
    }

    const item = event.target.closest('[data-log-id]');
    if (!item) return;

    this.showLogDetails(item.dataset.logId);
  }

  handleArchiveClick(event) {
    const downloadButton = event.target.closest('[data-archive-download]');
    if (!downloadButton) {
      return;
    }

    const archiveDate = downloadButton.dataset.archiveDownload;
    const archive = this.dailyArchives.find((item) => item.dateKey === archiveDate);
    if (!archive) {
      showNotification('No se encontró el archivo solicitado.', 'warning');
      return;
    }

    this.downloadArchive(archive);
  }

  highlightSelectedRow() {
    const container = this.getLogsTableBody();
    if (!container) return;

    container.querySelectorAll('.timeline-item').forEach((item) => {
      const isSelected = item.dataset.logId === String(this.selectedLogId);
      item.classList.toggle('selected', isSelected);
    });
  }

  populateLogDetails(log) {
    const placeholder = document.querySelector('#logDetailsContent .empty-details');
    const detailsPanel = document.getElementById('logDetails');

    if (placeholder) {
      placeholder.classList.add('d-none');
    }

    if (detailsPanel) {
      detailsPanel.classList.remove('d-none');
    }

    const setText = (id, value) => {
      const element = document.getElementById(id);
      if (element) {
        element.textContent = value ?? '—';
      }
    };

  setText('detailId', log.id);
  const timelineInfo = this.formatDateTimeForTimeline(log.timestamp);
  setText('detailTimestamp', `${timelineInfo.dateLabel} ${timelineInfo.timeLabel} (${timelineInfo.zoneLabel})`);
    const userLabel = [log.username || 'Sistema', log.userSecondary].filter(Boolean);
    setText('detailUser', userLabel.join(' · ') || 'Sistema');
    setText('detailIp', log.ip || 'N/A');
    setText('detailUserAgent', log.userAgent || 'N/A');

    const detailMessage = document.getElementById('detailMessage');
    if (detailMessage) {
      const details = this.escapeHtml(log.details || '—');
      const context = log.detailContext ? `<small class="text-muted d-block">${this.escapeHtml(log.detailContext)}</small>` : '';

      const metadataChips = [];
      if (log.documentName) {
        metadataChips.push(`<span class="badge rounded-pill bg-light text-dark border me-1"><i class="bi bi-file-earmark-text me-1"></i>${this.escapeHtml(log.documentName)}</span>`);
      }
      if (log.documentId && log.documentId !== log.documentName) {
        metadataChips.push(`<span class="badge rounded-pill bg-light text-muted border">ID: ${this.escapeHtml(String(log.documentId))}</span>`);
      }
      const metadataBlock = metadataChips.length ? `<div class="d-flex flex-wrap gap-1 mt-2">${metadataChips.join('')}</div>` : '';
      const summary = log.documentSummary ? `<small class="text-muted d-block mt-1">${this.escapeHtml(log.documentSummary)}</small>` : '';

      detailMessage.innerHTML = `<p class="mb-1">${details}</p>${context}${metadataBlock}${summary}`;
    }
  }

  clearLogDetailsPanel() {
    const placeholder = document.querySelector('#logDetailsContent .empty-details');
    const detailsPanel = document.getElementById('logDetails');

    if (placeholder) {
      placeholder.classList.remove('d-none');
    }

    if (detailsPanel) {
      detailsPanel.classList.add('d-none');
    }

    this.selectedLogId = null;
    this.highlightSelectedRow();

    ['detailId', 'detailTimestamp', 'detailUser', 'detailIp', 'detailUserAgent', 'detailMessage'].forEach((id) => {
      const element = document.getElementById(id);
      if (element) {
        element.textContent = '—';
      }
    });
  }

  getIntlFormatter(cacheKey, options) {
    if (!this.formatterCache.has(cacheKey)) {
      this.formatterCache.set(cacheKey, new Intl.DateTimeFormat('es-PE', options));
    }
    return this.formatterCache.get(cacheKey);
  }

  formatPeruDateKey(timestamp) {
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) {
      return '';
    }
    return this.getIntlFormatter('peru-date-key', {
      timeZone: this.timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(date);
  }

  formatDateTimeForTimeline(timestamp) {
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) {
      return {
        dateLabel: '—',
        timeLabel: '—',
        zoneLabel: this.timeZoneLabel
      };
    }

    const dateLabel = this.getIntlFormatter('timeline-date', {
      timeZone: this.timeZone,
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    }).format(date);

    const timeLabel = this.getIntlFormatter('timeline-time', {
      timeZone: this.timeZone,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    }).format(date);

    const timeZoneParts = this.getIntlFormatter('timeline-timezone', {
      timeZone: this.timeZone,
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short',
      hour12: false
    }).formatToParts(date);

    const zoneLabel = timeZoneParts.find((part) => part.type === 'timeZoneName')?.value || this.timeZoneLabel;

    return {
      dateLabel,
      timeLabel,
      zoneLabel
    };
  }

  formatDate(timestamp) {
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) {
      return '—';
    }

    return this.getIntlFormatter('date-short', {
      timeZone: this.timeZone,
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    }).format(date);
  }

  formatTime(timestamp) {
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) {
      return '—';
    }

    return this.getIntlFormatter('time-hms', {
      timeZone: this.timeZone,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    }).format(date);
  }

  formatRelativeTimestamp(timestamp) {
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) {
      return '';
    }

    const diffSeconds = Math.round((Date.now() - date.getTime()) / 1000);
    const absSeconds = Math.abs(diffSeconds);

    let formatter = this.relativeTimeFormatter;
    if (!formatter && typeof Intl !== 'undefined' && typeof Intl.RelativeTimeFormat === 'function') {
      formatter = new Intl.RelativeTimeFormat('es', { numeric: 'auto' });
      this.relativeTimeFormatter = formatter;
    }

    if (!formatter) {
      return '';
    }

    if (absSeconds < 60) {
      return formatter.format(-diffSeconds, 'second');
    }
    if (absSeconds < 3600) {
      return formatter.format(-Math.round(diffSeconds / 60), 'minute');
    }
    if (absSeconds < 86400) {
      return formatter.format(-Math.round(diffSeconds / 3600), 'hour');
    }
    if (absSeconds < 604800) {
      return formatter.format(-Math.round(diffSeconds / 86400), 'day');
    }
    if (absSeconds < 2629800) {
      return formatter.format(-Math.round(diffSeconds / 604800), 'week');
    }
    if (absSeconds < 31557600) {
      return formatter.format(-Math.round(diffSeconds / 2629800), 'month');
    }
    return formatter.format(-Math.round(diffSeconds / 31557600), 'year');
  }

  updatePagination() {
    // La vista de timeline muestra todas las actividades recientes sin paginación.
  }

  updateShowingCount() {
    const summaryElement = document.getElementById('recentLogsSummary');
    if (!summaryElement) return;

    const totalRecent = this.recentLogs.length;
    const filtered = this.filteredLogs.length;

    if (filtered === 0) {
      summaryElement.textContent = 'Sin actividad registrada en las últimas 24 horas.';
      return;
    }

    if (filtered === totalRecent) {
      summaryElement.textContent = `Mostrando ${filtered} actividad${filtered === 1 ? '' : 'es'} generada en las últimas 24 horas.`;
    } else {
      summaryElement.textContent = `Mostrando ${filtered} de ${totalRecent} actividad${totalRecent === 1 ? '' : 'es'} recientes (24 h).`;
    }
  }

  updateFilterInfo() {
    const filterInfo = document.getElementById('filterInfo');
    if (!filterInfo) return;

    const activeFilters = [];
    if (this.currentFilters.date) activeFilters.push(`Fecha: ${this.currentFilters.date}`);
    if (this.currentFilters.user) activeFilters.push(`Usuario: ${this.currentFilters.user}`);
    if (this.currentFilters.action) activeFilters.push(`Acción: ${this.currentFilters.action}`);
    if (this.currentFilters.level) activeFilters.push(`Nivel: ${this.currentFilters.level}`);

    if (activeFilters.length > 0) {
      filterInfo.innerHTML = `
        <small class="text-muted">
          <i class="bi bi-funnel me-1"></i>
          Filtros activos: ${activeFilters.join(', ')}
        </small>
      `;
      filterInfo.classList.remove('d-none');
    } else {
      filterInfo.classList.add('d-none');
    }
  }

  updateTimezoneInfo() {
    const timezoneElement = document.getElementById('timezoneInfo');
    if (!timezoneElement) return;

    const currentInfo = this.formatDateTimeForTimeline(Date.now());
    timezoneElement.textContent = `Horario oficial: Perú (${currentInfo.zoneLabel})`;
  }

  buildDailyArchives(logs = []) {
    const grouped = new Map();

    logs.forEach((log) => {
      const key = this.formatPeruDateKey(log.timestamp);
      if (!key) return;
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key).push(log);
    });

    grouped.forEach((entries) => {
      entries.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    });

    const todayKey = this.formatPeruDateKey(Date.now());
    const yesterdayKey = todayKey ? this.shiftPeruDateKey(todayKey, -1) : null;

    const keysSet = new Set(grouped.keys());
    if (yesterdayKey) {
      keysSet.add(yesterdayKey);
      if (!grouped.has(yesterdayKey)) {
        grouped.set(yesterdayKey, []);
      }
    }

    if (keysSet.size === 0 && yesterdayKey) {
      keysSet.add(yesterdayKey);
      grouped.set(yesterdayKey, []);
    }

    const sortedKeys = Array.from(keysSet).sort();
    if (sortedKeys.length > 0) {
      const firstKey = sortedKeys[0];
      const lastKey = yesterdayKey || sortedKeys[sortedKeys.length - 1];

      let cursor = this.createDateFromKey(firstKey);
      const endDate = this.createDateFromKey(lastKey);

      while (cursor <= endDate) {
        const key = this.formatPeruDateKey(cursor);
        if (key && !grouped.has(key)) {
          grouped.set(key, []);
        }
        cursor.setUTCDate(cursor.getUTCDate() + 1);
      }
    }

    const labelFormatter = this.getIntlFormatter('archive-label', {
      timeZone: this.timeZone,
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });

    return Array.from(grouped.entries())
      .map(([dateKey, entries]) => {
        const baseDate = this.createDateFromKey(dateKey);
        return {
          dateKey,
          logs: entries,
          count: entries.length,
          isEmpty: entries.length === 0,
          humanLabel: labelFormatter.format(baseDate),
          fileName: `log_${dateKey}${entries.length === 0 ? '_VACIO' : ''}.csv`
        };
      })
      .sort((a, b) => b.dateKey.localeCompare(a.dateKey));
  }

  renderDailyArchives() {
    const container = document.getElementById('dailyArchivesList');
    if (!container) return;

    if (!this.dailyArchives || this.dailyArchives.length === 0) {
      container.innerHTML = `
        <div class="text-gray-500 small">No hay registros diarios archivados todavía.</div>
      `;
      return;
    }

    container.innerHTML = this.dailyArchives
      .map((archive) => `
        <div class="archive-item${archive.isEmpty ? ' empty' : ''}" data-archive-date="${archive.dateKey}">
          <div class="archive-meta">
            <strong>${this.escapeHtml(this.capitalizeFirst(archive.humanLabel))}</strong>
            <small>${archive.isEmpty ? 'Sin actividad registrada' : `${archive.count} evento${archive.count === 1 ? '' : 's'}`}</small>
          </div>
          <div class="archive-actions">
            <button class="btn btn-sm btn-outline-secondary" data-archive-download="${archive.dateKey}">
              <i class="bi bi-download me-1"></i>${archive.isEmpty ? 'Descargar registro vacío' : 'Descargar CSV'}
            </button>
          </div>
        </div>
      `)
      .join('');
  }

  downloadArchive(archive) {
    const content = this.generateArchiveContent(archive);
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = archive.fileName;
    document.body.appendChild(link);
    link.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(link);

    showNotification(`Archivo ${archive.isEmpty ? 'vacío' : 'con actividad'} generado para ${archive.humanLabel}`, 'success');
  }

  generateArchiveContent(archive) {
    if (!archive || !Array.isArray(archive.logs)) {
      return '# SIN ACTIVIDAD\n';
    }

    if (archive.logs.length === 0) {
      const headers = ['Fecha', 'Hora', 'Nivel', 'Acción', 'Usuario', 'Usuario secundario', 'Objetivo', 'Detalles', 'Contexto', 'IP', 'Documento', 'ID Documento'];
      return [`# SIN ACTIVIDAD`, headers.join(',')].join('\n') + '\n';
    }

    return this.generateDailyCSV(archive.logs);
  }

  createDateFromKey(key) {
    const [year, month, day] = (key || '').split('-').map(Number);
    if (!year || !month || !day) {
      return new Date();
    }
    return new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  }

  shiftPeruDateKey(baseKey, offsetDays) {
    if (!baseKey) return '';
    const baseDate = this.createDateFromKey(baseKey);
    baseDate.setUTCDate(baseDate.getUTCDate() + offsetDays);
    return this.formatPeruDateKey(baseDate);
  }

  capitalizeFirst(value) {
    if (!value) return '';
    return value.charAt(0).toUpperCase() + value.slice(1);
  }

  updateStats() {
    const stats = this.calculateStats();

    const totalElement = document.getElementById('totalLogsCount');
    if (totalElement) {
      totalElement.textContent = this.allLogs.length;
    }

    const todayElement = document.getElementById('todayLogsCount');
    if (todayElement) {
      todayElement.textContent = stats.today;
    }

    const errorsElement = document.getElementById('errorsCount');
    if (errorsElement) {
      errorsElement.textContent = stats.errors;
    }

    const warningsElement = document.getElementById('warningsCount');
    if (warningsElement) {
      warningsElement.textContent = stats.warnings;
    }

    const successElement = document.getElementById('successCount');
    if (successElement) {
      successElement.textContent = stats.success;
    }
  }

  calculateStats() {
    const todayKey = this.formatPeruDateKey(Date.now());

    const totals = this.allLogs.reduce((acc, log) => {
      if (this.formatPeruDateKey(log.timestamp) === todayKey) {
        acc.today += 1;
      }
      if (['error', 'critical', 'fatal'].includes(log.level)) {
        acc.errors += 1;
      }
      if (['warning', 'notice'].includes(log.level)) {
        acc.warnings += 1;
      }
      if (['success', 'ok'].includes(log.level)) {
        acc.success += 1;
      }
      return acc;
    }, { today: 0, errors: 0, warnings: 0, success: 0 });

    return totals;
  }

  updateAnalytics() {
    const dataset = this.filteredLogs.length > 0 ? this.filteredLogs : this.allLogs;
    const analytics = dataset.reduce((acc, log) => {
      if (log.username) {
        acc.uniqueUsers.add(log.username.toLowerCase());
      }
      if (['upload', 'file_upload'].includes(log.action)) {
        acc.uploads += 1;
      }
      if (['download', 'file_download', 'export', 'analytics_export'].includes(log.action)) {
        acc.downloads += 1;
      }

      const today = acc.todayString;
      if (['error', 'critical', 'fatal'].includes(log.level) && this.formatPeruDateKey(log.timestamp) === today) {
        acc.errorsToday += 1;
      }

      return acc;
    }, {
      uniqueUsers: new Set(),
      uploads: 0,
      downloads: 0,
      errorsToday: 0,
      todayString: this.formatPeruDateKey(Date.now())
    });

    const setMetric = (id, value) => {
      const element = document.getElementById(id);
      if (element) {
        element.textContent = value;
      }
    };

    setMetric('uniqueUsers', analytics.uniqueUsers.size);
    setMetric('uploadsCount', analytics.uploads);
    setMetric('downloadsCount', analytics.downloads);
    setMetric('errorsToday', analytics.errorsToday);
  }

  clearFilters() {
    const dateInput = document.getElementById('filterDate');
    const userInput = document.getElementById('filterUser');
    const actionSelect = document.getElementById('filterAction');
    const levelSelect = document.getElementById('filterLevel');

    if (dateInput) dateInput.value = '';
    if (userInput) userInput.value = '';
    if (actionSelect) actionSelect.value = '';
    if (levelSelect) levelSelect.value = '';
    
    this.applyFilters();
    showNotification('Filtros limpiados', 'info');
  }

  toggleRealtimeUpdates(enabled) {
    if (enabled) {
      this.startRealtimeUpdates();
      showNotification('Actualizaciones en tiempo real activadas', 'info');
    } else {
      this.stopRealtimeUpdates();
      showNotification('Actualizaciones en tiempo real desactivadas', 'info');
    }
  }

  startRealtimeUpdates() {
    this.realtimeInterval = setInterval(() => {
      // Simulate new log entries
      this.addSimulatedLog();
    }, 10000); // Every 10 seconds
  }

  stopRealtimeUpdates() {
    if (this.realtimeInterval) {
      clearInterval(this.realtimeInterval);
      this.realtimeInterval = null;
    }
  }

  addSimulatedLog() {
    const actions = this.getAvailableActions();
    const levels = this.getAvailableLevels();
    const users = ['admin@docuflow.com', 'editor@docuflow.com', 'viewer@docuflow.com'];
    
    const randomAction = actions[Math.floor(Math.random() * actions.length)];
    const randomLevel = levels[Math.floor(Math.random() * levels.length)];
    const randomUser = users[Math.floor(Math.random() * users.length)];
    
    const simulated = this.normalizeLogEntry({
      id: this.allLogs.length + 1,
      timestamp: new Date(),
      action: randomAction.id,
      level: randomLevel.id,
      username: randomUser,
      details: this.generateLogDetails(randomAction.id),
      ip: `192.168.1.${Math.floor(Math.random() * 255)}`,
      userAgent: 'Simulado',
      documentId: Math.random() > 0.5 ? Math.floor(Math.random() * 100) + 1 : null
    });

    if (!simulated) {
      return;
    }

    this.allLogs.unshift(simulated); // Add to beginning
    this.applyFilters();
    this.updateStats();
    this.updateAnalytics();
    
    // Show notification for new log
    if (this.currentPage === 1) {
      showNotification(`Nuevo registro: ${randomAction.name}`, 'info', 3000);
    }
  }

  async exportLogs() {
    try {
  const dataset = this.filteredLogs.length > 0 ? this.filteredLogs : this.recentLogs;
      if (!dataset || dataset.length === 0) {
        showNotification('No hay registros para exportar.', 'info');
        return;
      }

      const csvContent = this.generateCSV(dataset);
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `logs_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      showNotification('Registros exportados exitosamente', 'success');
    } catch (error) {
      console.error('Export error:', error);
      showNotification('Error al exportar registros', 'error');
    }
  }

  generateCSV(dataset = []) {
    const headers = ['Fecha', 'Hora', 'Nivel', 'Acción', 'Usuario', 'Usuario secundario', 'Objetivo', 'Detalles', 'Contexto', 'IP', 'Documento', 'ID Documento'];
    const rows = dataset.map((log) => {
      const values = [
        this.formatDate(log.timestamp),
        this.formatTime(log.timestamp),
        log.level || '',
        log.actionLabel || log.action || '',
        log.username || 'Sistema',
        log.userSecondary || '',
        log.targetLabel || '',
        log.details || '',
        log.detailContext || '',
        log.ip || 'N/A',
        log.documentName || '',
        log.documentId || ''
      ];

      return values
        .map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`)
        .join(',');
    });

    return [headers.join(','), ...rows].join('\n');
  }

  async downloadDailyLog() {
    try {
      const todayKey = this.formatPeruDateKey(Date.now());
      const todayLogs = this.allLogs.filter((log) =>
        this.formatPeruDateKey(log.timestamp) === todayKey
      );
      
      if (todayLogs.length === 0) {
        showNotification('No hay registros para hoy', 'info');
        return;
      }
      
      const csvContent = this.generateDailyCSV(todayLogs);
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `log_diario_${todayKey}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      showNotification('Log diario descargado', 'success');
    } catch (error) {
      console.error('Download error:', error);
      showNotification('Error al descargar el log diario', 'error');
    }
  }

  generateDailyCSV(logs) {
    const headers = ['Fecha', 'Hora', 'Nivel', 'Acción', 'Usuario', 'Usuario secundario', 'Objetivo', 'Detalles', 'Contexto', 'IP', 'Documento', 'ID Documento'];
    const rows = logs.map((log) => {
      const values = [
        this.formatDate(log.timestamp),
        this.formatTime(log.timestamp),
        log.level || '',
        log.actionLabel || log.action || '',
        log.username || 'Sistema',
        log.userSecondary || '',
        log.targetLabel || '',
        log.details || '',
        log.detailContext || '',
        log.ip || 'N/A',
        log.documentName || '',
        log.documentId || ''
      ];

      return values
        .map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`)
        .join(',');
    });

    return [headers.join(','), ...rows].join('\n');
  }

  handleClearOldLogs(days = 30) {
    if (!Array.isArray(this.allLogs) || this.allLogs.length === 0) {
      showNotification('No hay registros para limpiar.', 'info');
      return;
    }

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffIso = cutoff.toISOString();
    const cutoffTime = cutoff.getTime();

    const beforeCount = this.allLogs.length;
    this.allLogs = this.allLogs.filter((log) => {
      if (!log?.timestamp) return true;
      const logDate = new Date(log.timestamp);
      if (Number.isNaN(logDate.getTime())) {
        return true;
      }
      return logDate.getTime() >= cutoffTime;
    });
    const removed = beforeCount - this.allLogs.length;

    this.applyFilters();
    this.updateStats();

    if (removed > 0) {
      showNotification(`Se limpiaron ${removed} registros anteriores a ${cutoffIso.split('T')[0]}.`, 'success');
    } else {
      showNotification('No se encontraron registros antiguos para eliminar.', 'info');
    }
  }

  generateAnalyticsCSV() {
    const dataset = this.filteredLogs.length > 0 ? this.filteredLogs : this.allLogs;
    const today = new Date().toISOString().split('T')[0];
    const analytics = dataset.reduce((acc, log) => {
      if (log.username) {
        acc.uniqueUsers.add(log.username.toLowerCase());
      }
      if (log.action === 'upload') {
        acc.uploads += 1;
      }
      if (log.action === 'download') {
        acc.downloads += 1;
      }
      if (log.level === 'error' && typeof log.timestamp === 'string' && log.timestamp.startsWith(today)) {
        acc.errorsToday += 1;
      }
      return acc;
    }, {
      uniqueUsers: new Set(),
      uploads: 0,
      downloads: 0,
      errorsToday: 0
    });

    return [
      ['Métrica', 'Valor'],
      ['Usuarios únicos', analytics.uniqueUsers.size],
      ['Subidas', analytics.uploads],
      ['Descargas', analytics.downloads],
      ['Errores hoy', analytics.errorsToday],
      ['Total registros filtrados', dataset.length]
    ].map((row) => row.join(',')).join('\n');
  }

  handleExportAnalytics() {
    const dataset = this.filteredLogs.length > 0 ? this.filteredLogs : this.allLogs;
    if (!dataset || dataset.length === 0) {
      showNotification('No hay datos para exportar.', 'info');
      return;
    }

    const csvContent = this.generateAnalyticsCSV();
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `analytics_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(anchor);

    showNotification('Se exportó el análisis rápido.', 'success');
  }

  handleSystemHealthCheck() {
    const totalLogs = this.allLogs.length;
    const latestLog = this.allLogs[0];
    const lastUser = latestLog?.username || 'N/D';
    const lastAction = latestLog?.actionLabel || this.formatActionLabel(latestLog?.action || 'unknown');
    const lastTimestamp = latestLog ? `${this.formatDate(latestLog.timestamp)} ${this.formatTime(latestLog.timestamp)}` : 'Sin registros';

    const summary = `Registros totales: ${totalLogs} • Último evento: ${lastAction} (${lastUser}) • Fecha y hora: ${lastTimestamp}`;
    showNotification(summary, 'info', 5000);
  }

  showLogDetails(logId) {
    const stringId = String(logId);
    const log = this.filteredLogs.find((entry) => String(entry.id) === stringId)
      || this.allLogs.find((entry) => String(entry.id) === stringId);
    if (!log) {
      showNotification('No encontramos la información de ese registro.', 'warning');
      return;
    }

    this.selectedLogId = stringId;
    this.highlightSelectedRow();
    this.populateLogDetails(log);
  }

  goToDocument(documentId) {
    // In a real app, navigate to the document
    showNotification(`Navegando al documento ${documentId}`, 'info');
  }
}

// Initialize controller and make it globally available
let logsController;
document.addEventListener('DOMContentLoaded', () => {
  logsController = new LogsController();
});
