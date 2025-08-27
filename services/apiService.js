const API_URL = "https://touched-included-elephant.ngrok-free.app";

export async function login(username, password) {
    const response = await fetch(`${API_URL}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
    });

    if (!response.ok) {
        throw new Error("Credenciales inválidas");
    }

    return await response.json(); // Devuelve el token
}

export async function uploadFile(file, token) {
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch(`${API_URL}/upload`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` },
        body: formData
    });

    if (!response.ok) {
        throw new Error("Error al subir archivo");
    }

    return await response.json();
}
