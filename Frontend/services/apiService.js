const BASE_URL = "https://docuflow-backend.onrender.com";

// 🔹 Subir archivo
export async function apiUpload(file) {
  const token = localStorage.getItem("token");
  if (!token) return { success: false, error: "Debes iniciar sesión primero." };

  const formData = new FormData();
  formData.append("file", file);

  try {
    const response = await fetch(`${BASE_URL}/upload`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${token}` },
      body: formData
    });

    const data = await response.json().catch(() => ({}));
    if (response.ok) return { success: true, ...data };
    return { success: false, error: data.error || "Error al subir archivo" };

  } catch (err) {
    console.error("Error en la conexión:", err);
    return { success: false, error: "No se pudo conectar con el servidor." };
  }
}

// 🔹 Listar archivos
export async function apiGetFiles() {
  const token = localStorage.getItem("token");
  if (!token) return { success: false, error: "Debes iniciar sesión primero.", files: [] };

  try {
    const response = await fetch(`${BASE_URL}/files`, {
      method: "GET",
      headers: { "Authorization": `Bearer ${token}` }
    });

    const data = await response.json().catch(() => null);

    if (response.ok && data) {
      // 👇 Aseguramos que siempre devuelva un array
      const files = Array.isArray(data) ? data : (data.files || []);
      return { success: true, files };
    } else {
      const error = data?.error || "Error desconocido al obtener archivos";
      return { success: false, files: [], error };
    }
  } catch (err) {
    console.error("Error al cargar archivos:", err);
    return { success: false, files: [], error: "No se pudo conectar con el servidor" };
  }
}

// 🔹 Eliminar archivo
export async function apiDeleteFile(id) {
  const token = localStorage.getItem("token");
  if (!token) return { success: false, error: "Debes iniciar sesión primero." };

  try {
    const response = await fetch(`${BASE_URL}/files/${id}`, {
      method: "DELETE",
      headers: { "Authorization": `Bearer ${token}` }
    });

    const data = await response.json().catch(() => ({}));
    if (response.ok) return { success: true, ...data };
    return { success: false, error: data.error || "No se pudo eliminar el archivo" };
  } catch (err) {
    console.error("Error al eliminar archivo:", err);
    return { success: false, error: "No se pudo conectar con el servidor." };
  }
}

// 🔑 Login
export async function login(username, password) {
  try {
    const response = await fetch(`${BASE_URL}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    });

    const data = await response.json().catch(() => null);

    if (response.ok && data?.token) {
      localStorage.setItem("token", data.token); // guarda el JWT
      return { success: true, token: data.token };
    } else {
      return { success: false, error: data?.error || "Credenciales inválidas" };
    }
  } catch (err) {
    console.error("Error en login:", err);
    return { success: false, error: "No se pudo conectar con el servidor" };
  }
}
