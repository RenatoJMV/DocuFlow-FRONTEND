// controllers/dashboardController.js
// Controlador para poblar el dashboard con datos reales desde el backend

import { apiGetFiles } from '../services/fileService.js';
import { apiGetUsers, apiGetDownloadsToday } from '../services/userService.js';
import { apiGetComments } from '../services/commentService.js';
import { apiGetLogs } from '../services/logService.js';

// Utilidad para obtener el token
function getToken() {
  return localStorage.getItem('token');
}

async function loadDashboard() {
  const token = getToken();
  if (!token) {
    window.location.href = 'index.html';
    return;
  }

  // Archivos subidos
  const filesRes = await apiGetFiles();
  document.getElementById('widget-files').textContent = filesRes.files?.length ?? 0;

  // Usuarios registrados
  const usersRes = await apiGetUsers();
  document.getElementById('widget-users').textContent = usersRes.users?.length ?? 0;

  // Comentarios (total)
  const commentsRes = await apiGetComments();
  document.getElementById('widget-comments').textContent = commentsRes.comments?.length ?? 0;

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
