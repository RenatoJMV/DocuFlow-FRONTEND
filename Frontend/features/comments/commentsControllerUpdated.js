import { docuFlowAPI } from '../../shared/services/apiClient.js';
import { initializeNavbar, showNotification, formatDate } from '../../shared/utils/uiHelpers.js';

class CommentsController {
  constructor() {
    this.currentDocumentId = null;
    this.comments = [];
    this.currentUser = JSON.parse(localStorage.getItem('user') || '{}');
    
    this.initializeComponents();
    this.setupEventListeners();
    this.loadInitialData();
  }

  initializeComponents() {
    initializeNavbar('comments');
    this.setupFormValidation();
  }

  setupFormValidation() {
    const form = document.getElementById('commentForm');
    if (form) {
      form.addEventListener('submit', this.handleSubmit.bind(this));
    }
  }

  setupEventListeners() {
    // Selector de documento
    const documentSelect = document.getElementById('documentSelect');
    if (documentSelect) {
      documentSelect.addEventListener('change', (e) => {
        this.currentDocumentId = e.target.value;
        if (this.currentDocumentId) {
          this.loadComments(this.currentDocumentId);
        } else {
          this.clearComments();
        }
      });
    }

    // Botón de refrescar
    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
        if (this.currentDocumentId) {
          this.loadComments(this.currentDocumentId);
        }
      });
    }

    // Setup comentario form
    this.setupCommentForm();
  }

  setupCommentForm() {
    const commentText = document.getElementById('commentText');
    const submitBtn = document.getElementById('submitCommentBtn');
    
    if (commentText && submitBtn) {
      commentText.addEventListener('input', () => {
        const hasText = commentText.value.trim().length > 0;
        const hasDocument = this.currentDocumentId !== null;
        submitBtn.disabled = !(hasText && hasDocument);
      });
    }
  }

  async loadInitialData() {
    try {
      await this.loadDocuments();
      this.updateStats();
    } catch (error) {
      console.error('Error loading initial data:', error);
      showNotification('Error al cargar datos iniciales', 'error');
    }
  }

  async loadDocuments() {
    try {
      const files = await docuFlowAPI.files.getAll();
      this.populateDocumentSelect(files.data || files || []);
    } catch (error) {
      console.error('Error loading documents:', error);
      showNotification('Error al cargar documentos', 'error');
      // Cargar datos demo en caso de error
      this.populateDocumentSelect([
        { id: 1, title: 'Documento Demo 1', fileName: 'demo1.pdf' },
        { id: 2, title: 'Documento Demo 2', fileName: 'demo2.pdf' }
      ]);
    }
  }

  populateDocumentSelect(documents) {
    const select = document.getElementById('documentSelect');
    if (!select) return;

    select.innerHTML = '<option value="">Selecciona un documento...</option>';
    
    documents.forEach(doc => {
      const option = document.createElement('option');
      option.value = doc.id;
      option.textContent = doc.title || doc.fileName || `Documento ${doc.id}`;
      select.appendChild(option);
    });
  }

  async loadComments(documentId) {
    try {
      this.showLoading(true);
      const comments = await docuFlowAPI.comments.getByDocument(documentId);
      this.comments = comments.data || comments || [];
      this.renderComments();
      this.updateCommentsCount();
    } catch (error) {
      console.error('Error loading comments:', error);
      showNotification('Error al cargar comentarios', 'error');
      // Cargar comentarios demo
      this.loadDemoComments();
    } finally {
      this.showLoading(false);
    }
  }

  loadDemoComments() {
    this.comments = [
      {
        id: 1,
        content: 'Este es un comentario de ejemplo para mostrar la funcionalidad.',
        author: { name: 'Usuario Demo', email: 'demo@example.com' },
        createdAt: new Date().toISOString(),
        documentId: this.currentDocumentId
      },
      {
        id: 2,
        content: 'Otro comentario de prueba con más contenido para ver cómo se renderiza.',
        author: { name: 'Admin Demo', email: 'admin@example.com' },
        createdAt: new Date(Date.now() - 3600000).toISOString(),
        documentId: this.currentDocumentId
      }
    ];
    this.renderComments();
    this.updateCommentsCount();
  }

  renderComments() {
    const container = document.getElementById('commentsContainer');
    if (!container) return;

    if (this.comments.length === 0) {
      container.innerHTML = `
        <div class="text-center text-muted py-4">
          <i class="bi bi-chat-dots fs-1 mb-3"></i>
          <p>No hay comentarios para este documento.</p>
          <small>Sé el primero en agregar un comentario.</small>
        </div>
      `;
      return;
    }

    container.innerHTML = this.comments.map(comment => this.renderComment(comment)).join('');
    this.setupCommentActions();
  }

  renderComment(comment) {
    const isOwner = comment.author?.email === this.currentUser.email || 
                   comment.authorId === this.currentUser.id;
    
    return `
      <div class="comment-item mb-3" data-comment-id="${comment.id}">
        <div class="card">
          <div class="card-body">
            <div class="d-flex justify-content-between align-items-start mb-2">
              <div class="comment-author">
                <h6 class="mb-0">${comment.author?.name || 'Usuario Anónimo'}</h6>
                <small class="text-muted">${formatDate(comment.createdAt)}</small>
              </div>
              ${isOwner ? `
                <div class="comment-actions">
                  <button class="btn btn-sm btn-outline-primary edit-comment-btn" 
                          data-comment-id="${comment.id}" title="Editar">
                    <i class="bi bi-pencil"></i>
                  </button>
                  <button class="btn btn-sm btn-outline-danger delete-comment-btn" 
                          data-comment-id="${comment.id}" title="Eliminar">
                    <i class="bi bi-trash"></i>
                  </button>
                </div>
              ` : ''}
            </div>
            <div class="comment-content">
              <p class="mb-0">${this.escapeHtml(comment.content)}</p>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  setupCommentActions() {
    // Botones de editar
    document.querySelectorAll('.edit-comment-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const commentId = e.target.closest('[data-comment-id]').dataset.commentId;
        this.editComment(commentId);
      });
    });

    // Botones de eliminar
    document.querySelectorAll('.delete-comment-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const commentId = e.target.closest('[data-comment-id]').dataset.commentId;
        this.deleteComment(commentId);
      });
    });
  }

  async handleSubmit(e) {
    e.preventDefault();
    
    const commentText = document.getElementById('commentText');
    const content = commentText.value.trim();
    
    if (!content || !this.currentDocumentId) {
      showNotification('Por favor, escribe un comentario y selecciona un documento', 'warning');
      return;
    }

    try {
      this.setSubmitLoading(true);
      
      const commentData = {
        content: content,
        documentId: this.currentDocumentId,
        authorId: this.currentUser.id
      };

      await docuFlowAPI.comments.create(commentData);
      
      commentText.value = '';
      showNotification('Comentario agregado exitosamente', 'success');
      
      // Recargar comentarios
      await this.loadComments(this.currentDocumentId);
      
    } catch (error) {
      console.error('Error creating comment:', error);
      showNotification('Error al crear comentario', 'error');
    } finally {
      this.setSubmitLoading(false);
    }
  }

  async editComment(commentId) {
    const comment = this.comments.find(c => c.id == commentId);
    if (!comment) return;

    const newContent = prompt('Editar comentario:', comment.content);
    if (!newContent || newContent.trim() === comment.content) return;

    try {
      await docuFlowAPI.comments.update(commentId, { content: newContent.trim() });
      showNotification('Comentario actualizado', 'success');
      await this.loadComments(this.currentDocumentId);
    } catch (error) {
      console.error('Error updating comment:', error);
      showNotification('Error al actualizar comentario', 'error');
    }
  }

  async deleteComment(commentId) {
    if (!confirm('¿Estás seguro de que deseas eliminar este comentario?')) return;

    try {
      await docuFlowAPI.comments.delete(commentId);
      showNotification('Comentario eliminado', 'success');
      await this.loadComments(this.currentDocumentId);
    } catch (error) {
      console.error('Error deleting comment:', error);
      showNotification('Error al eliminar comentario', 'error');
    }
  }

  clearComments() {
    const container = document.getElementById('commentsContainer');
    if (container) {
      container.innerHTML = `
        <div class="text-center text-muted py-4">
          <i class="bi bi-file-text fs-1 mb-3"></i>
          <p>Selecciona un documento para ver sus comentarios.</p>
        </div>
      `;
    }
    this.updateCommentsCount();
  }

  updateCommentsCount() {
    const countElement = document.getElementById('commentsCount');
    if (countElement) {
      countElement.textContent = this.comments.length;
    }
  }

  updateStats() {
    const statsContainer = document.querySelector('.stats-container');
    if (statsContainer) {
      statsContainer.innerHTML = `
        <div class="col-md-4">
          <div class="card text-center">
            <div class="card-body">
              <i class="bi bi-chat-dots fs-1 text-primary mb-2"></i>
              <h5 class="card-title">Total Comentarios</h5>
              <h3 class="text-primary" id="totalComments">${this.comments.length}</h3>
            </div>
          </div>
        </div>
        <div class="col-md-4">
          <div class="card text-center">
            <div class="card-body">
              <i class="bi bi-file-text fs-1 text-success mb-2"></i>
              <h5 class="card-title">Documento Actual</h5>
              <h3 class="text-success">${this.currentDocumentId ? '1' : '0'}</h3>
            </div>
          </div>
        </div>
        <div class="col-md-4">
          <div class="card text-center">
            <div class="card-body">
              <i class="bi bi-person fs-1 text-info mb-2"></i>
              <h5 class="card-title">Usuario Activo</h5>
              <h3 class="text-info">${this.currentUser.name || 'Anónimo'}</h3>
            </div>
          </div>
        </div>
      `;
    }
  }

  setSubmitLoading(isLoading) {
    const submitBtn = document.getElementById('submitCommentBtn');
    if (submitBtn) {
      submitBtn.disabled = isLoading;
      submitBtn.innerHTML = isLoading 
        ? '<span class="spinner-border spinner-border-sm me-2"></span>Enviando...' 
        : 'Agregar Comentario';
    }
  }

  showLoading(show) {
    const container = document.getElementById('commentsContainer');
    if (show && container) {
      container.innerHTML = `
        <div class="text-center py-4">
          <div class="spinner-border text-primary" role="status">
            <span class="visually-hidden">Cargando...</span>
          </div>
          <p class="mt-2">Cargando comentarios...</p>
        </div>
      `;
    }
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Inicializar controlador cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
  new CommentsController();
});

export default CommentsController;