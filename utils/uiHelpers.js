export function mostrarError(elementId, mensaje) {
    const el = document.getElementById(elementId);
    el.textContent = mensaje;
    el.style.display = "block";
}

export function mostrarExito(elementId, mensaje) {
    const el = document.getElementById(elementId);
    el.textContent = mensaje;
    el.style.display = "block";
}
