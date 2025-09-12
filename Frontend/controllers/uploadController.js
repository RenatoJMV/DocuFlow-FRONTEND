import { apiUpload, apiGetFiles, apiDeleteFile } from "../services/apiService.js";
import { showSuccess, showError } from "../utils/uiHelpers.js";

document.addEventListener("DOMContentLoaded", async () => {
  await loadFiles();
});

document.getElementById('uploadForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const file = document.getElementById('fileInput').files[0];
  if (!file) return showError("error-message", "Selecciona un archivo");

  const result = await apiUpload(file);
  if (result.success) {
    showSuccess("success-message", result.mensaje);
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
        <td>
          <a class="btn btn-success btn-sm" href="https://touched-included-elephant.ngrok-free.app/files/${file.id}/download" target="_blank">Descargar</a>
          <button class="btn btn-danger btn-sm" data-id="${file.id}">Eliminar</button>
        </td>
      `;
      tbody.appendChild(row);
    });

    // Eventos para eliminar
    document.querySelectorAll(".btn-danger").forEach(btn => {
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
