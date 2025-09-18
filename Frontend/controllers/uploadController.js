import { apiUploadFile, apiGetFiles, apiDownloadFile, apiDeleteFile } from "../services/fileService.js";
import { showSuccess, showError } from "../utils/uiHelpers.js";

document.addEventListener("DOMContentLoaded", async () => {
  await loadFiles();
});

document.getElementById('uploadForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const file = document.getElementById('fileInput').files[0];
  if (!file) return showError("error-message", "Selecciona un archivo");

  const result = await apiUploadFile(file);
  if (result.success) {
    showSuccess("success-message", result.mensaje);
    document.getElementById('fileInput').value = ""; // Limpiar input después de subir
    await loadFiles();
  } else {
    showError("error-message", result.error || "Error al subir archivo");
  }
});

// 🔹 Función para cargar y mostrar los archivos
async function loadFiles() {
  const result = await apiGetFiles();
  const tbody = document.querySelector("#filesTable tbody");
  tbody.innerHTML = "";

  const files = Array.isArray(result) ? result : (result.files || []);

  if (files.length > 0) {
    files.forEach(file => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${file.filename}</td>
        <td>${file.size ? (file.size / 1024).toFixed(2) + " KB" : "N/A"}</td>
        <td class="d-flex gap-2 justify-content-center">
          <button class="btn btn-outline-primary btn-sm btn-download d-flex align-items-center gap-1" data-id="${file.id}" data-filename="${file.filename}" title="Descargar">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" class="bi bi-download" viewBox="0 0 16 16"><path d="M.5 9.9a.5.5 0 0 1 .5.5v2.6a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.6a.5.5 0 0 1 1 0v2.6A2 2 0 0 1 14 15H2a2 2 0 0 1-2-2v-2.6a.5.5 0 0 1 .5-.5z"/><path d="M7.646 11.854a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 10.293V1.5a.5.5 0 0 0-1 0v8.793L5.354 8.146a.5.5 0 1 0-.708.708l3 3z"/></svg>
            Descargar
          </button>
          <button class="btn btn-outline-danger btn-sm d-flex align-items-center gap-1 btn-delete" data-id="${file.id}" title="Eliminar">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" class="bi bi-trash" viewBox="0 0 16 16"><path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5.5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6zm2 .5a.5.5 0 0 1 .5-.5.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6z"/><path fill-rule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1 0-2h3a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3a1 1 0 0 1 1 1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3a.5.5 0 0 0-.5.5V4h12v-.5a.5.5 0 0 0-.5-.5h-11z"/></svg>
            Eliminar
          </button>
        </td>
      `;
      tbody.appendChild(row);
    });

    // Evento para descargar
    document.querySelectorAll(".btn-download").forEach(btn => {
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute("data-id");
        const filename = btn.getAttribute("data-filename") || "archivo";
        btn.disabled = true;
        btn.textContent = "Descargando...";
  const result = await apiDownloadFile(id, filename);
        btn.disabled = false;
        btn.textContent = "Descargar";
        if (result.success) {
          const url = window.URL.createObjectURL(result.blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = result.filename || filename;
          document.body.appendChild(a);
          a.click();
          setTimeout(() => {
            window.URL.revokeObjectURL(url);
            a.remove();
          }, 100);
        } else {
          showError("error-message", result.error || "Error al descargar archivo");
        }
      });
    });

    // Eventos para eliminar
    document.querySelectorAll(".btn-delete").forEach(btn => {
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute("data-id");
        const del = await apiDeleteFile(id);
        if (del.success) {
          showSuccess("success-message", del.mensaje);
          await loadFiles();
        } else {
          showError("error-message", del.error || "Error al eliminar archivo");
        }
      });
    });
  } else {
    tbody.innerHTML = `<tr><td colspan="3">No hay archivos subidos</td></tr>`;
  }
}
