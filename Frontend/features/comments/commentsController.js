import apiClient, { docuFlowAPI } from '../../shared/services/apiClient.js';
import { store } from '../../shared/services/store.js';
import { enforcePageAuth } from '../../shared/utils/authGuard.js';
import { initializeNavbar, showNotification, Pagination, FormValidator, formatFileSize, debounce } from '../../shared/utils/uiHelpers.js';

class CommentsController {
  constructor() {
    if (!enforcePageAuth({
      message: 'Inicia sesión para colaborar en comentarios y tareas.'
    })) {
      return;
    }

    this.comments = [];
    this.filteredComments = [];
    this.currentPage = 1;
    this.itemsPerPage = 10;
    this.currentFilter = 'all';
    this.pagination = null;
    this.validator = null;
    this.documents = [];
    this.documentsById = new Map();
    this.documentSearchInput = null;
    this.documentIdInput = null;
    this.documentSuggestionsContainer = null;
    this.documentSuggestions = [];
    this.activeSuggestionIndex = -1;
    this.debouncedDocumentSearch = debounce((query) => this.performDocumentSearch(query), 150);
    this.demoCommentsDetected = [];

    this.initializeComponents();
    this.setupEventListeners();
    this.loadDocuments();
    this.loadComments();
  }

  initializeComponents() {
    initializeNavbar('comments');
    this.setupFormValidation();
    this.setupDocumentSelector();
    this.toggleTaskFields(false);
    this.updateSubmitButton('comment');
    this.updateShowingCount();
    this.updateStats();
  }

  setupFormValidation() {
    this.validator = new FormValidator('newCommentForm');
    this.validator
      .addRule('commentContent', (value) => value && value.trim().length >= 5, 'El comentario debe tener al menos 5 caracteres')
      .addRule('documentSearch', () => {
        return Boolean(document.getElementById('documentId')?.value);
      }, 'Selecciona un documento válido de la lista');
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

  setupDocumentSelector() {
    this.documentSearchInput = document.getElementById('documentSearch');
    this.documentIdInput = document.getElementById('documentId');
    this.documentSuggestionsContainer = document.getElementById('documentSuggestions');

    if (!this.documentSearchInput || !this.documentIdInput || !this.documentSuggestionsContainer) {
      return;
    }

    this.documentSearchInput.addEventListener('input', (event) => {
      const value = event.target.value || '';
      this.clearDocumentSelection(false);
      this.debouncedDocumentSearch(value);
    });

    this.documentSearchInput.addEventListener('focus', () => {
      if (!this.documents.length) {
        this.debouncedDocumentSearch('');
        return;
      }

      if (!this.documentSearchInput.value) {
        this.renderDocumentSuggestions(this.documents.slice(0, 8));
      } else {
        this.performDocumentSearch(this.documentSearchInput.value);
      }
    });

    this.documentSearchInput.addEventListener('keydown', (event) => this.handleDocumentSuggestionKeydown(event));

    this.documentSearchInput.addEventListener('blur', () => {
      setTimeout(() => this.hideDocumentSuggestions(), 150);
    });

    this.documentSuggestionsContainer.addEventListener('mousedown', (event) => {
      const item = event.target.closest('.document-suggestion-item');
      if (!item) return;

      const docId = item.dataset.docId;
      this.selectDocumentById(docId);
    });
  }

  clearDocumentSelection(resetInput = true) {
    if (this.documentIdInput) {
      this.documentIdInput.value = '';
    }

    if (this.documentSearchInput && resetInput) {
      this.documentSearchInput.value = '';
    }

    if (this.documentSearchInput?.dataset?.selectedId) {
      delete this.documentSearchInput.dataset.selectedId;
    }

    this.activeSuggestionIndex = -1;
  }

  performDocumentSearch(query = '') {
    if (!Array.isArray(this.documents) || this.documents.length === 0) {
      return;
    }

    const normalized = query.trim().toLowerCase();
    let results = this.documents;

    if (normalized) {
      results = this.documents.filter((doc) => {
        return doc.searchText.includes(normalized) || String(doc.id).includes(normalized);
      });
    }

    this.renderDocumentSuggestions(results.slice(0, 10));
  }

  renderDocumentSuggestions(items = []) {
    if (!this.documentSuggestionsContainer) return;

    this.documentSuggestions = items;

    if (!items.length) {
      this.documentSuggestionsContainer.innerHTML = '<div class="px-3 py-2 text-muted small">No se encontraron documentos con ese criterio.</div>';
      this.documentSuggestionsContainer.classList.remove('d-none');
      this.activeSuggestionIndex = -1;
      return;
    }

    const list = document.createElement('ul');
    items.forEach((doc, index) => {
      const listItem = document.createElement('li');
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `document-suggestion-item${index === this.activeSuggestionIndex ? ' active' : ''}`;
      button.dataset.docId = doc.id;
      button.dataset.index = index;
      button.innerHTML = `
        <strong>${doc.displayName}</strong>
        <span>ID: ${doc.id}${doc.sizeLabel ? ` · ${doc.sizeLabel}` : ''}${doc.uploadedLabel ? ` · ${doc.uploadedLabel}` : ''}</span>
      `;
      listItem.appendChild(button);
      list.appendChild(listItem);
    });

    this.documentSuggestionsContainer.innerHTML = '';
    this.documentSuggestionsContainer.appendChild(list);
    this.documentSuggestionsContainer.classList.remove('d-none');
    this.activeSuggestionIndex = Math.min(this.activeSuggestionIndex, items.length - 1);
    this.highlightActiveSuggestion();
  }

  hideDocumentSuggestions() {
    if (!this.documentSuggestionsContainer) return;
    this.documentSuggestionsContainer.classList.add('d-none');
    this.documentSuggestionsContainer.innerHTML = '';
    this.activeSuggestionIndex = -1;
  }

  handleDocumentSuggestionKeydown(event) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      if ((!this.documentSuggestions || this.documentSuggestions.length === 0) && this.documents.length > 0) {
        this.performDocumentSearch(this.documentSearchInput?.value || '');
      }
    }

