import { docuFlowAPI } from '../../shared/services/apiClient.js';
import { store } from '../../shared/services/store.js';
import { initializeNavbar, showNotification, Pagination, FormValidator } from '../../shared/utils/uiHelpers.js';

class CommentsController {
  constructor() {
    this.comments = [];
    this.filteredComments = [];
    this.currentPage = 1;
    this.itemsPerPage = 10;
    this.currentFilter = 'all';
    
    this.initializeComponents();
    this.setupEventListeners();
    this.loadComments();
    this.updateStats();
  }

  initializeComponents() {
    // Create navbar
    initializeNavbar('comments');
    
    // Setup form validation
    this.setupFormValidation();
  }

  setupFormValidation() {
    this.validator = new FormValidator('newCommentForm', {
      commentContent: {
        required: true,
        minLength: 5,
        message: 'El comentario debe tener al menos 5 caracteres'
      },
      documentId: {
        required: true,
        message: 'El ID del documento es requerido'
      }
    });
  }

  setupEventListeners() {
    // Comment form submission
    const commentForm = document.getElementById('newCommentForm');
    commentForm.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleCommentSubmission();
    });

    // Comment type toggle
    const typeRadios = document.querySelectorAll('input[name="commentType"]');
    typeRadios.forEach(radio => {
      radio.addEventListener('change', (e) => {
        this.toggleTaskFields(e.target.value === 'task');
        this.updateSubmitButton(e.target.value);
      });
    });

    // Filter dropdown
    const filterType = document.getElementById('filterType');
    if (filterType) {
      filterType.addEventListener('change', (e) => {
        this.currentFilter = e.target.value;
        this.filterComments();
      });
    }

    // Search input
    const searchInput = document.getElementById('searchComments');
    if (searchInput) {
      searchInput.addEventListener('input', () => this.filterComments());
    }

    // Quick actions
    this.setupQuickActions();
  }

  setupQuickActions() {
    const markAllReadBtn = document.getElementById('markAllRead');
    const exportBtn = document.getElementById('exportComments');
    const refreshBtn = document.getElementById('refreshComments');

    if (markAllReadBtn) {
      markAllReadBtn.addEventListener('click', () => this.markAllAsRead());
    }

    if (exportBtn) {
      exportBtn.addEventListener('click', () => this.exportComments());
    }

    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => this.loadComments());
    }
  }

  toggleTaskFields(isTask) {
    const taskFields = document.querySelectorAll('.task-fields');
    taskFields.forEach(field => {
      if (isTask) {
        field.classList.remove('d-none');
        field.classList.add('show');
      } else {
        field.classList.add('d-none');
        field.classList.remove('show');
      }
    });
  }

  updateSubmitButton(type) {
    const submitBtn = document.getElementById('submitBtn');
    const submitText = document.getElementById('submitText');
    
    if (type === 'task') {
      submitText.textContent = 'Crear Tarea';
      submitBtn.querySelector('i').className = 'bi bi-list-task me-2';
    } else {
      submitText.textContent = 'Agregar Comentario';
      submitBtn.querySelector('i').className = 'bi bi-plus-circle me-2';
    }
  }

  async handleCommentSubmission() {
    if (!this.validator.validate()) {
      return;
    }

    const submitBtn = document.getElementById('submitBtn');
    const originalText = submitBtn.innerHTML;
    
    try {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<i class="bi bi-arrow-clockwise spin me-2"></i>Guardando...';

      const formData = this.getFormData();
      
      const response = await docuFlowAPI.comments.create(formData);
      
      showNotification(`${formData.type === 'task' ? 'Tarea' : 'Comentario'} creado exitosamente`, 'success');
      
      // Reset form and reload comments
      document.getElementById('newCommentForm').reset();
      this.toggleTaskFields(false);
      this.updateSubmitButton('comment');
      
      this.loadComments();
      this.updateStats();

    } catch (error) {
      console.error('Error creating comment:', error);
      showNotification('Error al crear el comentario', 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalText;
    }
  }

  getFormData() {
    const commentType = document.querySelector('input[name="commentType"]:checked').value;
    
    const formData = {
      content: document.getElementById('commentContent').value.trim(),
      type: commentType,
      documentId: parseInt(document.getElementById('documentId').value)
    };

    if (commentType === 'task') {
      const assignees = document.getElementById('assignees').value.trim();
      const dueDate = document.getElementById('dueDate').value;
      const priority = document.getElementById('priority').value;
      
      formData.assignees = assignees ? assignees.split(',').map(email => email.trim()) : [];
      formData.dueDate = dueDate || null;
      formData.priority = priority;
    }

    return formData;
  }

  async loadComments() {
    try {
      // In a real app, you'd pass a document ID
      // For now, we'll load all comments or use demo data
      const response = await this.getDemoComments();
      this.comments = response;
      this.filterComments();
    } catch (error) {
      console.error('Error loading comments:', error);
      this.comments = this.getDemoComments();
      this.filterComments();
    }
  }

  getDemoComments() {
    // Demo data for development
    return [
      {
        id: '1',
        content: 'Este documento necesita revisión urgente en la sección de conclusiones.',
        type: 'comment',
        author: 'María González',
        createdAt: '2024-03-15T10:30:00Z',
        status: 'pending'
      },
      {
        id: '2',
        content: 'Completar la validación de datos antes del viernes.',
        type: 'task',
        author: 'Juan Pérez',
        createdAt: '2024-03-14T15:45:00Z',
        dueDate: '2024-03-22T17:00:00Z',
        priority: 'high',
        assignees: ['ana@docuflow.com', 'carlos@docuflow.com'],
        status: 'pending'
      },
      {
        id: '3',
        content: 'Actualización de formato aplicada correctamente.',
        type: 'comment',
        author: 'Ana López',
        createdAt: '2024-03-13T09:15:00Z',
        status: 'completed'
      },
      {
        id: '4',
        content: 'Revisar y aprobar los cambios propuestos en el documento.',
        type: 'task',
        author: 'Carlos Ruiz',
        createdAt: '2024-03-12T14:20:00Z',
        dueDate: '2024-03-20T12:00:00Z',
        priority: 'medium',
        assignees: ['supervisor@docuflow.com'],
        status: 'completed'
      }
    ];
  }

  filterComments() {
    const searchTerm = document.getElementById('searchComments')?.value.toLowerCase() || '';
    
    this.filteredComments = this.comments.filter(comment => {
      // Filter by type
      if (this.currentFilter !== 'all') {
        if (this.currentFilter === 'comments' && comment.type === 'task') return false;
        if (this.currentFilter === 'tasks' && comment.type === 'comment') return false;
        if (this.currentFilter === 'pending' && comment.status === 'completed') return false;
        if (this.currentFilter === 'completed' && comment.status !== 'completed') return false;
      }
      
      // Filter by search term
      if (searchTerm) {
        return comment.content.toLowerCase().includes(searchTerm) ||
               (comment.author && comment.author.toLowerCase().includes(searchTerm));
      }
      
      return true;
    });

    this.currentPage = 1;
    this.renderComments();
    this.updatePagination();
  }

  renderComments() {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const endIndex = startIndex + this.itemsPerPage;
    const commentsToShow = this.filteredComments.slice(startIndex, endIndex);

    const container = document.getElementById('commentsSection');
    const emptyState = document.getElementById('commentsMsg');

    if (commentsToShow.length === 0) {
      container.innerHTML = '';
      emptyState.classList.remove('d-none');
      return;
    }

    emptyState.classList.add('d-none');
    container.innerHTML = commentsToShow.map(comment => this.renderCommentItem(comment)).join('');
    
    this.updateShowingCount();
  }

  renderCommentItem(comment) {
    const isTask = comment.type === 'task';
    const typeClass = isTask ? 'task' : 'comment';
    const completedClass = comment.status === 'completed' ? 'completed' : '';
    
    return `
      <div class="comment-item ${typeClass} ${completedClass}" data-comment-id="${comment.id}">
        <div class="comment-header">
          <div class="d-flex align-items-center gap-2">
            <span class="comment-type ${typeClass}">
              <i class="bi bi-${isTask ? 'list-task' : 'chat-text'}"></i>
              ${isTask ? 'Tarea' : 'Comentario'}
            </span>
            ${comment.priority && isTask ? `<span class="priority-badge ${comment.priority}">${this.getPriorityText(comment.priority)}</span>` : ''}
          </div>
          <div class="comment-meta">
            <span><i class="bi bi-person"></i> ${comment.author || 'Usuario'}</span>
            <span><i class="bi bi-clock"></i> ${this.formatDate(comment.createdAt)}</span>
            ${comment.dueDate && isTask ? `<span><i class="bi bi-calendar"></i> ${this.formatDate(comment.dueDate)}</span>` : ''}
          </div>
        </div>
        
        <div class="comment-content">
          ${comment.content}
        </div>
        
        ${comment.assignees && isTask ? `
          <div class="comment-assignees">
            <small class="text-gray-600">
              <i class="bi bi-people"></i> Asignado a: ${comment.assignees.join(', ')}
            </small>
          </div>
        ` : ''}
        
        <div class="comment-actions">
          <button class="action-btn reply" onclick="commentsController.replyToComment('${comment.id}')">
            <i class="bi bi-reply"></i> Responder
          </button>
          ${isTask && comment.status !== 'completed' ? `
            <button class="action-btn complete" onclick="commentsController.completeTask('${comment.id}')">
              <i class="bi bi-check-circle"></i> Completar
            </button>
          ` : ''}
          <button class="action-btn delete" onclick="commentsController.deleteComment('${comment.id}')">
            <i class="bi bi-trash"></i> Eliminar
          </button>
        </div>
      </div>
    `;
  }

  getPriorityText(priority) {
    const priorities = {
      low: 'Baja',
      medium: 'Media',
      high: 'Alta',
      urgent: 'Urgente'
    };
    return priorities[priority] || priority;
  }

  formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  updatePagination() {
    const totalItems = this.filteredComments.length;
    const totalPages = Math.ceil(totalItems / this.itemsPerPage);
    
    const paginationContainer = document.getElementById('paginationContainer');
    if (!paginationContainer) return;

    if (totalPages <= 1) {
      paginationContainer.innerHTML = '';
      return;
    }

    const pagination = new Pagination(paginationContainer, {
      currentPage: this.currentPage,
      totalPages: totalPages,
      onPageChange: (page) => {
        this.currentPage = page;
        this.renderComments();
      }
    });
  }

  updateShowingCount() {
    const showingElement = document.getElementById('showingCount');
    const totalElement = document.getElementById('totalCount');
    
    if (showingElement && totalElement) {
      const startIndex = (this.currentPage - 1) * this.itemsPerPage;
      const endIndex = Math.min(startIndex + this.itemsPerPage, this.filteredComments.length);
      
      showingElement.textContent = this.filteredComments.length > 0 ? `${startIndex + 1}-${endIndex}` : '0';
      totalElement.textContent = this.filteredComments.length;
    }
  }

  async updateStats() {
    const commentsCount = this.comments.filter(c => c.type === 'comment').length;
    const tasksCount = this.comments.filter(c => c.type === 'task').length;
    const completedCount = this.comments.filter(c => c.type === 'task' && c.status === 'completed').length;
    
    document.getElementById('commentsCount').textContent = commentsCount;
    document.getElementById('tasksCount').textContent = tasksCount;
    document.getElementById('completedCount').textContent = completedCount;
  }

  // Action methods
  async replyToComment(commentId) {
    showNotification('Función de respuesta en desarrollo', 'info');
  }

  async completeTask(commentId) {
    try {
      // Find and update the comment locally for demo
      const comment = this.comments.find(c => c.id === commentId);
      if (comment) {
        comment.status = 'completed';
        showNotification('Tarea marcada como completada', 'success');
        this.filterComments();
        this.updateStats();
      }
    } catch (error) {
      console.error('Error completing task:', error);
      showNotification('Error al completar la tarea', 'error');
    }
  }

  async deleteComment(commentId) {
    if (!confirm('¿Estás seguro de eliminar este elemento?')) return;

    try {
      // Remove from local array for demo
      this.comments = this.comments.filter(c => c.id !== commentId);
      showNotification('Elemento eliminado', 'success');
      this.filterComments();
      this.updateStats();
    } catch (error) {
      console.error('Error deleting comment:', error);
      showNotification('Error al eliminar el elemento', 'error');
    }
  }

  async markAllAsRead() {
    showNotification('Todos los comentarios marcados como leídos', 'success');
  }

  async exportComments() {
    try {
      const csvContent = this.generateCSV();
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `comentarios_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      showNotification('Comentarios exportados', 'success');
    } catch (error) {
      console.error('Export error:', error);
      showNotification('Error al exportar comentarios', 'error');
    }
  }

  generateCSV() {
    const headers = ['ID', 'Tipo', 'Contenido', 'Autor', 'Fecha', 'Estado', 'Prioridad', 'Asignados'];
    const rows = this.comments.map(comment => [
      comment.id,
      comment.type === 'task' ? 'Tarea' : 'Comentario',
      `"${comment.content.replace(/"/g, '""')}"`,
      comment.author || '',
      this.formatDate(comment.createdAt),
      comment.status === 'completed' ? 'Completado' : 'Pendiente',
      comment.priority || '',
      comment.assignees ? comment.assignees.join('; ') : ''
    ]);
    
    return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
  }
}

// Initialize controller and make it globally available
let commentsController;
document.addEventListener('DOMContentLoaded', () => {
  commentsController = new CommentsController();
});
