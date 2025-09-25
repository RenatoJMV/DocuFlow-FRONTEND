import { login } from "../../shared/services/userService.js";
import { showError } from "../../shared/utils/uiHelpers.js";

document.getElementById("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const username = document.getElementById("username").value;
  const password = document.getElementById("password").value;

  const result = await login(username, password);

  if (result.success) {
    window.location.href = "../dashboard/dashboard.html"; // redirigir si login OK
  } else {
    showError("error-message", result.error);
  }
});
