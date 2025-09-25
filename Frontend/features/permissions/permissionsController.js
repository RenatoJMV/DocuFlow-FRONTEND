import { apiGetUsers, apiGetRoles, apiGetUserPermissions, apiSetUserRole, apiSetUserPermissions } from "/shared/services/userService.js";

const userSelect = document.getElementById("user-select");
const roleSelect = document.getElementById("role-select");
const permissionsList = document.getElementById("permissions-list");
const saveBtn = document.getElementById("save-permissions");
const mensajeDiv = document.getElementById("permisos-mensaje");

let usuarios = [];
let roles = [];
const PERMISOS_DISPONIBLES = [
  { id: "descargar", nombre: "Descargar archivos" },
  { id: "eliminar", nombre: "Eliminar archivos" },
  { id: "comentar", nombre: "Comentar" },
  { id: "inhabilitado", nombre: "Inhabilitar acceso" }
];

async function cargarDatos() {
  const resUsers = await apiGetUsers();
  const resRoles = await apiGetRoles();
  usuarios = resUsers.users || [];
  roles = resRoles.roles || [];
  userSelect.innerHTML = usuarios.map(u => `<option value="${u.id}">${u.username}</option>`).join("");
  roleSelect.innerHTML = roles.map(r => `<option value="${r}">${r.charAt(0).toUpperCase() + r.slice(1)}</option>`).join("");
  if (usuarios.length) {
    userSelect.value = usuarios[0].id;
    cargarDatosUsuario(usuarios[0].id);
  }
}

userSelect.addEventListener("change", e => cargarDatosUsuario(e.target.value));
roleSelect.addEventListener("change", e => asignarRol(e.target.value));

async function cargarDatosUsuario(userId) {
  // Obtener usuario seleccionado
  const usuario = usuarios.find(u => u.id == userId);
  // Obtener rol actual
  if (usuario && usuario.role) {
    roleSelect.value = usuario.role;
  }
  // Obtener permisos actuales
  const resPerms = await apiGetUserPermissions(userId);
  const permisos = resPerms.permissions || [];
  // Renderizar checkboxes de permisos
  permissionsList.innerHTML = PERMISOS_DISPONIBLES.map(p =>
    `<div class='form-check'>
      <input class='form-check-input' type='checkbox' id='perm-${p.id}' value='${p.id}' ${permisos.includes(p.id) ? "checked" : ""}>
      <label class='form-check-label' for='perm-${p.id}'>${p.nombre}</label>
    </div>`
  ).join("");
}

async function asignarRol(role) {
  const userId = userSelect.value;
  const res = await apiSetUserRole(userId, role);
  if (res.success) {
    mensajeDiv.textContent = "Rol actualizado";
    mensajeDiv.classList.remove("d-none");
  } else {
    mensajeDiv.textContent = res.error || "Error al actualizar rol";
    mensajeDiv.classList.remove("d-none");
  }
}

async function guardarCambios() {
  const userId = userSelect.value;
  const permisosSeleccionados = Array.from(permissionsList.querySelectorAll("input:checked")).map(cb => cb.value);
  const res = await apiSetUserPermissions(userId, permisosSeleccionados);
  if (res.success) {
    mensajeDiv.textContent = "Permisos actualizados";
    mensajeDiv.classList.remove("d-none");
  } else {
    mensajeDiv.textContent = res.error || "Error al actualizar permisos";
    mensajeDiv.classList.remove("d-none");
  }
}

saveBtn.addEventListener("click", guardarCambios);

// Inicializar
cargarDatos();