    if (!this.documentSuggestions || this.documentSuggestions.length === 0) {
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.moveActiveSuggestion(1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.moveActiveSuggestion(-1);
    } else if (event.key === 'Enter') {
      if (this.activeSuggestionIndex >= 0 && this.documentSuggestions[this.activeSuggestionIndex]) {
        event.preventDefault();
        const doc = this.documentSuggestions[this.activeSuggestionIndex];
        this.applyDocumentSelection(doc);
      }
    } else if (event.key === 'Escape') {
      this.hideDocumentSuggestions();
    }
  }

  moveActiveSuggestion(direction) {
    if (!this.documentSuggestions.length) return;

    const newIndex = this.activeSuggestionIndex + direction;
    if (newIndex < 0) {
      this.activeSuggestionIndex = this.documentSuggestions.length - 1;
    } else if (newIndex >= this.documentSuggestions.length) {
      this.activeSuggestionIndex = 0;
    } else {
      this.activeSuggestionIndex = newIndex;
    }

    this.highlightActiveSuggestion();
  }

  highlightActiveSuggestion() {
    if (!this.documentSuggestionsContainer) return;

    const buttons = this.documentSuggestionsContainer.querySelectorAll('.document-suggestion-item');
    buttons.forEach((button, index) => {
      if (index === this.activeSuggestionIndex) {
        button.classList.add('active');
        button.scrollIntoView({ block: 'nearest' });
      } else {
        button.classList.remove('active');
      }
    });
  }

  selectDocumentById(docId) {
    if (!docId) return;

    const documentData = this.documentsById.get(String(docId))
      || this.documents.find((doc) => String(doc.id) === String(docId));

    if (documentData) {
      this.applyDocumentSelection(documentData);
    }
  }

