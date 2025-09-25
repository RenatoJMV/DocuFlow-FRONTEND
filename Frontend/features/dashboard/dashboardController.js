import { apiGetFiles } from '../../services/fileService.js';
import { apiGetUsers } from '../../services/userService.js';
import { apiGetDownloadsToday } from '../../services/dashboardService.js';
import { apiGetCommentsByDocument } from '../../services/commentService.js';
import { apiGetLogs } from '../../services/logService.js';
import { BACKEND_URL } from '../../shared/services/config.js';

// Obtener el total de comentarios
async function apiGetTotalComments() {
  const token = getToken();
  if (!token) return { success: false, count: 0 };
  try {
    const response = await fetch(`${BACKEND_URL}/api/comments/count`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (response.ok) {
      const count = await response.json();
      return { success: true, count };
    } else {
      return { success: false, count: 0 };
    }
  } catch {
    return { success: false, count: 0 };
  }
}

// Utilidad para obtener el token
function getToken() {
  return localStorage.getItem('token');
}
async function setupDocumentCommentCount() {
  // Obtener documentos
  const filesRes = await apiGetFiles();
  const files = filesRes.files || [];
  if (!files.length) return;

  const select = document.createElement('select');
  select.className = 'form-select form-select-sm d-inline-block';
  select.style.width = '220px';
  select.id = 'dashboard-doc-select';
  select.innerHTML = '<option value="">Selecciona un documento...</option>' +
    files.map(f => `<option value="${f.id}">${f.name || 'Documento ' + f.id}</option>`).join('');

  const span = document.createElement('span');
  span.id = 'dashboard-doc-comments-count';
  span.className = 'ms-2 text-primary';

  const label = document.createElement('label');
  label.textContent = 'Comentarios de documento:';
  label.className = 'ms-3';
  label.appendChild(select);
  label.appendChild(span);

  // Insertar debajo del widget de comentarios
  const widget = document.getElementById('widget-comments');
  if (widget && widget.parentElement) {
    widget.parentElement.appendChild(label);
  }

  select.addEventListener('change', async (e) => {
    const docId = Number(e.target.value);
    if (!docId) {
      span.textContent = '';
      return;
    }
    const { success, comments } = await apiGetCommentsByDocument(docId);
    span.textContent = success ? ` ${comments.length}` : ' error';
  });
}

async function loadDashboard() {
  const token = getToken();
  if (!token) {
    window.location.href = '../auth/login.html';
    return;
  }

  // Archivos subidos
  const filesRes = await apiGetFiles();
  document.getElementById('widget-files').textContent = filesRes.files?.length ?? 0;

  // Usuarios registrados
  const usersRes = await apiGetUsers();
  document.getElementById('widget-users').textContent = usersRes.users?.length ?? 0;

  // Comentarios (total)
  const commentsCountRes = await apiGetTotalComments();
  document.getElementById('widget-comments').textContent = commentsCountRes.count ?? 0;
  setupDocumentCommentCount();

  // Descargas de hoy
  const downloadsRes = await apiGetDownloadsToday();
  document.getElementById('widget-downloads').textContent = downloadsRes.count ?? 0;

  // Logs / Actividad reciente
  const logsRes = await apiGetLogs();
  const tbody = document.getElementById('activity-table');
  tbody.innerHTML = '';
  if (logsRes.logs && logsRes.logs.length > 0) {
    logsRes.logs.slice(0, 10).forEach(log => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${log.documentName || '-'}</td>
        <td><span class="activity-badge">${log.action}</span></td>
        <td>${log.username}</td>
        <td>${new Date(log.timestamp).toLocaleString()}</td>
      `;
      tbody.appendChild(tr);
    });
  } else {
    tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">Sin actividad reciente</td></tr>';
  }
}

document.addEventListener('DOMContentLoaded', loadDashboard);
