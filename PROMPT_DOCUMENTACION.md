# PROMPT PARA GENERAR DOCUMENTACIÓN DOCUFLOW

## INSTRUCCIONES PARA LA IA:

Genera una guía de usuario completa en HTML para el sistema DocuFlow. Debe incluir CSS moderno integrado y ser completamente funcional como archivo standalone.

## CONTEXTO DEL PROYECTO:

**DocuFlow** es un sistema de gestión documental moderno desarrollado con:
- Frontend: HTML5, CSS3, JavaScript ES6+ modular
- Backend: Spring Boot + Kotlin + PostgreSQL
- Autenticación: JWT
- Almacenamiento: Google Cloud Storage
- Despliegue: Render (backend) + GitHub Pages (frontend)

## ESTRUCTURA DEL PROYECTO:

```
Frontend/
├── index.html (página principal)
├── features/
│   ├── auth/
│   │   ├── login.html
│   │   └── loginController.js
│   ├── dashboard/
│   │   ├── dashboard.html
│   │   └── dashboardController.js
│   ├── files/
│   │   ├── upload.html
│   │   └── uploadController.js
│   ├── comments/
│   │   ├── comments.html
│   │   └── commentsController.js
│   ├── logs/
│   │   ├── logs.html
│   │   └── logsController.js
│   └── permissions/
│       ├── permissions.html
│       └── permissionsController.js
└── shared/
    ├── services/
    │   ├── apiClient.js
    │   ├── store.js
    │   └── [otros servicios]
    ├── styles/
    │   └── styles.css
    └── utils/
        └── uiHelpers.js
```

## FUNCIONALIDADES A DOCUMENTAR:

### 1. AUTENTICACIÓN
- Login con credenciales (estudiante/123456 para desarrollo)
- Manejo de sesiones con JWT
- Logout seguro
- Redirección automática

### 2. DASHBOARD
- Estadísticas del sistema (archivos, usuarios, comentarios)
- Gráficos de actividad
- Archivos recientes
- Actividades recientes
- Navegación a otros módulos

### 3. GESTIÓN DE ARCHIVOS
- Subida de archivos (drag & drop o click)
- Lista de archivos con búsqueda y filtros
- Vista de tabla y cuadrícula
- Descarga de archivos
- Eliminación de archivos
- Previsualización (cuando disponible)
- Estadísticas de almacenamiento

### 4. SISTEMA DE COMENTARIOS
- Crear comentarios en archivos
- Marcar comentarios como tareas
- Asignar usuarios a tareas
- Editar comentarios propios
- Eliminar comentarios
- Filtrado por tipo (comentarios/tareas)

### 5. LOGS DE ACTIVIDAD
- Visualización de logs del sistema
- Filtros por usuario y acción
- Paginación de resultados
- Exportación de logs
- Búsqueda por fecha

### 6. GESTIÓN DE PERMISOS
- Lista de usuarios del sistema
- Cambio de roles (admin/colaborador)
- Gestión de permisos específicos
- Historial de cambios de permisos

## CARACTERÍSTICAS TÉCNICAS:

- **Modo offline**: Funciona sin conexión con datos de demostración
- **Responsive**: Adaptable a móviles y tablets
- **Notificaciones**: Sistema de alertas tipo toast
- **Store global**: Manejo de estado centralizado
- **Modular**: Arquitectura por módulos independientes
- **Navegación moderna**: SPA con carga dinámica de páginas

## USUARIOS TIPO:

1. **Administrador**: Acceso completo a todas las funciones
2. **Colaborador**: Acceso limitado a ciertas funciones
3. **Usuario regular**: Funciones básicas de visualización y comentarios

## REQUERIMIENTOS PARA LA GUÍA:

### ESTRUCTURA REQUERIDA:
1. **Portada** con logo y título
2. **Índice** navegable
3. **Introducción** al sistema
4. **Instalación y acceso**
5. **Tutorial paso a paso** para cada módulo
6. **Capturas de pantalla** (describir dónde irían)
7. **Solución de problemas** comunes
8. **FAQ** frecuentes
9. **Información técnica** básica
10. **Contacto y soporte**

### ESTILO VISUAL:
- Usar Bootstrap 5.3.2 CDN
- Colores: Azules (#007bff, #0056b3) y grises (#6c757d)
- Tipografía moderna y legible
- Iconos Bootstrap Icons
- Responsive design
- Modo claro (sin modo oscuro)

### FUNCIONALIDADES DEL HTML:
- Navegación lateral fija
- Scroll suave entre secciones
- Botones "Volver arriba"
- Secciones colapsables
- Enlaces externos que abran en nueva pestaña
- Impresión optimizada
- Botón de descarga/exportación

## CONTENIDO ESPECÍFICO A INCLUIR:

### Para cada módulo incluir:
- **Propósito**: ¿Para qué sirve?
- **Acceso**: ¿Cómo llegar ahí?
- **Interfaz**: Descripción de la pantalla
- **Acciones disponibles**: Lista de funciones
- **Casos de uso**: Ejemplos prácticos
- **Capturas**: Descripción de imágenes necesarias
- **Consejos**: Tips y mejores prácticas

### Datos de ejemplo a usar:
- Usuario demo: "estudiante" / "123456"
- Archivos de ejemplo: documento.pdf, reporte.xlsx, imagen.jpg
- Comentarios tipo: "Revisar este documento", "Pendiente de aprobación"
- Tareas tipo: "Corregir formato", "Validar información"

## FORMATO DE SALIDA SOLICITADO:

Genera un archivo HTML completo con:
- Estructura semántica correcta
- CSS integrado en `<style>`
- JavaScript mínimo para interactividad
- Meta tags para SEO
- Favicon placeholder
- Compatible con todos los navegadores modernos

## TONO Y ESTILO:

- **Profesional** pero **accesible**
- **Instrucciones claras** paso a paso
- **Lenguaje técnico** cuando sea necesario, pero explicado
- **Ejemplos prácticos** en cada sección
- **Advertencias** y **tips** destacados visualmente

¡Genera el HTML completo y funcional para esta guía de usuario!