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
        <td>
          <button class="btn btn-success btn-sm btn-download" data-id="${file.id}" data-filename="${file.filename}">Descargar</button>
          <button class="btn btn-danger btn-sm" data-id="${file.id}">Eliminar</button>
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
        const { apiDownloadFile } = await import("../services/apiService.js");
        const result = await apiDownloadFile(id);
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
