# Guía de implementación: Ocultar rutas detrás del dominio y exponer `/api/gcs/stats`

## 1. Objetivo

Centralizar las pautas para que el backend o el reverse proxy oculten las rutas internas (carpetas/archivos) tras el dominio principal, **sin romper los endpoints de la API** y garantizando que `/api/gcs/stats` responda correctamente.

## 2. Arquitectura de referencia

- **Frontend estático** servido desde `/` (por ejemplo, `index.html`, assets compilados, etc.).
- **API REST** bajo el prefijo `/api`, publicada por el backend Spring Boot.
- **Reverse proxy** (Nginx, Azure Front Door, Cloudflare, etc.) responsable de las reglas de reescritura.

> _Assumption_: El reverse proxy es el responsable de “ocultar” rutas físicas. Si no existe, las reglas pueden aplicarse directamente en Spring Boot usando controladores que sirvan los recursos estáticos.

## 3. Reglas de reescritura recomendadas

1. **Redirect estándar para SPA**: cualquier ruta que no empiece por `/api`, `/assets`, `/static` o equivalentes debe servir `index.html`.
2. **Excepción para la API**: las peticiones con prefijo `/api/` siempre deben bypass del proxy y llegar al backend.
3. **Archivos estáticos específicos**: evita reescribir URLs que terminen en `.js`, `.css`, `.png`, `.svg`, etc., para que el CDN o proxy pueda cachearlos.

### 3.1 Ejemplo en Nginx

```nginx
location /api/ {
    proxy_pass http://backend:8080;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
}

location / {
    try_files $uri $uri/ /index.html;
}

location ~* \.(js|css|png|jpg|jpeg|gif|svg|woff2?)$ {
    try_files $uri =404;
    add_header Cache-Control "public, max-age=31536000";
}
```

### 3.2 Ejemplo en Spring Boot (cuando no hay proxy externo)

```java
@Configuration
public class WebMvcConfig implements WebMvcConfigurer {

    @Override
    public void addViewControllers(ViewControllerRegistry registry) {
        registry.addViewController("/{spring:(?!api|assets).+}")
                .setViewName("forward:/index.html");
    }
}
```

## 4. Endpoint `/api/gcs/stats`

El error 500 observado se debe a que la ruta no está implementada; Spring intenta buscar un recurso estático y lanza `NoResourceFoundException`.

### 4.1 Controlador mínimo en Spring Boot

```java
@RestController
@RequestMapping("/api/gcs")
public class GcsController {

    @GetMapping("/stats")
    public ResponseEntity<GcsStatsResponse> getStats() {
        // TODO: Reemplazar con integración real (Google Cloud Storage, etc.).
        GcsStatsResponse body = new GcsStatsResponse(0L, 0L, Instant.now());
        return ResponseEntity.ok(body);
    }

    public record GcsStatsResponse(long documents, long totalBytes, Instant lastSync) { }
}
```

> **Tip**: si todavía no hay integración real, devuelve un stub controlado para mantener el frontend funcional.

## 5. Pasos para implementar

1. **Actualizar el proxy** con las reglas de la sección 3.
2. **Desplegar el controlador `/api/gcs/stats`** en el backend y publicar nuevas métricas reales o de prueba.
3. **Revisar políticas de caché** para asegurarse de que `/api/*` no se cachea.
4. **Verificar logs** después del despliegue:
   - Confirmar que `/api/gcs/stats` responde 200.
   - Asegurar que los assets estáticos siguen sirviéndose sin 404.
   - Validar que rutas como `/dashboard` redirigen a `index.html`.

## 6. Pruebas sugeridas

- Navegar a `/dashboard`, `/files`, etc. sin sesión y confirmar que el proxy entrega el `index.html` sin revelar rutas físicas.
- Ejecutar `curl -i https://<dominio>/api/gcs/stats` y verificar código 200 y JSON.
- Forzar una ruta inexistente (`/no-existe`) y comprobar que llega el `index.html` (SPA) y no un 500.

## 7. Desventajas y mitigaciones

| Riesgo | Descripción | Mitigación |
| --- | --- | --- |
| Debugging más complejo | Las reescrituras dificultan rastrear rutas físicas | Documentar reglas y usar encabezados de tracing |
| Cache anti-intuitiva | Un `try_files` agresivo puede cachear assets de la SPA | Configurar `Cache-Control` + invalidaciones |
| Exposición de API | Si se reescribe `/api` por error, la SPA dejará de funcionar | Mantener reglas separadas para `/api` |
| Reglas divergentes entre entornos | QA/Prod pueden diferir | Versionar config (Infrastructure as Code) |

## 8. Checklist de entrega

- [ ] Reglas de proxy desplegadas.
- [ ] Endpoint `/api/gcs/stats` activo con respuesta 200.
- [ ] Monitoreo/alertas actualizados para detectar 4xx/5xx en `/api/*`.
- [ ] Documentación compartida con el equipo (este archivo).

---

**Contacto:** Equipo Frontend – arrojar dudas en el canal `#docuflow-backend`.
