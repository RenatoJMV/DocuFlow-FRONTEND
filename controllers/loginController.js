import { login } from "../services/apiService.js";
import { mostrarError } from "../utils/uiHelpers.js";

document.getElementById("loginForm").addEventListener("submit", async (event) => {
    event.preventDefault();

    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;

    try {
        const data = await login(username, password);
        localStorage.setItem("token", data.token);
        window.location.href = "upload.html";
    } catch (error) {
        mostrarError("error-message", error.message);
    }
});