  applyDocumentSelection(documentData) {
    if (!documentData) return;

    if (this.documentIdInput) {
      this.documentIdInput.value = documentData.id;
    }

    if (this.documentSearchInput) {
      this.documentSearchInput.value = `${documentData.displayName} (ID: ${documentData.id})`;
      this.documentSearchInput.dataset.selectedId = String(documentData.id);
    }

    if (this.validator && this.documentSearchInput) {
      this.validator.clearFieldError(this.documentSearchInput);
    }

    this.hideDocumentSuggestions();
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

    this.removeDemoCommentsBtn = document.getElementById('removeDemoComments');
    if (this.removeDemoCommentsBtn) {
      this.removeDemoCommentsBtn.addEventListener('click', () => this.cleanupDemoComments());
    }

    this.updateDemoCleanupState();
  }

  async loadDocuments() {
    try {
      let documents = [];
      let recent = [];

      if (typeof docuFlowAPI.files.getRecent === 'function') {
        try {
          recent = await docuFlowAPI.files.getRecent(50);
          documents = this.extractArray(recent, ['files', 'data', 'content']);
        } catch (error) {
          console.warn('No se pudo obtener la lista de archivos recientes desde el backend. Se usará un fallback.', error);
          if (error?.status !== 404) {
            showNotification('No pudimos cargar la lista de documentos recientes. Intentaremos con todos los archivos.', 'info');
          }
        }
      }

      if (!documents || documents.length === 0) {
        try {
          const fallback = await docuFlowAPI.files.getAll?.();
          documents = this.extractArray(fallback, ['files', 'data', 'content']);
        } catch (fallbackError) {
          console.error('Error al obtener el listado completo de archivos para el selector.', fallbackError);
          documents = [];
        }
      }

      if (!documents || documents.length === 0) {
        const stored = store.getState?.('files') || store.getState?.()?.files || [];
        documents = Array.isArray(stored) ? stored : [];
      }

      const normalized = (documents || [])
        .map((doc) => this.normalizeDocument(doc))
        .filter(Boolean)
        .sort((a, b) => (b.uploadedAtValue ?? 0) - (a.uploadedAtValue ?? 0));

      this.documents = normalized;
      this.documentsById = new Map(normalized.map((doc) => [String(doc.id), doc]));

      if (this.documentSearchInput && document.activeElement === this.documentSearchInput) {
        this.renderDocumentSuggestions(normalized.slice(0, 8));
      } else {
        this.hideDocumentSuggestions();
      }

      if (this.documentSearchInput && this.documentSearchInput.value) {
        this.performDocumentSearch(this.documentSearchInput.value);
      }
    } catch (error) {
      console.error('Error al cargar documentos para el selector:', error);
      showNotification('No se pudieron cargar los documentos recientes. Intenta actualizar más tarde.', 'warning');
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
      if (error?.message === 'documento_invalido') {
        showNotification('Selecciona un documento válido de la lista antes de guardar.', 'warning');
        if (this.validator && this.documentSearchInput) {
          this.validator.showFieldError(this.documentSearchInput, 'Selecciona un documento válido de la lista');
          this.documentSearchInput.focus();
        }
      } else {
        showNotification('Error al crear el comentario', 'error');
      }
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalText;
    }
  }

