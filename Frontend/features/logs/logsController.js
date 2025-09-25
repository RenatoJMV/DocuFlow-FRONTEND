import { apiGetLogs } from '/shared/services/logService.js';

let allLogs = [];
let filteredLogs = [];
const logsPerPage = 20;
let currentPage = 1;

function renderLogsTable(logs) {
  const tbody = document.querySelector('#logs-table tbody');
  tbody.innerHTML = '';
  if (!logs.length) {
    tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">Sin registros</td></tr>';
    return;
  }
  logs.forEach(log => {
    tbody.innerHTML += `
      <tr>
        <td>${new Date(log.timestamp).toLocaleString()}</td>
        <td><span class="activity-badge">${log.action}</span></td>
        <td>${log.username}</td>
        <td>${log.documentId ?? '-'}</td>
      </tr>
    `;
  });
}

function renderPagination(total) {
  const totalPages = Math.ceil(total / logsPerPage);
  const container = document.getElementById('logs-pagination');
  container.innerHTML = '';
  if (totalPages <= 1) return;
  for (let i = 1; i <= totalPages; i++) {
    const btn = document.createElement('button');
    btn.className = 'btn btn-outline-primary btn-sm mx-1';
    btn.textContent = i;
    if (i === currentPage) btn.classList.add('active');
    btn.onclick = () => {
      currentPage = i;
      updateTable();
    };
    container.appendChild(btn);
  }
}

function updateTable() {
  const start = (currentPage - 1) * logsPerPage;
  const end = start + logsPerPage;
  renderLogsTable(filteredLogs.slice(start, end));
  renderPagination(filteredLogs.length);
}

function applyFilters() {
  const date = document.getElementById('filter-date').value;
  const user = document.getElementById('filter-user').value.trim().toLowerCase();
  const action = document.getElementById('filter-action').value;
  filteredLogs = allLogs.filter(log => {
    let match = true;
    if (date) match = match && log.timestamp.startsWith(date);
    if (user) match = match && log.username.toLowerCase().includes(user);
    if (action) match = match && log.action === action;
    return match;
  });
  currentPage = 1;
  updateTable();
}

document.getElementById('filter-date').addEventListener('change', applyFilters);
document.getElementById('filter-user').addEventListener('input', applyFilters);
document.getElementById('filter-action').addEventListener('change', applyFilters);
document.getElementById('btn-clear-filters').addEventListener('click', () => {
  document.getElementById('filter-date').value = '';
  document.getElementById('filter-user').value = '';
  document.getElementById('filter-action').value = '';
  applyFilters();
});

document.getElementById('btn-download-log').addEventListener('click', () => {
  // Puedes implementar la descarga real del log diario aquí
  alert('Funcionalidad de descarga de log diario próximamente.');
});

async function loadLogs() {
  const res = await apiGetLogs();
  allLogs = res.logs || [];
  filteredLogs = allLogs;
  currentPage = 1;
  updateTable();
}

document.addEventListener('DOMContentLoaded', loadLogs);
