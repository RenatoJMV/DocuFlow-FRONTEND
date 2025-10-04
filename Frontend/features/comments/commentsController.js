import apiClient, { docuFlowAPI } from '../../shared/services/apiClient.js';
import { store } from '../../shared/services/store.js';
import { initializeNavbar, showNotification, Pagination, FormValidator } from '../../shared/utils/uiHelpers.js';

class CommentsController {
  constructor() {
    this.comments = [];
    this.filteredComments = [];
    this.currentPage = 1;
    this.itemsPerPage = 10;
    this.currentFilter = 'all';
    this.pagination = null;
    this.validator = null;

    this.initializeComponents();
    this.setupEventListeners();
    this.loadComments();
  }

  initializeComponents() {
    initializeNavbar('comments');
    this.setupFormValidation();
    this.toggleTaskFields(false);
    this.updateSubmitButton('comment');
    this.updateShowingCount();
    this.updateStats();
  }

  setupFormValidation() {
    this.validator = new FormValidator('newCommentForm');
    this.validator
      .addRule('commentContent', (value) => value && value.trim().length >= 5, 'El comentario debe tener al menos 5 caracteres')
      .addRule('documentId', (value) => !!value && !Number.isNaN(Number(value)), 'El ID del documento es requerido');
  }

  setupEventListeners() {
    const commentForm = document.getElementById('newCommentForm');
    if (commentForm) {
      commentForm.addEventListener('submit', (event) => {
        event.preventDefault();
        this.handleCommentSubmission();
      });
    }

    const typeRadios = document.querySelectorAll('input[name="commentType"]');
    typeRadios.forEach((radio) => {
      radio.addEventListener('change', (event) => {
        const isTask = event.target.value === 'task';
        this.toggleTaskFields(isTask);
        this.updateSubmitButton(event.target.value);
      });
    });

    const filterType = document.getElementById('filterType');
    if (filterType) {
      filterType.addEventListener('change', (event) => {
        this.currentFilter = event.target.value;
        this.filterComments();
      });
    }

    const searchInput = document.getElementById('searchComments');
    if (searchInput) {
      searchInput.addEventListener('input', () => this.filterComments());
    }

    this.setupQuickActions();
  }

