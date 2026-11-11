# Pull request de la persona A

> Documento de la fase original de A. Desde la integración de extras, el CRUD es asíncrono y persistente, y las rutas de IA están implementadas. Consultar [EXTRAS.md](EXTRAS.md) y el README para el estado actual; los resultados de la fase inicial son históricos.

## Datos para abrirlo

- Base: `main`
- Rama: `feature/notas`
- Título: **Implementa y verifica API de notas y Swagger del integrante A**
- Enlace: https://github.com/osmar672/API-REST-con-Express-y-Swagger/compare/main...feature/notas?expand=1

La creación automática anterior fue rechazada por la API de GitHub con `Forbidden`. Este documento prepara el contenido; no afirma que el pull request exista o esté aprobado.

## Descripción para copiar

Implementa la parte del integrante A del laboratorio 5: servidor Express, CRUD de notas en memoria, validación con Zod y documentación OpenAPI disponible en Swagger UI. Incluye el contrato `buscar(id)` para que B integre los resúmenes y un router de IA vacío ya montado.

Se comprueban códigos HTTP, validación, errores, IDs, creación con Location, arranque, puerto ocupado y apagado. Las dependencias dejaron de estar versionadas y se reproducen con `npm ci`.

Validación local:

- 18 pruebas aprobadas en Node 20.20.2 y en Node 24.22.1.
- Instalación limpia con Node 20 y lockfile.
- `npm run dev`: creación, cambio de archivo, reinicio de nodemon, memoria vacía y Swagger operativo.
- Seis operaciones ejecutadas desde Swagger UI en Chromium, con capturas y resultados en `docs/evidencias/`.
- GitHub Actions configurado para Node 20 y 24; confirmar su estado en la plataforma.

La integración Claude, sus capturas, métricas de tokens y reflexiones de pruebas cruzadas quedan pendientes de B y de la integración. No se incluyen credenciales ni se modificó main directamente.

## Lista para revisión de B

Esta lista se entrega sin marcar para que B registre su propia revisión. No representa una aprobación automática.

- [ ] Instalar con `npm ci` y ejecutar `npm test`.
- [ ] Arrancar la aplicación y abrir `/api-docs`.
- [ ] Crear dos notas; comprobar 201 y sus identificadores.
- [ ] Listar y consultar una nota; comprobar 200 y contenido.
- [ ] Enviar `{}` y comprobar 400 con detalles de Zod.
- [ ] Consultar una nota inexistente y comprobar 404.
- [ ] Eliminar una nota; comprobar 204 sin cuerpo y luego 404 al buscarla.
- [ ] Revisar que `.env` esté ignorado y que los archivos publicados no contengan claves.
- [ ] Revisar el contrato `buscar(id)` y confirmar que puede utilizarse desde el resumen antes de llamar a Claude.
- [ ] Revisar que `errorHandler` se pueda ampliar para Claude y que las rutas de IA estén claramente pendientes.
- [ ] Verificar el resultado real de GitHub Actions.
- [ ] Dejar comentarios de revisión y aprobar o solicitar cambios desde la cuenta de B.

## Después de integrar IA

A debe ejecutar y registrar las pruebas asignadas en la guía: pregunta válida, resumen, nota inexistente, pregunta de una letra y credencial inválida. Guardar las capturas marcadas por el docente sin mostrar claves. Completar nombres, resultados de tokens y reflexión de conflictos con lo que realmente ocurra. Fusionar solo después de la revisión de pareja.
