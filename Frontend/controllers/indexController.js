import { login } from '../services/apiService.js';
const form = document.getElementById('loginForm');
const errorDiv = document.getElementById('error-message');
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  errorDiv.style.display = 'none';
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;
  const result = await login(username, password);
  if (result.success) {
    window.location.href = 'dashboard.html';
  } else {
    errorDiv.textContent = result.error || 'Credenciales inválidas';
    errorDiv.style.display = 'block';
  }
});
