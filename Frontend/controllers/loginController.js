import { login } from "../services/apiService.js";
import { showError } from "../utils/uiHelpers.js";

document.getElementById("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const username = document.getElementById("username").value;
  const password = document.getElementById("password").value;

  const result = await login(username, password);

  if (result.success) {
    window.location.href = "upload.html"; // redirigir si login OK
  } else {
    showError("error-message", result.error);
  }
});
