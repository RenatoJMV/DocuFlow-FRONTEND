class CommentsController {import { docuFlowAPI } from '../../shared/services/apiClient.js';

    constructor() {import { store } from '../../shared/services/store.js';

        this.comments = [import { initializeNavbar, showNotification, Pagination, FormValidator } from '../../shared/utils/uiHelpers.js';

            {

                id: 1,class CommentsController {

                type: 'task',  constructor() {

                title: 'Revisar documentos legales',    this.comments = [];

                content: 'Necesitamos revisar todos los contratos pendientes para el próximo trimestre',    this.filteredComments = [];

                author: 'admin@docuflow.com',    this.currentPage = 1;

                status: 'pending',    this.itemsPerPage = 10;

                priority: 'high',    this.currentFilter = 'all';

                createdAt: '2024-01-15T10:30:00',    this.pagination = new Pagination('paginationContainer', {

                dueDate: '2024-01-20T00:00:00'      itemsPerPage: this.itemsPerPage,

            },      currentPage: this.currentPage,

            {      onPageChange: (page) => {

                id: 2,        this.currentPage = page;

                type: 'comment',        this.renderComments();

                title: 'Feedback sobre interfaz',        this.updatePagination();

                content: 'La nueva interfaz está mucho más clara y es más fácil de usar',      }

                author: 'usuario@empresa.com',    });

                status: 'completed',    

                priority: 'medium',    this.initializeComponents();

                createdAt: '2024-01-14T14:22:00',    this.setupEventListeners();

                dueDate: null    this.loadComments();

            }    this.updateStats();

        ];  }

        

        this.initializeEventListeners();  initializeComponents() {

        this.renderComments();    // Create navbar

        this.updateStatistics();    initializeNavbar('comments');

    }    

    // Setup form validation

    initializeEventListeners() {    this.setupFormValidation();

        const saveBtn = document.getElementById('saveCommentBtn');  }

        if (saveBtn) {

            saveBtn.addEventListener('click', () => this.saveComment());  setupFormValidation() {

        }    this.validator = new FormValidator('newCommentForm', {

    }      commentContent: {

        required: true,

    saveComment() {        minLength: 5,

        const type = document.getElementById('commentType').value;        message: 'El comentario debe tener al menos 5 caracteres'

        const title = document.getElementById('commentTitle').value;      },

        const content = document.getElementById('commentContent').value;      documentId: {

        required: true,

        if (!type || !title || !content) {        message: 'El ID del documento es requerido'

            this.showNotification('Por favor completa todos los campos obligatorios', 'warning');      }

            return;    });

        }  }



        const newComment = {  setupEventListeners() {

            id: this.comments.length + 1,    // Comment form submission

            type: type,    const commentForm = document.getElementById('newCommentForm');

            title: title,    commentForm.addEventListener('submit', (e) => {

            content: content,      e.preventDefault();

            author: 'usuario@empresa.com',      this.handleCommentSubmission();

            status: 'pending',    });

            priority: 'medium',

            createdAt: new Date().toISOString(),    // Comment type toggle

            dueDate: null    const typeRadios = document.querySelectorAll('input[name="commentType"]');

        };    typeRadios.forEach(radio => {

      radio.addEventListener('change', (e) => {

        this.comments.unshift(newComment);        this.toggleTaskFields(e.target.value === 'task');

        this.renderComments();        this.updateSubmitButton(e.target.value);

        this.updateStatistics();      });

        this.showNotification('Comentario/tarea creado correctamente', 'success');    });

    }

    // Filter dropdown

    renderComments() {    const filterType = document.getElementById('filterType');

        const tbody = document.getElementById('commentsTableBody');    if (filterType) {

        if (!tbody) return;      filterType.addEventListener('change', (e) => {

        this.currentFilter = e.target.value;

        tbody.innerHTML = '';        this.filterComments();

      });

        this.comments.forEach(comment => {    }

            const row = document.createElement('tr');

            row.innerHTML = `    // Search input

                <td>    const searchInput = document.getElementById('searchComments');

                    <span class="badge bg-primary">    if (searchInput) {

                        ${comment.type === 'task' ? 'Tarea' : 'Comentario'}      searchInput.addEventListener('input', () => this.filterComments());

                    </span>    }

                </td>

                <td>    // Quick actions

                    <div>    this.setupQuickActions();

                        <strong>${comment.title}</strong>  }

                        <p class="text-muted mb-0 small">${comment.content}</p>

                    </div>  setupQuickActions() {

                </td>    const markAllReadBtn = document.getElementById('markAllRead');

                <td>${comment.author}</td>    const exportBtn = document.getElementById('exportComments');

                <td>    const refreshBtn = document.getElementById('refreshComments');

                    <span class="badge bg-warning">${comment.status}</span>

                </td>    if (markAllReadBtn) {

                <td>      markAllReadBtn.addEventListener('click', () => this.markAllAsRead());

                    <small class="text-muted">${this.formatDate(comment.createdAt)}</small>    }

                </td>

                <td>    if (exportBtn) {

                    <button type="button" class="btn btn-sm btn-outline-danger" onclick="commentsController.deleteComment(${comment.id})">      exportBtn.addEventListener('click', () => this.exportComments());

                        <i class="fas fa-trash"></i>    }

                    </button>

                </td>    if (refreshBtn) {

            `;      refreshBtn.addEventListener('click', () => this.loadComments());

            tbody.appendChild(row);    }

        });  }

    }

  toggleTaskFields(isTask) {

    deleteComment(commentId) {    const taskFields = document.querySelectorAll('.task-fields');

        const commentIndex = this.comments.findIndex(c => c.id === commentId);    taskFields.forEach(field => {

        if (commentIndex > -1) {      if (isTask) {

            this.comments.splice(commentIndex, 1);        field.classList.remove('d-none');

            this.renderComments();        field.classList.add('show');

            this.updateStatistics();      } else {

            this.showNotification('Comentario eliminado correctamente', 'success');        field.classList.add('d-none');

        }        field.classList.remove('show');

    }      }

    });

    updateStatistics() {  }

        const total = this.comments.length;

        const tasks = this.comments.filter(c => c.type === 'task').length;  updateSubmitButton(type) {

            const submitBtn = document.getElementById('submitBtn');

        if (document.getElementById('totalComments')) {    const submitText = document.getElementById('submitText');

            document.getElementById('totalComments').textContent = total;    

        }    if (type === 'task') {

        if (document.getElementById('pendingTasks')) {      submitText.textContent = 'Crear Tarea';

            document.getElementById('pendingTasks').textContent = tasks;      submitBtn.querySelector('i').className = 'bi bi-list-task me-2';

        }    } else {

        if (document.getElementById('completedTasks')) {      submitText.textContent = 'Agregar Comentario';

            document.getElementById('completedTasks').textContent = 0;      submitBtn.querySelector('i').className = 'bi bi-plus-circle me-2';

        }    }

        if (document.getElementById('todayComments')) {  }

            document.getElementById('todayComments').textContent = 0;

        }  async handleCommentSubmission() {

    }    if (!this.validator.validate()) {

      return;

    formatDate(dateString) {    }

        return new Date(dateString).toLocaleDateString('es-ES');

    }    const submitBtn = document.getElementById('submitBtn');

    const originalText = submitBtn.innerHTML;

    showNotification(message, type = 'info') {    

        const notification = document.createElement('div');    try {

        notification.className = `alert alert-${type} alert-dismissible fade show position-fixed`;      submitBtn.disabled = true;

        notification.style.cssText = 'top: 20px; right: 20px; z-index: 9999; min-width: 300px;';      submitBtn.innerHTML = '<i class="bi bi-arrow-clockwise spin me-2"></i>Guardando...';

        notification.innerHTML = `

            ${message}      const formData = this.getFormData();

            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>      

        `;      const response = await docuFlowAPI.comments.create(formData);

              

        document.body.appendChild(notification);      showNotification(`${formData.type === 'task' ? 'Tarea' : 'Comentario'} creado exitosamente`, 'success');

              

        setTimeout(() => {      // Reset form and reload comments

            notification.remove();      document.getElementById('newCommentForm').reset();

        }, 5000);      this.toggleTaskFields(false);

    }      this.updateSubmitButton('comment');

}      

      this.loadComments();

let commentsController;      this.updateStats();

document.addEventListener('DOMContentLoaded', () => {

    commentsController = new CommentsController();    } catch (error) {

});      console.error('Error creating comment:', error);
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
      // Cargar comentarios del endpoint real del backend
      console.log('📝 Cargando comentarios desde /api/comments...');
      const response = await docuFlowAPI.get('/api/comments');
      
      // Extraer comentarios del response
      const comments = response?.comments || response?.data || response || [];
      
      if (Array.isArray(comments) && comments.length > 0) {
        // Convertir comentarios del backend al formato del frontend
        this.comments = comments.map(comment => ({
          id: comment.id || Date.now() + Math.random(),
          content: comment.content || comment.text || 'Sin contenido',
          type: comment.type || 'comment',
          author: comment.author || comment.user || 'Usuario desconocido',
          createdAt: comment.createdAt || comment.timestamp || new Date().toISOString(),
          status: comment.status || comment.resolved ? 'resolved' : 'pending',
          fileId: comment.fileId || null,
          // Campos adicionales si existen
          priority: comment.priority || 'normal',
          assignees: comment.assignees || [],
          dueDate: comment.dueDate || null
        }));
        
        console.log(`✅ ${this.comments.length} comentarios cargados desde el backend`);
        showNotification(`${this.comments.length} comentarios cargados del servidor`, 'success', 2000);
      } else {
        console.log('⚠️ No se encontraron comentarios en el servidor');
        this.comments = [];
        showNotification('No se encontraron comentarios en el servidor', 'info', 2000);
      }
      
      this.filterComments();
      
    } catch (error) {
      console.error('❌ Error cargando comentarios del backend:', error);
      showNotification('Error al cargar comentarios, usando datos demo', 'warning');
      
      // Fallback a datos demo
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
      this.updateShowingCount();
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
