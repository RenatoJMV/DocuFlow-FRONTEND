// commentsControllerSimple.js - Controlador simplificado para comentarios y tareas
import { docuFlowAPI } from '../../shared/services/apiClientSimple.js';
import authService from '../../shared/services/authServiceSimple.js';
import { showNotification } from '../../shared/utils/uiHelpers.js';

class SimpleCommentsController {
  constructor() {
    this.comments = [];
    this.currentFileId = null;
    this.init();
  }

  async init() {
    if (!authService.isLoggedIn()) {
      window.location.href = '../auth/login.html';
      return;
    }

    // Obtener fileId de la URL
    const urlParams = new URLSearchParams(window.location.search);
    this.currentFileId = urlParams.get('fileId');

    if (!this.currentFileId) {
      showNotification('ID de archivo no especificado', 'error');
      window.location.href = '../files/upload.html';
      return;
    }

    this.setupEventListeners();
    await this.loadComments();
    this.updateUI();
  }

  setupEventListeners() {
    // Formulario de nuevo comentario
    const commentForm = document.getElementById('commentForm');
    if (commentForm) {
      commentForm.addEventListener('submit', (e) => this.handleSubmitComment(e));
    }

    // Tipo de comentario
    const commentType = document.getElementById('commentType');
    if (commentType) {
      commentType.addEventListener('change', (e) => this.toggleTaskFields(e.target.value));
    }

    // Filtros
    const typeFilter = document.getElementById('typeFilter');
    if (typeFilter) {
      typeFilter.addEventListener('change', (e) => this.filterComments(e.target.value));
    }

    const statusFilter = document.getElementById('statusFilter');
    if (statusFilter) {
      statusFilter.addEventListener('change', (e) => this.filterByStatus(e.target.value));
    }

    // Refresh
    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => this.loadComments());
    }

    // Volver a archivos
    const backBtn = document.getElementById('backBtn');
    if (backBtn) {
      backBtn.addEventListener('click', () => window.location.href = '../files/upload.html');
    }
  }

  async handleSubmitComment(event) {
    event.preventDefault();

    const content = document.getElementById('commentContent').value.trim();
    const type = document.getElementById('commentType').value;
    
    if (!content) {
      showNotification('El contenido no puede estar vacío', 'error');
      return;
    }

    const commentData = {
      fileId: this.currentFileId,
      content,
      type,
      author: authService.getCurrentUser().email,
      createdAt: new Date().toISOString()
    };

    // Si es una tarea, agregar campos adicionales
    if (type === 'task') {
      commentData.completed = false;
      commentData.priority = document.getElementById('taskPriority')?.value || 'medium';
      commentData.dueDate = document.getElementById('taskDueDate')?.value || null;
    }

    try {
      const response = await docuFlowAPI.comments.create(commentData);
      
      if (response.success) {
        showNotification(`${type === 'task' ? 'Tarea' : 'Comentario'} agregado correctamente`, 'success');
        
        // Limpiar formulario
        document.getElementById('commentForm').reset();
        this.toggleTaskFields('comment');
        
        // Recargar comentarios
        await this.loadComments();
      }

    } catch (error) {
      console.error('Error agregando comentario:', error);
      showNotification('Error agregando comentario', 'error');
    }
  }

  async loadComments() {
    try {
      const response = await docuFlowAPI.comments.list(this.currentFileId);
      
      if (response.success) {
        this.comments = response.data.comments || [];
        this.renderCommentsList();
        this.updateStats();
      }

    } catch (error) {
      console.error('Error cargando comentarios:', error);
      showNotification('Error cargando comentarios', 'error');
    }
  }

  filterComments(type) {
    if (type === 'all') {
      this.renderCommentsList();
    } else {
      const filtered = this.comments.filter(comment => comment.type === type);
      this.renderCommentsList(filtered);
    }
  }

  filterByStatus(status) {
    if (status === 'all') {
      this.renderCommentsList();
    } else {
      const completed = status === 'completed';
      const filtered = this.comments.filter(comment => 
        comment.type === 'task' && comment.completed === completed
      );
      this.renderCommentsList(filtered);
    }
  }

  renderCommentsList(commentsToRender = this.comments) {
    const container = document.getElementById('commentsList');
    if (!container) return;

    if (commentsToRender.length === 0) {
      container.innerHTML = `
        <div class="text-center py-5">
          <i class="bi bi-chat-dots" style="font-size: 3rem; color: #ccc;"></i>
          <p class="text-muted mt-3">No hay comentarios para mostrar</p>
        </div>
      `;
      return;
    }

    container.innerHTML = commentsToRender.map(comment => `
      <div class="comment-item card mb-3 ${comment.type === 'task' ? 'task-item' : ''}">
        <div class="card-body">
          <div class="d-flex justify-content-between align-items-start mb-2">
            <div class="d-flex align-items-center">
              <i class="bi ${comment.type === 'task' ? 'bi-check-square' : 'bi-chat-dots'} me-2"></i>
              <strong>${comment.author}</strong>
              <span class="badge ${comment.type === 'task' ? 'bg-primary' : 'bg-secondary'} ms-2">
                ${comment.type === 'task' ? 'Tarea' : 'Comentario'}
              </span>
              ${comment.type === 'task' && comment.completed ? 
                '<span class="badge bg-success ms-1">Completada</span>' : ''}
            </div>
            <div class="comment-actions">
              <small class="text-muted">${this.formatDate(comment.createdAt)}</small>
              ${this.canEditComment(comment) ? `
                <button class="btn btn-sm btn-outline-primary ms-2" onclick="commentsController.editComment(${comment.id})">
                  <i class="bi bi-pencil"></i>
                </button>
                <button class="btn btn-sm btn-outline-danger ms-1" onclick="commentsController.deleteComment(${comment.id})">
                  <i class="bi bi-trash"></i>
                </button>
              ` : ''}
            </div>
          </div>
          
          <div class="comment-content">
            <p class="mb-2">${comment.content}</p>
            
            ${comment.type === 'task' ? `
              <div class="task-details mt-2">
                <div class="row">
                  <div class="col-md-4">
                    <small class="text-muted">
                      <i class="bi bi-flag me-1"></i>
                      Prioridad: ${this.getPriorityText(comment.priority)}
                    </small>
                  </div>
                  ${comment.dueDate ? `
                    <div class="col-md-4">
                      <small class="text-muted">
                        <i class="bi bi-calendar me-1"></i>
                        Vence: ${this.formatDate(comment.dueDate)}
                      </small>
                    </div>
                  ` : ''}
                  <div class="col-md-4">
                    <button class="btn btn-sm ${comment.completed ? 'btn-success' : 'btn-outline-success'}" 
                            onclick="commentsController.toggleTaskStatus(${comment.id})">
                      <i class="bi ${comment.completed ? 'bi-check-circle-fill' : 'bi-circle'}"></i>
                      ${comment.completed ? 'Completada' : 'Marcar como completada'}
                    </button>
                  </div>
                </div>
              </div>
            ` : ''}
          </div>
        </div>
      </div>
    `).join('');
  }

  async toggleTaskStatus(commentId) {
    const comment = this.comments.find(c => c.id === commentId);
    if (!comment || comment.type !== 'task') return;

    try {
      const updatedComment = {
        ...comment,
        completed: !comment.completed
      };

      const response = await docuFlowAPI.comments.update(commentId, updatedComment);
      
      if (response.success) {
        showNotification(
          `Tarea marcada como ${!comment.completed ? 'completada' : 'pendiente'}`, 
          'success'
        );
        await this.loadComments();
      }

    } catch (error) {
      console.error('Error actualizando tarea:', error);
      showNotification('Error actualizando tarea', 'error');
    }
  }

  async deleteComment(commentId) {
    const comment = this.comments.find(c => c.id === commentId);
    if (!comment) return;

    if (!this.canEditComment(comment)) {
      showNotification('No tienes permisos para eliminar este comentario', 'error');
      return;
    }

    const type = comment.type === 'task' ? 'tarea' : 'comentario';
    if (!confirm(`¿Estás seguro de eliminar este ${type}?`)) return;

    try {
      const response = await docuFlowAPI.comments.delete(commentId);
      
      if (response.success) {
        showNotification(`${type.charAt(0).toUpperCase() + type.slice(1)} eliminado`, 'success');
        await this.loadComments();
      }

    } catch (error) {
      console.error('Error eliminando comentario:', error);
      showNotification('Error eliminando comentario', 'error');
    }
  }

  editComment(commentId) {
    const comment = this.comments.find(c => c.id === commentId);
    if (!comment || !this.canEditComment(comment)) return;

    // Prellenar el formulario
    document.getElementById('commentContent').value = comment.content;
    document.getElementById('commentType').value = comment.type;
    
    if (comment.type === 'task') {
      this.toggleTaskFields('task');
      if (document.getElementById('taskPriority')) {
        document.getElementById('taskPriority').value = comment.priority || 'medium';
      }
      if (document.getElementById('taskDueDate') && comment.dueDate) {
        document.getElementById('taskDueDate').value = comment.dueDate.split('T')[0];
      }
    }

    // Cambiar el botón de submit para edición
    const submitBtn = document.querySelector('#commentForm button[type="submit"]');
    if (submitBtn) {
      submitBtn.textContent = 'Actualizar';
      submitBtn.onclick = (e) => this.handleUpdateComment(e, commentId);
    }

    // Scroll al formulario
    document.getElementById('commentForm').scrollIntoView({ behavior: 'smooth' });
  }

  async handleUpdateComment(event, commentId) {
    event.preventDefault();

    const content = document.getElementById('commentContent').value.trim();
    const type = document.getElementById('commentType').value;
    
    if (!content) {
      showNotification('El contenido no puede estar vacío', 'error');
      return;
    }

    const originalComment = this.comments.find(c => c.id === commentId);
    const updatedComment = {
      ...originalComment,
      content,
      type,
      updatedAt: new Date().toISOString()
    };

    if (type === 'task') {
      updatedComment.priority = document.getElementById('taskPriority')?.value || 'medium';
      updatedComment.dueDate = document.getElementById('taskDueDate')?.value || null;
    }

    try {
      const response = await docuFlowAPI.comments.update(commentId, updatedComment);
      
      if (response.success) {
        showNotification('Comentario actualizado correctamente', 'success');
        
        // Resetear formulario
        this.resetCommentForm();
        await this.loadComments();
      }

    } catch (error) {
      console.error('Error actualizando comentario:', error);
      showNotification('Error actualizando comentario', 'error');
    }
  }

  resetCommentForm() {
    const form = document.getElementById('commentForm');
    if (form) form.reset();
    
    this.toggleTaskFields('comment');
    
    const submitBtn = document.querySelector('#commentForm button[type="submit"]');
    if (submitBtn) {
      submitBtn.textContent = 'Agregar';
      submitBtn.onclick = null;
    }
  }

  toggleTaskFields(type) {
    const taskFields = document.getElementById('taskFields');
    if (taskFields) {
      taskFields.style.display = type === 'task' ? 'block' : 'none';
    }
  }

  updateStats() {
    const totalComments = this.comments.filter(c => c.type === 'comment').length;
    const totalTasks = this.comments.filter(c => c.type === 'task').length;
    const completedTasks = this.comments.filter(c => c.type === 'task' && c.completed).length;
    const pendingTasks = totalTasks - completedTasks;

    const statsContainer = document.getElementById('commentsStats');
    if (statsContainer) {
      statsContainer.innerHTML = `
        <div class="row">
          <div class="col-md-3">
            <div class="stat-card">
              <h6>Comentarios</h6>
              <span class="stat-number">${totalComments}</span>
            </div>
          </div>
          <div class="col-md-3">
            <div class="stat-card">
              <h6>Tareas Total</h6>
              <span class="stat-number">${totalTasks}</span>
            </div>
          </div>
          <div class="col-md-3">
            <div class="stat-card">
              <h6>Completadas</h6>
              <span class="stat-number text-success">${completedTasks}</span>
            </div>
          </div>
          <div class="col-md-3">
            <div class="stat-card">
              <h6>Pendientes</h6>
              <span class="stat-number text-warning">${pendingTasks}</span>
            </div>
          </div>
        </div>
      `;
    }
  }

  updateUI() {
    const user = authService.getCurrentUser();
    const userInfo = document.getElementById('userInfo');
    
    if (userInfo) {
      userInfo.innerHTML = `
        <span>Archivo ID: ${this.currentFileId} | Usuario: ${user.name}</span>
        <button class="btn btn-sm btn-outline-secondary ms-2" onclick="authService.logout().then(() => location.href = '../auth/login.html')">
          Cerrar Sesión
        </button>
      `;
    }
  }

  // Utilidades
  canEditComment(comment) {
    const currentUser = authService.getCurrentUser();
    return currentUser.email === comment.author || authService.isAdmin();
  }

  getPriorityText(priority) {
    const priorities = {
      high: 'Alta',
      medium: 'Media',
      low: 'Baja'
    };
    return priorities[priority] || 'Media';
  }

  formatDate(dateString) {
    return new Date(dateString).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
}

// Instancia global
const commentsController = new SimpleCommentsController();

// Hacer disponible globalmente
window.commentsController = commentsController;

export default commentsController;