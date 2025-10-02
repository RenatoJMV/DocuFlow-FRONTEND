// Controlador simplificado para el dashboard
import { docuFlowAPI } from '../../shared/services/apiClient.js';
import { showNotification } from '../../shared/utils/uiHelpers.js';

class SimpleDashboardController {
  constructor() {
    this.init();
  }

  async init() {
    console.log('🚀 Iniciando Dashboard...');
    await this.testConnection();
    this.loadDashboardData();
    this.setupEventListeners();
  }

  async testConnection() {
    try {
      console.log('🔗 Probando conexión con backend...');
      const response = await docuFlowAPI.health.check();
      
      if (response) {
        console.log('✅ Backend conectado correctamente:', response);
        showNotification('Conectado al servidor', 'success', 2000);
      } else {
        console.warn('⚠️ Backend responde con error');
        showNotification('Servidor disponible pero con errores', 'warning');
      }
    } catch (error) {
      console.error('❌ Error de conexión:', error);
      showNotification('No se pudo conectar al servidor. Usando modo demo.', 'warning');
    }
  }

  async loadDashboardData() {
    try {
      // Intentar cargar datos reales
      const stats = await docuFlowAPI.dashboard.getStats();
      this.updateWidgets(stats);
      console.log('✅ Datos cargados del backend:', stats);
    } catch (error) {
      console.warn('⚠️ Usando datos demo:', error.message);
      this.loadDemoData();
    }
  }

  loadDemoData() {
    const demoStats = {
      totalFiles: 156,
      totalUsers: 23,
      totalComments: 89,
      totalStorage: '2.4 GB',
      downloadsToday: 12,
      uploadsToday: 8,
      commentsToday: 15
    };

    this.updateWidgets(demoStats);
    console.log('📊 Datos demo cargados');
  }

  updateWidgets(stats) {
    this.updateElement('widget-files', stats.totalFiles || 0);
    this.updateElement('widget-users', stats.totalUsers || 0);
    this.updateElement('widget-comments', stats.totalComments || 0);
    this.updateElement('widget-storage', stats.totalStorage || '0 B');
    this.updateElement('widget-downloads', stats.downloadsToday || 0);
    this.updateElement('widget-uploads', stats.uploadsToday || 0);
    this.updateElement('widget-comments-today', stats.commentsToday || 0);
  }

  updateElement(id, value) {
    const element = document.getElementById(id);
    if (element) {
      element.textContent = value;
    }
  }

  setupEventListeners() {
    // Botón de refresh
    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => this.refreshDashboard());
    }

    // Hacer disponibles las funciones globalmente
    window.refreshDashboard = () => this.refreshDashboard();
    window.testBackendConnection = () => this.testConnection();
  }

  async refreshDashboard() {
    showNotification('Actualizando dashboard...', 'info', 1000);
    await this.loadDashboardData();
    showNotification('Dashboard actualizado', 'success', 2000);
  }
}

// Inicializar cuando se carga la página
document.addEventListener('DOMContentLoaded', () => {
  window.dashboardController = new SimpleDashboardController();
});

export default SimpleDashboardController;