  getFormData() {
    const commentType = document.querySelector('input[name="commentType"]:checked')?.value || 'comment';
    const documentIdRaw = this.documentIdInput?.value || document.getElementById('documentId')?.value || '';
    const documentId = documentIdRaw ? Number(documentIdRaw) : null;

    if (!Number.isFinite(documentId)) {
      throw new Error('documento_invalido');
    }

    const formData = {
      content: document.getElementById('commentContent')?.value.trim() || '',
      type: commentType,
      documentId
    };

    const selectedDocument = this.documentsById.get(String(documentId));
    if (selectedDocument?.filename) {
      formData.documentName = selectedDocument.filename;
    }

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
        const normalizedComments = comments.map((comment) => this.normalizeComment(comment));
        const { sanitized, removed } = this.stripDemoComments(normalizedComments);

        this.comments = sanitized;
        this.demoCommentsDetected = removed;

        if (removed.length > 0) {
          showNotification(`Se ocultaron ${removed.length} comentarios de demostración heredados.`, 'info', 2500);
        }

        if (!silent) {
          showNotification(`${this.comments.length} comentarios cargados del servidor`, 'success', 2000);
        }
      } else {
        this.comments = [];
        this.demoCommentsDetected = [];
        if (!silent) {
          showNotification('No se encontraron comentarios en el servidor', 'info', 2000);
        }
      }
    } catch (error) {
      console.error('❌ Error cargando comentarios del backend:', error);
      if (!silent) {
        showNotification('No se pudieron cargar los comentarios. Verifique la API.', 'warning');
      }
      this.comments = [];
      this.demoCommentsDetected = [];
    }

    store.setComments(this.comments);
    this.filterComments();
    this.updateStats();
    this.updateDemoCleanupState();
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

  normalizeDocument(raw = {}) {
    if (!raw) return null;

    const id = raw.id ?? raw.documentId ?? raw.fileId ?? raw.uuid ?? raw.identifier;
    if (!id) {
      return null;
    }

    const filename = raw.filename || raw.name || raw.title || `Documento ${id}`;
    const uploader = raw.uploader || raw.uploadedBy || raw.owner || raw.createdBy || raw.user || 'Sin autor';
    const rawDate = raw.uploadDate
      || raw.uploadedAt
      || raw.createdAt
      || raw.timestamp
      || raw.lastModified
      || raw.creationDate
      || raw.updatedAt;

    const parsedDate = this.parseDateValue(rawDate);
    const size = raw.size ?? raw.fileSize ?? raw.bytes ?? raw.length ?? 0;

    return {
      id,
      displayName: filename,
      filename,
      uploader,
      uploadedAt: parsedDate ? parsedDate.toISOString() : null,
      uploadedAtValue: parsedDate ? parsedDate.getTime() : 0,
      size,
      sizeLabel: typeof size === 'number' ? formatFileSize(size) : null,
      uploadedLabel: parsedDate ? this.formatDate(parsedDate.toISOString()) : null,
      searchText: `${filename} ${uploader} ${id}`.toLowerCase()
    };
  }

  parseDateValue(dateValue) {
    if (!dateValue && dateValue !== 0) return null;

    if (dateValue instanceof Date) {
      return Number.isNaN(dateValue.getTime()) ? null : dateValue;
    }

    if (typeof dateValue === 'number') {
      const normalizedNumber = dateValue < 1e12 ? dateValue * 1000 : dateValue;
      const dateFromNumber = new Date(normalizedNumber);
      return Number.isNaN(dateFromNumber.getTime()) ? null : dateFromNumber;
    }

    if (typeof dateValue === 'string') {
      const trimmed = dateValue.trim();
      if (!trimmed) return null;

      const directDate = new Date(trimmed);
      if (!Number.isNaN(directDate.getTime())) {
        return directDate;
      }

      const numeric = Number(trimmed);
      if (!Number.isNaN(numeric)) {
        return this.parseDateValue(numeric);
      }
    }

    return null;
  }

  normalizeComment(raw = {}) {
    const generatedId = `${Date.now()}-${Math.random()}`;
    const status = raw.status || (raw.resolved ? 'completed' : raw.state) || 'pending';
    const content = (raw.content || raw.text || 'Sin contenido').toString();
    const author = (raw.author || raw.user || raw.createdBy || 'Usuario desconocido').toString();
    const isDemo = this.isDemoComment(raw, content, author);
    return {
      id: raw.id ?? raw.commentId ?? generatedId,
      content,
      type: raw.type || (raw.isTask ? 'task' : 'comment'),
      author,
      createdAt: raw.createdAt || raw.timestamp || new Date().toISOString(),
      status,
      fileId: raw.fileId || null,
      priority: raw.priority || (status === 'completed' ? 'medium' : 'normal'),
      assignees: raw.assignees || raw.users || [],
      dueDate: raw.dueDate || raw.deadline || null,
      isDemo
    };
  }

  isDemoComment(raw = {}, content = '', author = '') {
    const flags = [raw.isDemo, raw.demo, raw.sample, raw.placeholder, raw.testData, raw.mock];
    if (flags.some((flag) => flag === true)) {
      return true;
    }

    const normalizedContent = content.toLowerCase();
    const normalizedAuthor = author.toLowerCase();
    const patterns = ['demo', 'prueba', 'sample', 'placeholder', 'lorem', 'ipsum', 'dummy', 'ejemplo'];

    if (patterns.some((pattern) => normalizedContent.includes(pattern))) {
      return true;
    }

    if (patterns.some((pattern) => normalizedAuthor.includes(pattern))) {
      return true;
    }

    if (Array.isArray(raw.assignees) && raw.assignees.some((assignee) => String(assignee).toLowerCase().includes('demo'))) {
      return true;
    }

    return false;
  }

  stripDemoComments(comments = []) {
    if (!Array.isArray(comments)) {
      return { sanitized: [], removed: [] };
    }

    const removed = [];
    const sanitized = comments.filter((comment) => {
      if (comment && (comment.isDemo || this.isDemoComment(comment, comment.content, comment.author))) {
        removed.push(comment);
        return false;
      }
      return true;
    });

    return { sanitized, removed };
  }

  updateDemoCleanupState() {
    if (!this.removeDemoCommentsBtn) return;

    const hasDemo = Array.isArray(this.demoCommentsDetected) && this.demoCommentsDetected.length > 0;
    this.removeDemoCommentsBtn.classList.toggle('d-none', !hasDemo);
    this.removeDemoCommentsBtn.disabled = !hasDemo;

    if (hasDemo) {
      this.removeDemoCommentsBtn.textContent = `Eliminar ${this.demoCommentsDetected.length} comentarios demo`;
    } else {
      this.removeDemoCommentsBtn.textContent = 'Eliminar comentarios demo';
    }
  }

  async cleanupDemoComments() {
    if (!Array.isArray(this.demoCommentsDetected) || this.demoCommentsDetected.length === 0) {
      showNotification('No hay comentarios demo para eliminar.', 'info');
      return;
    }

    const confirmed = confirm(`Se eliminarán ${this.demoCommentsDetected.length} comentarios de demostración. ¿Deseas continuar?`);
    if (!confirmed) {
      return;
    }

    const ids = this.demoCommentsDetected
      .map((comment) => comment?.id)
      .filter((id) => id !== null && id !== undefined);

    if (ids.length === 0) {
      showNotification('No se detectaron identificadores válidos para eliminar.', 'warning');
      return;
    }

    try {
      showNotification('Eliminando comentarios demo...', 'info');
      const results = await Promise.allSettled(ids.map((id) => docuFlowAPI.comments.delete(id)));

      const deletedCount = results.filter((result) => result.status === 'fulfilled').length;
      const failedCount = results.length - deletedCount;

      if (deletedCount > 0) {
        showNotification(`Se eliminaron ${deletedCount} comentarios demo.`, 'success');
      }

      if (failedCount > 0) {
        showNotification(`${failedCount} comentarios demo no pudieron eliminarse.`, 'warning');
      }

      this.demoCommentsDetected = [];
      await this.loadComments(true);
    } catch (error) {
      console.error('Error al eliminar comentarios demo:', error);
      showNotification('No fue posible eliminar todos los comentarios demo.', 'error');
    } finally {
      this.updateDemoCleanupState();
    }
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
