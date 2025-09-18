import { BACKEND_URL } from './config.js';

// 🔹 Obtener comentarios/tareas por documento
export async function apiGetCommentsByDocument(documentId) {
  const token = localStorage.getItem("token");
  if (!token) return { success: false, comments: [] };
  try {
    const response = await fetch(`${BACKEND_URL}/api/comments/document/${documentId}`, {
      method: "GET",
      headers: { "Authorization": `Bearer ${token}` }
    });
    const data = await response.json().catch(() => null);
    if (response.ok && data) {
      return { success: true, comments: Array.isArray(data) ? data : [] };
    } else {
      return { success: false, comments: [], error: data?.error };
    }
  } catch {
    return { success: false, comments: [] };
  }
}

// 🔹 Crear comentario/tarea
export async function apiCreateComment(comment) {
  const token = localStorage.getItem("token");
  if (!token) return { success: false };
  try {
    const response = await fetch(`${BACKEND_URL}/api/comments`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(comment)
    });
    const data = await response.json().catch(() => null);
    return response.ok ? { success: true, comment: data } : { success: false, error: data?.error };
  } catch {
    return { success: false };
  }
}

// 🔹 Editar comentario/tarea
export async function apiEditComment(id, comment) {
  const token = localStorage.getItem("token");
  if (!token) return { success: false };
  try {
    const response = await fetch(`${BACKEND_URL}/api/comments/${id}`, {
      method: "PUT",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(comment)
    });
    const data = await response.json().catch(() => null);
    return response.ok ? { success: true, comment: data } : { success: false, error: data?.error };
  } catch {
    return { success: false };
  }
}

// 🔹 Asignar usuarios a comentario/tarea
export async function apiAssignUsersToComment(id, assignees) {
  const token = localStorage.getItem("token");
  if (!token) return { success: false };
  try {
    const response = await fetch(`${BACKEND_URL}/api/comments/${id}/assign`, {
      method: "PUT",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(assignees)
    });
    const data = await response.json().catch(() => null);
    return response.ok ? { success: true, comment: data } : { success: false, error: data?.error };
  } catch {
    return { success: false };
  }
}

// 🔹 Eliminar comentario/tarea
export async function apiDeleteComment(id) {
  const token = localStorage.getItem("token");
  if (!token) return { success: false };
  try {
    const response = await fetch(`${BACKEND_URL}/api/comments/${id}`, {
      method: "DELETE",
      headers: { "Authorization": `Bearer ${token}` }
    });
    return response.ok ? { success: true } : { success: false };
  } catch {
    return { success: false };
  }
}
