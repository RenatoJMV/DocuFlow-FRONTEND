// Servicio de Seguridad Avanzado para DocuFlow
// Implementa las mejores prácticas de seguridad web

class SecurityService {
  constructor() {
    this.csrfToken = null;
    this.securityHeaders = new Map();
    this.sanitizers = new Map();
    this.validators = new Map();
    this.encryptionKey = null;

  // Asegurar el contexto de métodos críticos antes de inicializar
  this.setupInputSanitizers = this.setupInputSanitizers.bind(this);
  this.setupXSSProtection = this.setupXSSProtection.bind(this);
  this.interceptDOMManipulation = this.interceptDOMManipulation.bind(this);
    
    // Configuración de seguridad
    this.config = {
      tokenStorage: 'sessionStorage', // Más seguro que localStorage
      csrfEnabled: true,
      xssProtection: true,
      sqlInjectionProtection: true,
      rateLimiting: true,
      contentSecurityPolicy: true,
      httpSecurityHeaders: true,
      encryptLocalData: true,
      auditLogging: true
    };

    this.initializeSecurity();
  }

  // Inicializar todas las medidas de seguridad
  async initializeSecurity() {
    try {
      await this.setupCSRFProtection();
      this.setupXSSProtection();
      this.setupSecurityHeaders();
      this.setupInputSanitizers();
      this.setupInputValidators();
      this.setupContentSecurityPolicy();
      this.initializeEncryption();
      this.setupSecurityMonitoring();
      this.setupRateLimiting();
      
      console.info('🔒 Sistema de seguridad inicializado correctamente');
    } catch (error) {
      console.error('❌ Error inicializando seguridad:', error);
    }
  }

  // ============================================================================
  // PROTECCIÓN CSRF
  // ============================================================================
  
  async setupCSRFProtection() {
    if (!this.config.csrfEnabled) return;
    
    // Generar token CSRF único
    this.csrfToken = this.generateSecureToken();
    
    // Agregar token a todas las requests
    this.addCSRFToRequests();
    
    // Configurar meta tag para el token
    this.setCSRFMetaTag();
  }

