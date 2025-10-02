class CommentsController {// commentsControllerSimple.js - Controlador simplificado para comentarios y tareas

    constructor() {import { docuFlowAPI } from '../../shared/services/apiClientSimple.js';

        this.comments = [import authService from '../../shared/services/authServiceSimple.js';

            {import { showNotification } from '../../shared/utils/uiHelpers.js';

                id: 1,

                type: 'task',class SimpleCommentsController {

                title: 'Revisar documentos legales',  constructor() {

                content: 'Necesitamos revisar todos los contratos pendientes para el próximo trimestre',    this.comments = [];

                author: 'admin@docuflow.com',    this.currentFileId = null;

                status: 'pending',    this.init();

                priority: 'high',  }

                createdAt: '2024-01-15T10:30:00',

                dueDate: '2024-01-20T00:00:00'  async init() {

            },    if (!authService.isLoggedIn()) {

            {      window.location.href = '../auth/login.html';

                id: 2,      return;

                type: 'comment',    }

                title: 'Feedback sobre interfaz',

                content: 'La nueva interfaz está mucho más clara y es más fácil de usar',    // Obtener fileId de la URL

                author: 'usuario@empresa.com',    const urlParams = new URLSearchParams(window.location.search);

                status: 'completed',    this.currentFileId = urlParams.get('fileId');

                priority: 'medium',

                createdAt: '2024-01-14T14:22:00',    if (!this.currentFileId) {

                dueDate: null      showNotification('ID de archivo no especificado', 'error');

            },      window.location.href = '../files/upload.html';

            {      return;

                id: 3,    }

                type: 'task',

                title: 'Actualizar base de datos',    this.setupEventListeners();

                content: 'Migrar información de clientes al nuevo sistema',    await this.loadComments();

                author: 'desarrollo@empresa.com',    this.updateUI();

                status: 'in-progress',  }

                priority: 'urgent',

                createdAt: '2024-01-13T09:15:00',  setupEventListeners() {

                dueDate: '2024-01-18T00:00:00'    // Formulario de nuevo comentario

            }    const commentForm = document.getElementById('commentForm');

        ];    if (commentForm) {

              commentForm.addEventListener('submit', (e) => this.handleSubmitComment(e));

        this.initializeEventListeners();    }

        this.renderComments();

        this.updateStatistics();    // Tipo de comentario

    }    const commentType = document.getElementById('commentType');

    if (commentType) {

    initializeEventListeners() {      commentType.addEventListener('change', (e) => this.toggleTaskFields(e.target.value));

        document.getElementById('saveCommentBtn').addEventListener('click', () => {    }

            this.saveComment();

        });    // Filtros

    const typeFilter = document.getElementById('typeFilter');

        document.getElementById('newCommentModal').addEventListener('hidden.bs.modal', () => {    if (typeFilter) {

            this.clearCommentForm();      typeFilter.addEventListener('change', (e) => this.filterComments(e.target.value));

        });    }



        document.getElementById('commentType').addEventListener('change', (e) => {    const statusFilter = document.getElementById('statusFilter');

            const statusField = document.getElementById('statusField');    if (statusFilter) {

            if (e.target.value === 'task') {      statusFilter.addEventListener('change', (e) => this.filterByStatus(e.target.value));

                statusField.style.display = 'block';    }

            } else {

                statusField.style.display = 'none';    // Refresh

            }    const refreshBtn = document.getElementById('refreshBtn');

        });    if (refreshBtn) {

    }      refreshBtn.addEventListener('click', () => this.loadComments());

    }

    saveComment() {

        const type = document.getElementById('commentType').value;    // Volver a archivos

        const title = document.getElementById('commentTitle').value;    const backBtn = document.getElementById('backBtn');

        const content = document.getElementById('commentContent').value;    if (backBtn) {

        const priority = document.getElementById('commentPriority').value;      backBtn.addEventListener('click', () => window.location.href = '../files/upload.html');

        const dueDate = document.getElementById('commentDueDate').value;    }

        const status = type === 'task' ? document.getElementById('commentStatus').value : 'completed';  }



        if (!type || !title || !content) {  async handleSubmitComment(event) {

            this.showNotification('Por favor completa todos los campos obligatorios', 'warning');    event.preventDefault();

            return;

        }    const content = document.getElementById('commentContent').value.trim();

    const type = document.getElementById('commentType').value;

        const newComment = {    

            id: this.comments.length + 1,    if (!content) {

            type: type,      showNotification('El contenido no puede estar vacío', 'error');

            title: title,      return;

            content: content,    }

            author: 'usuario@empresa.com',

            status: status,    const commentData = {

            priority: priority,      fileId: this.currentFileId,

            createdAt: new Date().toISOString(),      content,

            dueDate: dueDate ? new Date(dueDate).toISOString() : null      type,

        };      author: authService.getCurrentUser().email,

      createdAt: new Date().toISOString()

        this.comments.unshift(newComment);    };

        this.renderComments();

        this.updateStatistics();    // Si es una tarea, agregar campos adicionales

    if (type === 'task') {

        const modal = bootstrap.Modal.getInstance(document.getElementById('newCommentModal'));      commentData.completed = false;

        modal.hide();      commentData.priority = document.getElementById('taskPriority')?.value || 'medium';

      commentData.dueDate = document.getElementById('taskDueDate')?.value || null;

        this.showNotification('Comentario/tarea creado correctamente', 'success');    }

    }

    try {

    deleteComment(commentId) {      const response = await docuFlowAPI.comments.create(commentData);

        const commentIndex = this.comments.findIndex(c => c.id === commentId);      

        if (commentIndex > -1) {      if (response.success) {

            const commentTitle = this.comments[commentIndex].title;        showNotification(`${type === 'task' ? 'Tarea' : 'Comentario'} agregado correctamente`, 'success');

            this.comments.splice(commentIndex, 1);        

            this.renderComments();        // Limpiar formulario

            this.updateStatistics();        document.getElementById('commentForm').reset();

            this.showNotification(`${commentTitle} eliminado correctamente`, 'success');        this.toggleTaskFields('comment');

        }        

    }        // Recargar comentarios

        await this.loadComments();

    toggleStatus(commentId) {      }

        const comment = this.comments.find(c => c.id === commentId);

        if (comment && comment.type === 'task') {    } catch (error) {

            const statusOrder = ['pending', 'in-progress', 'completed'];      console.error('Error agregando comentario:', error);

            const currentIndex = statusOrder.indexOf(comment.status);      showNotification('Error agregando comentario', 'error');

            const nextIndex = (currentIndex + 1) % statusOrder.length;    }

            comment.status = statusOrder[nextIndex];  }

            

            this.renderComments();  async loadComments() {

            this.updateStatistics();    try {

            this.showNotification(`Estado actualizado a: ${this.getStatusText(comment.status)}`, 'success');      const response = await docuFlowAPI.comments.list(this.currentFileId);

        }      

    }      if (response.success) {

        this.comments = response.data.comments || [];

    renderComments() {        this.renderCommentsList();

        const tbody = document.getElementById('commentsTableBody');        this.updateStats();

        tbody.innerHTML = '';      }



        this.comments.forEach(comment => {    } catch (error) {

            const row = document.createElement('tr');      console.error('Error cargando comentarios:', error);

            row.innerHTML = `      showNotification('Error cargando comentarios', 'error');

                <td>    }

                    <span class="badge bg-${this.getTypeColor(comment.type)}">  }

                        <i class="${this.getTypeIcon(comment.type)} me-1"></i>

                        ${this.getTypeText(comment.type)}  filterComments(type) {

                    </span>    if (type === 'all') {

                </td>      this.renderCommentsList();

                <td>    } else {

                    <div>      const filtered = this.comments.filter(comment => comment.type === type);

                        <strong>${comment.title}</strong>      this.renderCommentsList(filtered);

                        <p class="text-muted mb-0 small">${comment.content}</p>    }

                        ${comment.dueDate ? `<small class="text-warning"><i class="fas fa-calendar me-1"></i>Vence: ${this.formatDate(comment.dueDate)}</small>` : ''}  }

                    </div>

                </td>  filterByStatus(status) {

                <td>${comment.author}</td>    if (status === 'all') {

                <td>      this.renderCommentsList();

                    ${comment.type === 'task' ?     } else {

                        `<span class="badge bg-${this.getStatusColor(comment.status)} cursor-pointer" onclick="commentsController.toggleStatus(${comment.id})" title="Clic para cambiar estado">      const completed = status === 'completed';

                            <i class="${this.getStatusIcon(comment.status)} me-1"></i>      const filtered = this.comments.filter(comment => 

                            ${this.getStatusText(comment.status)}        comment.type === 'task' && comment.completed === completed

                        </span>` :       );

                        `<span class="badge bg-secondary">N/A</span>`      this.renderCommentsList(filtered);

                    }    }

                </td>  }

                <td>

                    <span class="badge bg-${this.getPriorityColor(comment.priority)}">  renderCommentsList(commentsToRender = this.comments) {

                        ${this.getPriorityText(comment.priority)}    const container = document.getElementById('commentsList');

                    </span>    if (!container) return;

                    <br>

                    <small class="text-muted">${this.formatDate(comment.createdAt)}</small>    if (commentsToRender.length === 0) {

                </td>      container.innerHTML = `

                <td>        <div class="text-center py-5">

                    <div class="btn-group" role="group">          <i class="bi bi-chat-dots" style="font-size: 3rem; color: #ccc;"></i>

                        <button type="button" class="btn btn-sm btn-outline-danger" onclick="commentsController.deleteComment(${comment.id})" title="Eliminar">          <p class="text-muted mt-3">No hay comentarios para mostrar</p>

                            <i class="fas fa-trash"></i>        </div>

                        </button>      `;

                    </div>      return;

                </td>    }

            `;

            tbody.appendChild(row);    container.innerHTML = commentsToRender.map(comment => `

        });      <div class="comment-item card mb-3 ${comment.type === 'task' ? 'task-item' : ''}">

    }        <div class="card-body">

          <div class="d-flex justify-content-between align-items-start mb-2">

    updateStatistics() {            <div class="d-flex align-items-center">

        const totalComments = this.comments.length;              <i class="bi ${comment.type === 'task' ? 'bi-check-square' : 'bi-chat-dots'} me-2"></i>

        const pendingTasks = this.comments.filter(c => c.type === 'task' && c.status === 'pending').length;              <strong>${comment.author}</strong>

        const completedTasks = this.comments.filter(c => c.type === 'task' && c.status === 'completed').length;              <span class="badge ${comment.type === 'task' ? 'bg-primary' : 'bg-secondary'} ms-2">

        const todayComments = this.comments.filter(comment => {                ${comment.type === 'task' ? 'Tarea' : 'Comentario'}

            const commentDate = new Date(comment.createdAt);              </span>

            const today = new Date();              ${comment.type === 'task' && comment.completed ? 

            return commentDate.toDateString() === today.toDateString();                '<span class="badge bg-success ms-1">Completada</span>' : ''}

        }).length;            </div>

            <div class="comment-actions">

        document.getElementById('totalComments').textContent = totalComments;              <small class="text-muted">${this.formatDate(comment.createdAt)}</small>

        document.getElementById('pendingTasks').textContent = pendingTasks;              ${this.canEditComment(comment) ? `

        document.getElementById('completedTasks').textContent = completedTasks;                <button class="btn btn-sm btn-outline-primary ms-2" onclick="commentsController.editComment(${comment.id})">

        document.getElementById('todayComments').textContent = todayComments;                  <i class="bi bi-pencil"></i>

    }                </button>

                <button class="btn btn-sm btn-outline-danger ms-1" onclick="commentsController.deleteComment(${comment.id})">

    clearCommentForm() {                  <i class="bi bi-trash"></i>

        document.getElementById('commentForm').reset();                </button>

        document.getElementById('statusField').style.display = 'none';              ` : ''}

    }            </div>

          </div>

    getTypeColor(type) {          

        const colors = {          <div class="comment-content">

            'comment': 'primary',            <p class="mb-2">${comment.content}</p>

            'task': 'warning',            

            'note': 'info'            ${comment.type === 'task' ? `

        };              <div class="task-details mt-2">

        return colors[type] || 'secondary';                <div class="row">

    }                  <div class="col-md-4">

                    <small class="text-muted">

    getTypeIcon(type) {                      <i class="bi bi-flag me-1"></i>

        const icons = {                      Prioridad: ${this.getPriorityText(comment.priority)}

            'comment': 'fas fa-comment',                    </small>

            'task': 'fas fa-tasks',                  </div>

            'note': 'fas fa-sticky-note'                  ${comment.dueDate ? `

        };                    <div class="col-md-4">

        return icons[type] || 'fas fa-file';                      <small class="text-muted">

    }                        <i class="bi bi-calendar me-1"></i>

                        Vence: ${this.formatDate(comment.dueDate)}

    getTypeText(type) {                      </small>

        const texts = {                    </div>

            'comment': 'Comentario',                  ` : ''}

            'task': 'Tarea',                  <div class="col-md-4">

            'note': 'Nota'                    <button class="btn btn-sm ${comment.completed ? 'btn-success' : 'btn-outline-success'}" 

        };                            onclick="commentsController.toggleTaskStatus(${comment.id})">

        return texts[type] || type;                      <i class="bi ${comment.completed ? 'bi-check-circle-fill' : 'bi-circle'}"></i>

    }                      ${comment.completed ? 'Completada' : 'Marcar como completada'}

                    </button>

    getStatusColor(status) {                  </div>

        const colors = {                </div>

            'pending': 'warning',              </div>

            'in-progress': 'info',            ` : ''}

            'completed': 'success'          </div>

        };        </div>

        return colors[status] || 'secondary';      </div>

    }    `).join('');

  }

    getStatusIcon(status) {

        const icons = {  async toggleTaskStatus(commentId) {

            'pending': 'fas fa-clock',    const comment = this.comments.find(c => c.id === commentId);

            'in-progress': 'fas fa-spinner',    if (!comment || comment.type !== 'task') return;

            'completed': 'fas fa-check'

        };    try {

        return icons[status] || 'fas fa-question';      const updatedComment = {

    }        ...comment,

        completed: !comment.completed

    getStatusText(status) {      };

        const texts = {

            'pending': 'Pendiente',      const response = await docuFlowAPI.comments.update(commentId, updatedComment);

            'in-progress': 'En Progreso',      

            'completed': 'Completado'      if (response.success) {

        };        showNotification(

        return texts[status] || status;          `Tarea marcada como ${!comment.completed ? 'completada' : 'pendiente'}`, 

    }          'success'

        );

    getPriorityColor(priority) {        await this.loadComments();

        const colors = {      }

            'low': 'success',

            'medium': 'warning',    } catch (error) {

            'high': 'danger',      console.error('Error actualizando tarea:', error);

            'urgent': 'dark'      showNotification('Error actualizando tarea', 'error');

        };    }

        return colors[priority] || 'secondary';  }

    }

  async deleteComment(commentId) {

    getPriorityText(priority) {    const comment = this.comments.find(c => c.id === commentId);

        const texts = {    if (!comment) return;

            'low': 'Baja',

            'medium': 'Media',    if (!this.canEditComment(comment)) {

            'high': 'Alta',      showNotification('No tienes permisos para eliminar este comentario', 'error');

            'urgent': 'Urgente'      return;

        };    }

        return texts[priority] || priority;

    }    const type = comment.type === 'task' ? 'tarea' : 'comentario';

    if (!confirm(`¿Estás seguro de eliminar este ${type}?`)) return;

    formatDate(dateString) {

        const date = new Date(dateString);    try {

        return date.toLocaleDateString('es-ES', {      const response = await docuFlowAPI.comments.delete(commentId);

            day: '2-digit',      

            month: '2-digit',      if (response.success) {

            year: 'numeric',        showNotification(`${type.charAt(0).toUpperCase() + type.slice(1)} eliminado`, 'success');

            hour: '2-digit',        await this.loadComments();

            minute: '2-digit'      }

        });

    }    } catch (error) {

      console.error('Error eliminando comentario:', error);

    showNotification(message, type = 'info') {      showNotification('Error eliminando comentario', 'error');

        const notification = document.createElement('div');    }

        notification.className = `alert alert-${type} alert-dismissible fade show position-fixed`;  }

        notification.style.cssText = 'top: 20px; right: 20px; z-index: 9999; min-width: 300px;';

        notification.innerHTML = `  editComment(commentId) {

            ${message}    const comment = this.comments.find(c => c.id === commentId);

            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>    if (!comment || !this.canEditComment(comment)) return;

        `;

            // Prellenar el formulario

        document.body.appendChild(notification);    document.getElementById('commentContent').value = comment.content;

            document.getElementById('commentType').value = comment.type;

        setTimeout(() => {    

            notification.remove();    if (comment.type === 'task') {

        }, 5000);      this.toggleTaskFields('task');

    }      if (document.getElementById('taskPriority')) {

}        document.getElementById('taskPriority').value = comment.priority || 'medium';

      }

let commentsController;      if (document.getElementById('taskDueDate') && comment.dueDate) {

document.addEventListener('DOMContentLoaded', () => {        document.getElementById('taskDueDate').value = comment.dueDate.split('T')[0];

    commentsController = new CommentsController();      }

});    }

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