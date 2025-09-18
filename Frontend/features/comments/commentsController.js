
import {
	apiGetCommentsByDocument,
	apiCreateComment,
	apiEditComment,
	apiAssignUsersToComment,
	apiDeleteComment
} from '../../services/commentService.js';

const commentsSection = document.getElementById('commentsSection');
const newCommentForm = document.getElementById('newCommentForm');
const commentsMsg = document.getElementById('commentsMsg');

// Utilidad para mostrar mensajes
function mostrarMensaje(msg, error = false) {
	commentsMsg.textContent = msg;
	commentsMsg.style.color = error ? '#d32f2f' : '#388e3c';
	setTimeout(() => { commentsMsg.textContent = ''; }, 3000);
}

// Renderizar comentarios/tareas
function renderizarComentarios(comments) {
	if (!comments.length) {
		commentsSection.innerHTML = '<p>No hay comentarios ni tareas para este documento.</p>';
		return;
	}
	commentsSection.innerHTML = comments.map(c => `
		<div class="comment-card">
			<div class="comment-header">
				<span class="comment-author">${c.author}</span>
				<span class="comment-date">${c.createdAt ? new Date(c.createdAt).toLocaleString() : ''}</span>
			</div>
			<div class="comment-content">${c.content}</div>
			<div class="comment-meta">
				<span class="badge ${c.isTask ? 'bg-warning text-dark' : 'bg-info text-dark'}">
					${c.isTask ? 'Tarea' : 'Comentario'}
				</span>
				${c.assignees && c.assignees.length ? `<span class="ms-2">Asignados: ${c.assignees.join(', ')}</span>` : ''}
				${c.updatedAt ? `<span class="ms-2 text-muted">Editado: ${new Date(c.updatedAt).toLocaleString()}</span>` : ''}
			</div>
			<div class="comment-actions mt-2">
				<button class="btn btn-sm btn-outline-primary" onclick="editarComentarioUI(${c.id}, '${c.content.replace(/'/g, "\\'")}', ${c.isTask}, '${c.assignees.join(',')}', ${c.documentId})">Editar</button>
				<button class="btn btn-sm btn-outline-danger" onclick="eliminarComentarioUI(${c.id}, ${c.documentId})">Eliminar</button>
			</div>
		</div>
	`).join('');
}

// Cargar comentarios/tareas por documento
async function cargarComentarios(documentId) {
	const { success, comments } = await apiGetCommentsByDocument(documentId);
	if (success) {
		renderizarComentarios(comments);
	} else {
		mostrarMensaje('No se pudieron cargar los comentarios.', true);
	}
}

// Manejar envío de nuevo comentario/tarea
if (newCommentForm) {
	newCommentForm.addEventListener('submit', async (e) => {
		e.preventDefault();
		const content = document.getElementById('commentContent').value.trim();
		const isTask = document.getElementById('isTask').checked;
		const assignees = document.getElementById('assignees').value.split(',').map(s => s.trim()).filter(Boolean);
		const documentId = Number(document.getElementById('documentId').value);
		if (!content || !documentId) {
			mostrarMensaje('Completa el contenido y el ID de documento.', true);
			return;
		}
		const { success, comment, error } = await apiCreateComment({ content, isTask, assignees, documentId });
		if (success) {
			mostrarMensaje('Comentario/tarea creado.');
			newCommentForm.reset();
			cargarComentarios(documentId);
		} else {
			mostrarMensaje(error || 'Error al crear comentario/tarea.', true);
		}
	});
}

// Funciones globales para editar/eliminar (puedes modularizar si lo prefieres)
window.editarComentarioUI = async function(id, content, isTask, assignees, documentId) {
	// Simple prompt, puedes reemplazar por modal bonito
	const nuevoContenido = prompt('Editar comentario/tarea:', content);
	if (nuevoContenido === null) return;
	const nuevaAsignacion = prompt('Asignados (separados por coma):', assignees);
	const nuevosAssignees = nuevaAsignacion ? nuevaAsignacion.split(',').map(s => s.trim()).filter(Boolean) : [];
	const esTarea = confirm('¿Es tarea? (Aceptar = Sí, Cancelar = No)');
	const { success, error } = await apiEditComment(id, {
		content: nuevoContenido,
		isTask: esTarea,
		assignees: nuevosAssignees,
		documentId
	});
	if (success) {
		mostrarMensaje('Comentario/tarea editado.');
		cargarComentarios(documentId);
	} else {
		mostrarMensaje(error || 'Error al editar.', true);
	}
}

window.eliminarComentarioUI = async function(id, documentId) {
	if (!confirm('¿Eliminar este comentario/tarea?')) return;
	const { success } = await apiDeleteComment(id);
	if (success) {
		mostrarMensaje('Eliminado.');
		cargarComentarios(documentId);
	} else {
		mostrarMensaje('Error al eliminar.', true);
	}
}

// Cargar comentarios iniciales si hay un documento seleccionado
const docIdInput = document.getElementById('documentId');
if (docIdInput) {
	docIdInput.addEventListener('change', (e) => {
		const val = Number(e.target.value);
		if (val) cargarComentarios(val);
	});
	// Si ya hay valor, cargar al inicio
	if (docIdInput.value) cargarComentarios(Number(docIdInput.value));
}