  generateSecureToken() {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  addCSRFToRequests() {
    const originalFetch = window.fetch;
    window.fetch = async (url, options = {}) => {
      if (this.shouldAddCSRF(url, options.method)) {
        options.headers = {
          ...options.headers,
          'X-CSRF-Token': this.csrfToken
        };
      }
      return originalFetch(url, options);
    };
  }

  shouldAddCSRF(url, method) {
    const modifyingMethods = ['POST', 'PUT', 'PATCH', 'DELETE'];
    return modifyingMethods.includes(method?.toUpperCase()) && 
           !url.includes('/auth/csrf-token');
  }

  setCSRFMetaTag() {
    let metaTag = document.querySelector('meta[name="csrf-token"]');
    if (!metaTag) {
      metaTag = document.createElement('meta');
      metaTag.name = 'csrf-token';
      document.head.appendChild(metaTag);
    }
    metaTag.content = this.csrfToken;
  }

  // ============================================================================
  // PROTECCIÓN XSS
  // ============================================================================
  
  setupXSSProtection() {
    if (!this.config.xssProtection) return;
    
    this.setupInputSanitizers();
    this.interceptDOMManipulation();
  }

  setupInputSanitizers() {
    if (this._sanitizersConfigured) {
      return;
    }

    this.sanitizers.set('html', this.sanitizeHTML.bind(this));
    this.sanitizers.set('script', this.sanitizeScript.bind(this));
    this.sanitizers.set('url', this.sanitizeURL.bind(this));
    this.sanitizers.set('attribute', this.sanitizeAttribute.bind(this));
    this.sanitizers.set('text', (value) => typeof value === 'string' ? value.trim() : value);

    this._sanitizersConfigured = true;
  }

  sanitizeHTML(input) {
    if (typeof input !== 'string') return '';

    const container = document.createElement('div');
    const originalDescriptor = this._originalInnerHTMLDescriptor;

    try {
      if (originalDescriptor?.set) {
        originalDescriptor.set.call(container, input);
      } else {
        container.innerHTML = input;
      }
    } catch (error) {
      console.warn('No se pudo aplicar sanitización estructural, degradando a texto plano.', error);
      return input.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    const blockedSelectors = 'script, iframe, object, embed, link[rel="import"], style';
    container.querySelectorAll(blockedSelectors).forEach((el) => el.remove());

    const dangerousAttrNames = new Set(['src', 'href', 'xlink:href', 'formaction', 'action']);

    container.querySelectorAll('*').forEach((element) => {
      [...element.attributes].forEach((attr) => {
        const name = attr.name.toLowerCase();
        const value = attr.value;

        if (name.startsWith('on')) {
          element.removeAttribute(attr.name);
          return;
        }

        if (dangerousAttrNames.has(name) && /^javascript:/i.test(value)) {
          element.setAttribute(attr.name, '#');
          return;
        }

        if (name === 'style') {
          element.removeAttribute(attr.name);
          return;
        }

        if (/^data:text\/html/i.test(value)) {
          element.setAttribute(attr.name, value.replace(/data:text\/html/gi, 'data:text/plain'));
        }
      });
    });

    if (originalDescriptor?.get) {
      return originalDescriptor.get.call(container);
    }

    return container.innerHTML;
  }

  sanitizeScript(input) {
    if (typeof input !== 'string') return '';
    
    return input
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+\s*=/gi, '')
      .replace(/eval\s*\(/gi, '')
      .replace(/Function\s*\(/gi, '');
  }

  sanitizeURL(input) {
    if (typeof input !== 'string') return '';
    
    const allowedProtocols = ['http:', 'https:', 'mailto:', 'tel:'];
    
    try {
      const url = new URL(input, window.location.origin);
      if (!allowedProtocols.includes(url.protocol)) {
        return '#';
      }
      return url.toString();
    } catch {
      return '#';
    }
  }

  sanitizeAttribute(input) {
    if (typeof input !== 'string') return '';
    
    return input
      .replace(/[<>'"]/g, '')
      .replace(/javascript:/gi, '')
      .replace(/data:/gi, '');
  }

  interceptDOMManipulation() {
    if (this._domInterceptorInstalled) {
      return;
    }

    const descriptor = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML');
    if (!descriptor || typeof descriptor.set !== 'function' || typeof descriptor.get !== 'function') {
      console.warn('No se pudo interceptar innerHTML de manera segura');
      return;
    }

    if (!this._originalInnerHTMLDescriptor) {
      this._originalInnerHTMLDescriptor = descriptor;
    }

    const securityInstance = this;
    Object.defineProperty(Element.prototype, 'innerHTML', {
      configurable: descriptor.configurable,
      enumerable: descriptor.enumerable,
      get() {
        return descriptor.get.call(this);
      },
      set(value) {
        const sanitized = securityInstance.sanitizeHTML(value);
        return descriptor.set.call(this, sanitized);
      }
    });

    this._domInterceptorInstalled = true;
  }

  // ============================================================================
  // VALIDADORES SEGUROS
  // ============================================================================
  
  setupInputValidators() {
    this.validators.set('email', this.validateEmail.bind(this));
    this.validators.set('password', this.validatePassword.bind(this));
    this.validators.set('username', this.validateUsername.bind(this));
    this.validators.set('filename', this.validateFilename.bind(this));
    this.validators.set('filesize', this.validateFileSize.bind(this));
    this.validators.set('sql', this.validateSQL.bind(this));
  }

  validateEmail(email) {
    if (!email || typeof email !== 'string') return false;
    
    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    
    if (!emailRegex.test(email)) return false;
    if (email.length > 254) return false;
    if (email.includes('..')) return false;
    
    return true;
  }

  validatePassword(password) {
    if (!password || typeof password !== 'string') return false;
    
    const minLength = 12;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);
    
    return password.length >= minLength && 
           hasUpperCase && 
           hasLowerCase && 
           hasNumbers && 
           hasSpecialChar;
  }

  validateUsername(username) {
    if (!username || typeof username !== 'string') return false;
    
    const usernameRegex = /^[a-zA-Z0-9._-]+$/;
    return usernameRegex.test(username) && 
           username.length >= 3 && 
           username.length <= 30 &&
           !username.includes('..');
  }

  validateFilename(filename) {
    if (!filename || typeof filename !== 'string') return false;
    
    const dangerousPatterns = [
      /\.\./,
      /[<>:"|?*]/,
      /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i,
      /\.(bat|cmd|exe|scr|vbs|js)$/i
    ];
    
    return !dangerousPatterns.some(pattern => pattern.test(filename)) &&
           filename.length <= 255;
  }

  validateFileSize(size, maxSizeMB = 10) {
    return typeof size === 'number' && 
           size > 0 && 
           size <= maxSizeMB * 1024 * 1024;
  }

  validateSQL(input) {
    if (!input || typeof input !== 'string') return true;
    
    const sqlPatterns = [
      /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|SCRIPT)\b)/i,
      /(;|\-\-|\/\*|\*\/)/,
      /(\b(OR|AND)\s+[0-9]+\s*=\s*[0-9]+)/i,
      /('(\s)*(OR|AND|UNION|SELECT|INSERT|UPDATE|DELETE))/i
    ];
    
    return !sqlPatterns.some(pattern => pattern.test(input));
  }

  // ============================================================================
  // HEADERS DE SEGURIDAD
  // ============================================================================
  
  setupSecurityHeaders() {
    if (!this.config.httpSecurityHeaders) return;
    
    this.securityHeaders.set('X-Content-Type-Options', 'nosniff');
    this.securityHeaders.set('X-Frame-Options', 'DENY');
    this.securityHeaders.set('X-XSS-Protection', '1; mode=block');
    this.securityHeaders.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    this.securityHeaders.set('Permissions-Policy', 
      'geolocation=(), microphone=(), camera=(), payment=(), usb=()');
  }

  setupContentSecurityPolicy() {
    if (!this.config.contentSecurityPolicy) return;
    
    const connectSources = ["'self'", 'https:'];
    if (['localhost', '127.0.0.1'].includes(window.location.hostname)) {
      connectSources.push('http://localhost:8080');
    }

    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-eval' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com",
      "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com",
      "img-src 'self' data: https:",
      "font-src 'self' https://cdnjs.cloudflare.com",
      `connect-src ${connectSources.join(' ')}`,
      "frame-src 'none'",
      "object-src 'none'",
      "base-uri 'self'"
    ].join('; ');

    const metaTag = document.createElement('meta');
    metaTag.httpEquiv = 'Content-Security-Policy';
    metaTag.content = csp;
    document.head.appendChild(metaTag);
  }

  // ============================================================================
  // ALMACENAMIENTO SEGURO
  // ============================================================================
  
  initializeEncryption() {
    if (!this.config.encryptLocalData) return;
    
    // Generar clave de encriptación basada en sesión
    this.encryptionKey = this.generateEncryptionKey();
  }

  generateEncryptionKey() {
    const sessionId = sessionStorage.getItem('session_id') || this.generateSecureToken();
    sessionStorage.setItem('session_id', sessionId);
    
    return crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(sessionId.substring(0, 32)),
      'AES-GCM',
      false,
      ['encrypt', 'decrypt']
    );
  }

  async encryptData(data) {
    if (!this.config.encryptLocalData || !this.encryptionKey) {
      return JSON.stringify(data);
    }

    try {
      const key = await this.encryptionKey;
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const encodedData = new TextEncoder().encode(JSON.stringify(data));
      
      const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
        encodedData
      );
      
      return btoa(JSON.stringify({
        iv: Array.from(iv),
        data: Array.from(new Uint8Array(encrypted))
      }));
    } catch (error) {
      console.error('Error encriptando datos:', error);
      return JSON.stringify(data);
    }
  }

  async decryptData(encryptedData) {
    if (!this.config.encryptLocalData || !this.encryptionKey) {
      try {
        return JSON.parse(encryptedData);
      } catch {
        return null;
      }
    }

    try {
      const key = await this.encryptionKey;
      const { iv, data } = JSON.parse(atob(encryptedData));
      
      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: new Uint8Array(iv) },
        key,
        new Uint8Array(data)
      );
      
      return JSON.parse(new TextDecoder().decode(decrypted));
    } catch (error) {
      console.error('Error desencriptando datos:', error);
      return null;
    }
  }

  // Almacenamiento seguro de tokens
  async setSecureItem(key, value) {
    const encryptedValue = await this.encryptData(value);
    
    if (this.config.tokenStorage === 'sessionStorage') {
      sessionStorage.setItem(key, encryptedValue);
    } else {
      localStorage.setItem(key, encryptedValue);
    }
  }

  async getSecureItem(key) {
    let encryptedValue;
    
    if (this.config.tokenStorage === 'sessionStorage') {
      encryptedValue = sessionStorage.getItem(key);
    } else {
      encryptedValue = localStorage.getItem(key);
    }
    
    if (!encryptedValue) return null;
    
    return await this.decryptData(encryptedValue);
  }

  removeSecureItem(key) {
    sessionStorage.removeItem(key);
    localStorage.removeItem(key);
  }

  // ============================================================================
  // RATE LIMITING
  // ============================================================================
  
  setupRateLimiting() {
    if (!this.config.rateLimiting) return;
    
    this.rateLimits = new Map();
    this.setupRequestRateLimiting();
  }

  setupRequestRateLimiting() {
    const originalFetch = window.fetch;
    
    window.fetch = async (url, options = {}) => {
      const endpoint = this.getEndpointFromURL(url);
      
      if (this.isRateLimited(endpoint)) {
        throw new Error('Too many requests. Please try again later.');
      }
      
      this.recordRequest(endpoint);
      return originalFetch(url, options);
    };
  }

  getEndpointFromURL(url) {
    try {
      const urlObj = new URL(url, window.location.origin);
      return urlObj.pathname;
    } catch {
      return url;
    }
  }

  isRateLimited(endpoint) {
    const limits = {
      '/auth/login': { requests: 5, window: 15 * 60 * 1000 }, // 5 requests per 15 minutes
      '/auth/register': { requests: 3, window: 60 * 60 * 1000 }, // 3 requests per hour
      default: { requests: 100, window: 60 * 1000 } // 100 requests per minute
    };
    
    const limit = limits[endpoint] || limits.default;
    const now = Date.now();
    const requests = this.rateLimits.get(endpoint) || [];
    
    // Limpiar requests antiguas
    const validRequests = requests.filter(time => now - time < limit.window);
    
    return validRequests.length >= limit.requests;
  }

  recordRequest(endpoint) {
    const now = Date.now();
    const requests = this.rateLimits.get(endpoint) || [];
    requests.push(now);
    this.rateLimits.set(endpoint, requests);
  }

  // ============================================================================
  // MONITOREO DE SEGURIDAD
  // ============================================================================
  
  setupSecurityMonitoring() {
    if (!this.config.auditLogging) return;
    
    this.securityEvents = [];
    this.setupSecurityEventListeners();
  }

  setupSecurityEventListeners() {
    // Detectar intentos de manipulación de consola
    this.monitorConsoleAccess();
    
    // Detectar intentos de inyección
    this.monitorInputs();
    
    // Detectar cambios sospechosos en localStorage
    this.monitorStorageAccess();
  }

  monitorConsoleAccess() {
    const originalLog = console.log;
    console.log = (...args) => {
      if (args.some(arg => typeof arg === 'string' && 
          /password|token|secret|key/i.test(arg))) {
        this.logSecurityEvent('console_sensitive_data', 'Sensitive data logged to console');
      }
      originalLog.apply(console, args);
    };
  }

  monitorInputs() {
    document.addEventListener('input', (event) => {
      const value = event.target.value;
      
      if (value && !this.validateSQL(value)) {
        this.logSecurityEvent('sql_injection_attempt', 'Potential SQL injection detected');
        event.target.value = this.sanitizeHTML(value);
      }
      
      if (value && /<script|javascript:|on\w+=/i.test(value)) {
        this.logSecurityEvent('xss_attempt', 'Potential XSS attempt detected');
        event.target.value = this.sanitizeHTML(value);
      }
    });
  }

  monitorStorageAccess() {
    const originalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) {
      if (/password|token|secret|key/i.test(key) && this === localStorage) {
        securityService.logSecurityEvent('insecure_storage', 
          'Sensitive data stored in localStorage');
      }
      return originalSetItem.call(this, key, value);
    };
  }

  logSecurityEvent(type, message, details = {}) {
    const event = {
      type,
      message,
      details,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href
    };
    
    this.securityEvents.push(event);
    
    // Mantener solo los últimos 100 eventos
    if (this.securityEvents.length > 100) {
      this.securityEvents = this.securityEvents.slice(-100);
    }
    
    // Log crítico para eventos de seguridad
    console.warn('🚨 Security Event:', event);
    
    // Enviar al servidor en caso de eventos críticos
    if (['sql_injection_attempt', 'xss_attempt'].includes(type)) {
      this.reportSecurityIncident(event);
    }
  }

  async reportSecurityIncident(event) {
    try {
  await fetch('/security/incident', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': this.csrfToken
        },
        body: JSON.stringify(event)
      });
    } catch (error) {
      console.error('Error reporting security incident:', error);
    }
  }

  // ============================================================================
  // UTILIDADES PÚBLICAS
  // ============================================================================
  
  // Validar entrada de usuario
  validateInput(type, value) {
    const validator = this.validators.get(type);
    return validator ? validator(value) : true;
  }

  // Sanitizar entrada de usuario
  sanitizeInput(type, value) {
    const sanitizer = this.sanitizers.get(type);
    return sanitizer ? sanitizer(value) : value;
  }

  // Verificar si el contexto es seguro
  isSecureContext() {
    return location.protocol === 'https:' || 
           location.hostname === 'localhost' || 
           location.hostname === '127.0.0.1';
  }

  // Generar hash seguro
  async generateHash(data) {
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  // Limpiar datos sensibles
  clearSensitiveData() {
    this.removeSecureItem('token');
    this.removeSecureItem('refreshToken');
    this.removeSecureItem('userData');
    this.removeSecureItem('userPreferences');
    
    // Limpiar cualquier resto en localStorage
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && /token|password|secret|key|auth/i.test(key)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));
  }

  // Obtener reporte de seguridad
  getSecurityReport() {
    return {
      config: this.config,
      csrfEnabled: !!this.csrfToken,
      secureContext: this.isSecureContext(),
      securityHeaders: Object.fromEntries(this.securityHeaders),
      recentEvents: this.securityEvents.slice(-10),
      rateLimits: Object.fromEntries(this.rateLimits)
    };
  }
}

// Crear instancia global del servicio de seguridad
const securityService = new SecurityService();

// Exportar para uso en módulos
export { SecurityService, securityService };
export default securityService;