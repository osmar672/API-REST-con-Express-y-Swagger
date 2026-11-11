# Laboratorio 5: API REST de notas con Express y Swagger

Implementación del **integrante A (persona 1)** en la rama `feature/notas`.

| Integrante | Nombre | Responsabilidad |
| --- | --- | --- |
| A / persona 1 | Por completar por el estudiante | Express, CRUD, Zod y Swagger |
| B / persona 2 | Por completar por el estudiante | Claude, preguntas, resumen y errores de IA |

## Instalación y ejecución

Requiere Node.js 20 o superior y npm. Desde la raíz del repositorio:

```bash
npm ci
cp .env.example .env
npm run dev
```

Para ejecución sin recarga: `npm start`. Para las pruebas: `npm test`.
Swagger UI está en `http://localhost:3000/api-docs` (o el puerto configurado).
El código está en `lab5-api/src`; los scripts se ejecutan desde la raíz, donde están los manifiestos existentes.
Las notas se guardan en memoria: reiniciar el proceso elimina los datos.

**Estado heredado:** el repositorio original versiona `node_modules`. No se han eliminado esos archivos en esta rama para evitar una eliminación masiva ajena al CRUD. `npm ci` puede modificar archivos versionados de esa carpeta; no incluirlos en commits. `.gitignore` impide añadir nuevas dependencias, pero no deja de rastrear las existentes. El equipo debería acordar su retirada del índice en una tarea de limpieza.

## Variables de entorno

| Variable | Uso |
| --- | --- |
| `PORT` | Puerto del servidor; por defecto 3000 |
| `ANTHROPIC_API_KEY` | Credencial local para la futura integración de B; no requerida por el CRUD |
| `CLAUDE_MODEL` | Modelo para la futura integración de B |

`.env.example` no contiene credenciales. Crear `.env` localmente; nunca subirlo ni mostrar claves en capturas. Verificar `git status` antes de cada commit.

## Endpoints implementados

| Método | Ruta | Resultado |
| --- | --- | --- |
| GET | `/api/notas` | 200, arreglo de notas |
| GET | `/api/notas/:id` | 200 con nota; 404 si no existe |
| POST | `/api/notas` | 201 con nota creada; 400 si los datos son inválidos |
| DELETE | `/api/notas/:id` | 204 sin cuerpo; 404 si no existe |
| GET | `/api-docs` | Documentación interactiva Swagger UI |

Ejemplo de creación:

```bash
curl -i -X POST http://localhost:3000/api/notas \
  -H 'Content-Type: application/json' \
  -d '{"titulo":"Primera nota","contenido":"Texto para resumir después"}'
curl -i http://localhost:3000/api/notas
curl -i http://localhost:3000/api/notas/1
curl -i -X DELETE http://localhost:3000/api/notas/1
```

`titulo`: entre 1 y 100 caracteres; `contenido`: entre 1 y 5000. Se recortan espacios extremos y se descartan propiedades desconocidas. Cuerpo inválido: `{ "errores": [...] }`; nota inexistente: `{ "error": "Nota no encontrada" }`. JSON mal formado devuelve 400; cuerpo excesivo, 413; errores internos, 500 sin detalles sensibles.

## Integración con el integrante B

`src/services/notas.service.js` exporta `listar()`, `crear({ titulo, contenido })`, `buscar(id)` y `eliminar(id)`. `buscar` recibe un número, devuelve una copia de la nota o lanza `AppError(404, 'Nota no encontrada')`. B debe llamar `buscar(Number(req.params.id))` antes de contactar a Claude en la ruta de resumen.

`src/routes/ia.routes.js` exporta un router vacío que ya está montado en `/api/ia`. B implementará `/preguntar`, `src/services/claude.service.js`, `POST /api/notas/:id/resumen`, documentación de IA y la ampliación de `errorHandler.js`. Actualmente esas rutas de IA responden 404; no se simulan respuestas de Claude. Solo el servicio de B deberá utilizar el SDK.

Swagger usa rutas absolutas de archivos para funcionar independientemente del directorio actual. La definición canónica está en `src/config/swagger.js`; `lab5-api/config/swagger.js` la reexporta para compatibilidad.

## Verificación

`npm test` ejecuta seis pruebas con `node:test` y peticiones HTTP reales, sin servicios externos ni consumo de créditos:

1. Crear dos notas, listar, consultar, eliminar y comprobar IDs crecientes.
2. Validación de campos, tipos, espacios y límites.
3. Consulta y eliminación de identificadores inexistentes o inválidos.
4. JSON mal formado y ruta desconocida.
5. Swagger UI y validación de la especificación OpenAPI.
6. Contrato `buscar(id)` y protección contra mutaciones externas.

Resultado durante la implementación: **6 aprobadas, 0 fallidas**.

Pruebas manuales de pareja: B debe repetir el CRUD desde Swagger UI. A deberá probar pregunta libre, resumen, nota inexistente, pregunta de una letra y credencial inválida cuando B entregue su integración. Las capturas marcadas con estrella en la guía corresponden a IA: están pendientes, no se han realizado llamadas ni inventado evidencias. Guardar capturas reales sin claves en `docs/` cuando sea posible.

## Reflexión

1. **¿Por qué la clave no puede estar en el frontend?** El usuario puede inspeccionar JavaScript, mapas de código y solicitudes en las herramientas del navegador. Una clave allí permitiría llamadas no autorizadas y gastos a cargo del propietario. Debe permanecer en el backend y fuera de Git.
2. **¿Qué responder cuando Claude devuelve 401?** El contrato que B debe implementar es 502 con `IA_NO_DISPONIBLE`. El problema es la autenticación del backend ante su proveedor, no la del cliente ante nuestra API. No se deben filtrar mensajes internos. Esta respuesta de IA aún no está implementada ni verificada en esta rama.
3. **`system` frente a `messages`:** `system` define comportamiento, por ejemplo «Resume en tres viñetas en español»; `messages` contiene el texto o pregunta del usuario. Es un ejemplo conceptual; la comparación experimental queda pendiente de B.
4. **Tokens y costo:** `max_tokens` limita la salida; validar y limitar el texto reduce la entrada. Los valores reales `input_tokens` y `output_tokens` de dos llamadas quedan pendientes: no se han realizado llamadas a Claude.
5. **Sin validar antes de Claude:** se gastarían créditos en entradas vacías o demasiado largas y podrían enviarse tipos o parámetros inválidos, causando errores y latencia innecesaria.
6. **Conflictos de Git:** aún no se ha integrado `feature/ia`; no hay un conflicto real que documentar. Tras la revisión de pareja se deberá registrar si hubo conflictos y cómo se resolvieron.

## Colaboración y entrega

Los cambios de A se publican en `feature/notas`, sin modificar `main`. Abrir un pull request hacia `main` para revisión de B; el compañero debe dejar sus propios comentarios y aprobarlo antes de fusionar. No se simulan aprobaciones ni se atribuyen commits a otras personas. Completar los nombres, pruebas de IA, capturas, métricas y reflexión de integración antes de la entrega final conjunta.
