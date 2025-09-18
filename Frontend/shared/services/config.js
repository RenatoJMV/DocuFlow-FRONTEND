export const BACKEND_URL =
  ["localhost", "127.0.0.1", "0.0.0.0"].includes(window.location.hostname)
    ? "http://localhost:8080"
    : "https://docuflow-backend.onrender.com";