  setupQuickActions() {
    const markAllReadBtn = document.getElementById('markAllRead');
    if (markAllReadBtn) {
      markAllReadBtn.addEventListener('click', () => this.markAllAsRead());
    }

    const exportBtn = document.getElementById('exportComments');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => this.exportComments());
    }

    const refreshBtn = document.getElementById('refreshComments');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => this.loadComments());
    }
  }

  toggleTaskFields(isTask) {
    const taskFields = document.querySelectorAll('.task-fields');
    taskFields.forEach((field) => {
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
    if (!submitBtn || !submitText) return;

    if (type === 'task') {
      submitText.textContent = 'Crear Tarea';
      const icon = submitBtn.querySelector('i');
      if (icon) icon.className = 'bi bi-list-task me-2';
    } else {
      submitText.textContent = 'Agregar Comentario';
      const icon = submitBtn.querySelector('i');
      if (icon) icon.className = 'bi bi-plus-circle me-2';
    }
  }

  async handleCommentSubmission() {
    if (this.validator) {
      const validation = this.validator.validate();
      if (!validation.isValid) {
        return;
      }
    }

    const submitBtn = document.getElementById('submitBtn');
    if (!submitBtn) {
      return;
    }

    const originalText = submitBtn.innerHTML;
    try {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<i class="bi bi-arrow-clockwise spin me-2"></i>Guardando...';

      const formData = this.getFormData();
      const created = await docuFlowAPI.comments.create(formData);
      showNotification(`${formData.type === 'task' ? 'Tarea' : 'Comentario'} creado exitosamente`, 'success');

      document.getElementById('newCommentForm')?.reset();
      this.toggleTaskFields(false);
      this.updateSubmitButton('comment');

      if (created) {
        this.comments.unshift(this.normalizeComment(created));
      }

      await this.loadComments(true);
    } catch (error) {
      console.error('Error creating comment:', error);
      showNotification('Error al crear el comentario', 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalText;
    }
  }

  getFormData() {
    const commentType = document.querySelector('input[name="commentType"]:checked')?.value || 'comment';

    const formData = {
      content: document.getElementById('commentContent')?.value.trim() || '',
      type: commentType,
      documentId: parseInt(document.getElementById('documentId')?.value, 10)
    };

    if (commentType === 'task') {
      const assignees = document.getElementById('assignees')?.value.trim() || '';
      const dueDate = document.getElementById('dueDate')?.value || null;
      const priority = document.getElementById('priority')?.value || 'medium';

      formData.assignees = assignees ? assignees.split(',').map((email) => email.trim()) : [];
      formData.dueDate = dueDate || null;
      formData.priority = priority;
    }

    return formData;
  }

  async loadComments(silent = false) {
    try {
      console.log('📝 Cargando comentarios desde /api/comments...');
      const response = await apiClient.get('/api/comments', { showLoading: false, showErrorNotification: false });
      const comments = this.extractArray(response, ['comments', 'data']);

      if (Array.isArray(comments) && comments.length > 0) {
        this.comments = comments.map((comment) => this.normalizeComment(comment));
        if (!silent) {
          showNotification(`${this.comments.length} comentarios cargados del servidor`, 'success', 2000);
        }
      } else {
        this.comments = [];
        if (!silent) {
          showNotification('No se encontraron comentarios en el servidor', 'info', 2000);
        }
      }
    } catch (error) {
      console.error('❌ Error cargando comentarios del backend:', error);
      if (!silent) {
        showNotification('Error al cargar comentarios, usando datos demo', 'warning');
      }
      this.comments = this.getDemoComments();
    }

    store.setComments(this.comments);
    this.filterComments();
    this.updateStats();
  }

  extractArray(payload, keys = []) {
    if (Array.isArray(payload)) return payload;
    if (!payload) return [];
    for (const key of keys) {
      if (Array.isArray(payload[key])) return payload[key];
      if (payload[key]) payload = payload[key];
    }
    return Array.isArray(payload) ? payload : [];
  }

  normalizeComment(raw = {}) {
    const generatedId = `${Date.now()}-${Math.random()}`;
    const status = raw.status || (raw.resolved ? 'completed' : raw.state) || 'pending';
    return {
      id: raw.id ?? raw.commentId ?? generatedId,
      content: raw.content || raw.text || 'Sin contenido',
      type: raw.type || (raw.isTask ? 'task' : 'comment'),
      author: raw.author || raw.user || raw.createdBy || 'Usuario desconocido',
      createdAt: raw.createdAt || raw.timestamp || new Date().toISOString(),
      status,
      fileId: raw.fileId || null,
      priority: raw.priority || (status === 'completed' ? 'medium' : 'normal'),
      assignees: raw.assignees || raw.users || [],
      dueDate: raw.dueDate || raw.deadline || null
    };
  }

  getDemoComments() {
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

    this.filteredComments = this.comments.filter((comment) => {
      if (this.currentFilter !== 'all') {
        if (this.currentFilter === 'comments' && comment.type === 'task') return false;
        if (this.currentFilter === 'tasks' && comment.type === 'comment') return false;
        if (this.currentFilter === 'pending' && comment.status === 'completed') return false;
        if (this.currentFilter === 'completed' && comment.status !== 'completed') return false;
      }

      if (searchTerm) {
        return (
          comment.content.toLowerCase().includes(searchTerm) ||
          (comment.author && comment.author.toLowerCase().includes(searchTerm))
        );
      }

      return true;
    });

    this.currentPage = 1;
    this.renderComments();
    this.updatePagination();
    this.updateShowingCount();
  }

  renderComments() {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const endIndex = startIndex + this.itemsPerPage;
    const commentsToShow = this.filteredComments.slice(startIndex, endIndex);

    const container = document.getElementById('commentsSection');
    const emptyState = document.getElementById('commentsMsg');
    if (!container || !emptyState) return;

    if (commentsToShow.length === 0) {
      container.innerHTML = '';
      emptyState.classList.remove('d-none');
      this.updateShowingCount();
      return;
    }

    emptyState.classList.add('d-none');
    container.innerHTML = commentsToShow.map((comment) => this.renderCommentItem(comment)).join('');
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
        ${comment.assignees && comment.assignees.length && isTask ? `
          <div class="comment-assignees">
            <small class="text-gray-600">
              <i class="bi bi-people"></i> Asignado a: ${comment.assignees.join(', ')}
            </small>
          </div>`
        : ''}
        <div class="comment-actions">
          <button class="action-btn reply" onclick="commentsController.replyToComment('${comment.id}')">
            <i class="bi bi-reply"></i> Responder
          </button>
          ${isTask && comment.status !== 'completed' ? `
            <button class="action-btn complete" onclick="commentsController.completeTask('${comment.id}')">
              <i class="bi bi-check-circle"></i> Completar
            </button>`
          : ''}
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
    if (!this.pagination) {
      this.pagination = new Pagination('paginationContainer', {
        itemsPerPage: this.itemsPerPage,
        currentPage: this.currentPage,
        onPageChange: (page) => {
          this.currentPage = page;
          this.renderComments();
          this.updatePagination();
        }
      });
    }

    this.pagination.setItemsPerPage(this.itemsPerPage);
    this.pagination.currentPage = this.currentPage;
    this.pagination.render(this.filteredComments.length);
  }

  updateShowingCount() {
    const showingElement = document.getElementById('showingCount');
    const totalElement = document.getElementById('totalCount');

    if (!showingElement || !totalElement) return;

    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const endIndex = Math.min(startIndex + this.itemsPerPage, this.filteredComments.length);

    showingElement.textContent = this.filteredComments.length > 0 ? `${startIndex + 1}-${endIndex}` : '0';
    totalElement.textContent = this.filteredComments.length;
  }

  updateStats() {
    const commentsCount = this.comments.filter((c) => c.type === 'comment').length;
    const tasksCount = this.comments.filter((c) => c.type === 'task').length;
    const completedCount = this.comments.filter((c) => c.type === 'task' && c.status === 'completed').length;

    const commentsCountElement = document.getElementById('commentsCount');
    if (commentsCountElement) commentsCountElement.textContent = commentsCount;

    const tasksCountElement = document.getElementById('tasksCount');
    if (tasksCountElement) tasksCountElement.textContent = tasksCount;

    const completedCountElement = document.getElementById('completedCount');
    if (completedCountElement) completedCountElement.textContent = completedCount;

    store.updateDashboardStats({ totalComments: commentsCount + tasksCount });
  }

  async replyToComment() {
    showNotification('Función de respuesta en desarrollo', 'info');
  }

  async completeTask(commentId) {
    try {
      const comment = this.comments.find((c) => String(c.id) === String(commentId));
      if (!comment) return;

  await docuFlowAPI.comments.update(comment.id, { status: 'completed' });
  comment.status = 'completed';
  showNotification('Tarea marcada como completada', 'success');
  store.setComments(this.comments);
  this.filterComments();
  this.updateStats();
    } catch (error) {
      console.error('Error completing task:', error);
      showNotification('Error al completar la tarea', 'error');
    }
  }

  async deleteComment(commentId) {
    if (!confirm('¿Estás seguro de eliminar este elemento?')) return;

    try {
      await docuFlowAPI.comments.delete(commentId);
      this.comments = this.comments.filter((c) => String(c.id) !== String(commentId));
      store.setComments(this.comments);
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
      if (this.comments.length === 0) {
        showNotification('No hay comentarios para exportar', 'warning');
        return;
      }

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
    const rows = this.comments.map((comment) => [
      comment.id,
      comment.type === 'task' ? 'Tarea' : 'Comentario',
      `"${comment.content.replace(/"/g, '""')}"`,
      comment.author || '',
      this.formatDate(comment.createdAt),
      comment.status === 'completed' ? 'Completado' : 'Pendiente',
      comment.priority || '',
      comment.assignees ? comment.assignees.join('; ') : ''
    ]);

    return [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
  }
}

let commentsController;
document.addEventListener('DOMContentLoaded', () => {
  commentsController = new CommentsController();
});

export { CommentsController };
