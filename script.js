// script.js (para login)

document.getElementById('loginForm').addEventListener('submit', async function(event) {
    event.preventDefault();

    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    try {
        const response = await fetch('https://touched-included-elephant.ngrok-free.app/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        if (response.ok) {
            const data = await response.json();
            localStorage.setItem('token', data.token); // Guardamos el JWT

            // Redirigir a upload.html
            window.location.href = 'upload.html';
        } else {
            document.getElementById('error-message').textContent = 'Credenciales incorrectas';
            document.getElementById('error-message').style.display = 'block';
        }
    } catch (error) {
        console.error("Error en la conexión:", error);
        alert("No se pudo conectar con el servidor.");
    }
});
