# Endpoints requeridos para la sección "Permisos" de DocuFlow

Este documento reúne los endpoints que el frontend espera consumir para gestionar usuarios, roles y permisos desde la pantalla `features/permissions/permissions.html`. Puedes compartirlo con el equipo/backend AI para asegurar que todos los servicios estén disponibles.

## 1. Usuarios

| Operación | Método y Ruta | Payload de Entrada | Respuesta esperada |
|-----------|---------------|--------------------|--------------------|
| Listar usuarios | `GET /api/users` | — | `200 OK` con un arreglo de usuarios (`[{ id, name, username, email, role, status, lastLogin, ... }]`)
| Crear usuario | `POST /auth/register` | `{ name, username?, email, password, role? }` | `201 Created` con `{ success, user, token? }`
| Actualizar usuario | `PUT /api/users/{id}` | Campos editables del usuario (`{ name, email, role, status }`) | `200 OK` con `{ success, user }`
| Eliminar usuario | `DELETE /api/users/{id}` | — | `204 No Content` o `{ success: true }`
| Actualizar estado (activar/desactivar) | `PUT /api/users/{id}/status` | `{ active: true/false }` | `200 OK` con `{ success }`

### Estructura recomendada de usuario

```json
{
  "id": "uuid-o-numerico",
  "username": "usuario",
  "name": "Nombre completo",
  "email": "correo@example.com",
  "role": "ADMIN" | "USER" | "VIEWER" ...,
  "status": "active" | "inactive",
  "lastLogin": "2025-10-04T18:32:10Z",
  "createdAt": "2025-09-20T13:15:00Z"
}
```

## 2. Roles

| Operación | Método y Ruta | Payload | Respuesta |
|-----------|---------------|---------|-----------|
| Listar roles disponibles | `GET /api/users/roles` | — | `200 OK` con arreglo `[{ id, name, description?, permissions: [] }]`
| Asignar rol a usuario | `PUT /api/users/{id}/role` | `{ role: "ADMIN" }` | `200 OK` con `{ success }`
| (Opcional) Crear rol | `POST /api/roles` | `{ name, description?, permissions: [] }` | `201 Created`
| (Opcional) Actualizar rol | `PUT /api/roles/{id}` | `{ name?, description?, permissions? }` | `200 OK`
| (Opcional) Eliminar rol | `DELETE /api/roles/{id}` | — | `204 No Content`

**Notas:**
- El frontend actual espera al menos poder leer los roles existentes y asignarlos a usuarios.
- Si se habilita la creación/edición desde la UI, el backend deberá exponer las rutas opcionales.

## 3. Permisos individuales

La UI gestiona permisos granulares (por ejemplo: `download`, `delete`, `comment`, `admin`).

| Operación | Método y Ruta | Payload | Respuesta |
|-----------|---------------|---------|-----------|
| Obtener permisos de un usuario | `GET /api/users/{id}/permissions` | — | `200 OK` con arreglo `['download', 'comment', ...]`
| Asignar permisos a usuario | `PUT /api/users/{id}/permissions` | `{ permissions: ['download', 'comment'] }` | `200 OK` con `{ success }`
| Listar permisos por archivo (vista avanzada) | `GET /api/permissions/file/{fileId}` | — | `200 OK` con arreglo de permisos para el archivo.
| Asignar permiso específico (vista avanzada) | `POST /api/permissions/assign` | `{ fileId, userId, permissionType, expiresAt? }` | `201 Created` o `200 OK` con `{ success }`
| Revocar permiso específico | `DELETE /api/permissions/revoke` | Body JSON `{ fileId, userId, permissionType }` | `200 OK` con `{ success }`

### Formato de los permisos por archivo esperado

```json
[
  {
    "id": 1201,
    "fileId": 87,
    "fileName": "Contrato_Cliente.pdf",
    "userId": "uuid-usuario",
    "userName": "Linda Ortega",
    "userEmail": "linda@docuflow.com",
    "permissionType": "READ" | "WRITE" | "DELETE" | "ADMIN" | "SHARE",
    "grantedAt": "2025-10-01T12:30:00Z",
    "grantedBy": "soporte@docuflow.com",
    "expiresAt": "2025-12-31T23:59:59Z"
  }
]
```

## 4. Datos auxiliares

Para que la tabla y los contadores funcionen correctamente, es recomendable que los endpoints anteriores ofrezcan campos adicionales:

- **Usuarios**: `createdAt`, `updatedAt`, `lastLogin`, `active`, `avatarUrl` (opcional).
- **Roles**: arreglo de `permissions` con los identificadores utilizados en el frontend (`download`, `delete`, `comment`, `admin`, etc.).
- **Permisos**: las respuestas pueden incluir `origen` o `grantedBy` para trazar auditoría.

## 5. Autenticación y seguridad

- Todas las rutas bajo `/api/*` deben validar el JWT que entrega el login (`Authorization: Bearer <token>`).
- Las operaciones administrativas (`/api/admin/users`, crear roles, asignar permisos) deberían requerir el rol `ADMIN`.
- Las respuestas de error deben incluir un mensaje legible para mostrarlo en la UI (`{ error: "Mensaje" }`).

## 6. Checklist para habilitar la pantalla

1. [ ] `GET /api/users` retorna usuarios reales.
2. [ ] `GET /api/users/roles` lista los roles disponibles.
3. [ ] `PUT /api/users/{id}/role` actualiza el rol.
4. [ ] `GET /api/users/{id}/permissions` y `PUT /api/users/{id}/permissions` permiten gestionar permisos base.
5. [ ] `POST /api/permissions/assign` y `DELETE /api/permissions/revoke` están habilitados si se usarán vistas avanzadas por archivo.
6. [ ] `POST /auth/register` está disponible para crear usuarios desde la UI.
7. [ ] Todas las rutas validan JWT y retornan códigos HTTP acordes (200/201/204 para éxito, 4xx/5xx para errores).

Con estos servicios expuestos, el frontend podrá listar, crear, actualizar y eliminar usuarios, así como administrar sus permisos de manera granular desde la sección "Permisos".
