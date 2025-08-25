// upload.js

document.getElementById('uploadForm').addEventListener('submit', async function(event) {
    event.preventDefault();

    const fileInput = document.getElementById('fileInput');
    const file = fileInput.files[0];
    const token = localStorage.getItem('token');

    if (!token) {
        alert("Debes iniciar sesión primero.");
        window.location.href = "index.html";
        return;
    }

    const formData = new FormData();
    formData.append("file", file);

    try {
        const response = await fetch('http://localhost:8080/upload', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: formData
        });

        if (response.ok) {
            const data = await response.json();
            document.getElementById('success-message').textContent = data.mensaje;
            document.getElementById('success-message').style.display = 'block';
        } else {
            const error = await response.json();
            document.getElementById('error-message').textContent = error.error || "Error al subir archivo";
            document.getElementById('error-message').style.display = 'block';
        }
    } catch (error) {
        console.error("Error en la conexión:", error);
        alert("No se pudo conectar con el servidor.");
    }
});
