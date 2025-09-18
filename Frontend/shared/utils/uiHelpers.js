// utils/uiHelpers.js
export function showSuccess(elementId, message) {
  const el = document.getElementById(elementId);
  if (el) {
    el.textContent = message;
    el.style.display = "block";
    el.classList.remove("alert-danger");
    el.classList.add("alert-success");
  }
}

export function showError(elementId, message) {
  const el = document.getElementById(elementId);
  if (el) {
    el.textContent = message;
    el.style.display = "block";
    el.classList.remove("alert-success");
    el.classList.add("alert-danger");
  }
}
