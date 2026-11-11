# Laboratorio 5: Notas, Claude y retos extra

 feature/notas
Rama de trabajo: `feature/notas`. Incluye el CRUD del integrante A y, por solicitud posterior, los seis extras: conversación, streaming, límite de solicitudes, consumo/costo, persistencia y pruebas con Claude simulado.

CRUD de notas del **integrante A (persona 1)**, rama `feature/notas`, e integración con Claude del **integrante B (persona 2)**, rama `feature/ia`.
main

## Instalación

Node.js 20 o superior y npm. Verificado con Node 20.20.2 y 24.22.1.

```bash
npm ci
cp .env.example .env
npm start
```

`npm ci` genera el cliente Prisma. `npm start` aplica las migraciones antes de abrir el servidor. Para desarrollo: `npm run dev` (también aplica migraciones y luego usa nodemon). Abrir `/api-docs` en el puerto anunciado; por defecto 3000.

El CRUD, Swagger y las pruebas no necesitan una clave de Claude. Para solicitudes reales de IA, configurar `ANTHROPIC_API_KEY` en `.env` local. Nunca subir ese archivo. No se han ejecutado llamadas de pago durante la implementación.

## Los seis extras

| Extra | Implementación |
| --- | --- |
| Conversación | Historial SQLite con roles `user`/`assistant`; cada turno envía el historial al SDK; máximo 10 turnos |
| Streaming | `client.messages.stream()`; entrega fragmentos SSE, evento final con uso o error genérico |
| Rate limit | `express-rate-limit` protege `/api/ia` y el resumen; contador compartido por IP, 10 solicitudes/minuto por defecto |
| Costo | Registro de tokens, modelo, operación, tarifas utilizadas y estimación diaria UTC |
| Persistencia | Prisma 6.19.0, SQLite local y migración versionada; conserva notas, historial y consumos |
| Pruebas | Supertest con Claude inyectado/simulado, sin gastar créditos; también pruebas del SDK con cliente falso |

## Variables de entorno

| Variable | Uso |
| --- | --- |
| `PORT` | Puerto del servidor; por defecto 3000; entero entre 0 y 65535 (0 elige un puerto libre) |
| `ANTHROPIC_API_KEY` | Clave privada de la Claude API; solo la lee `claude.service.js`. Sin ella el CRUD y Swagger funcionan y la IA responde 502 |
| `CLAUDE_MODEL` | Modelo usado por `messages.create` (por defecto `claude-haiku-4-5-20251001`) |

Las tarifas quedan vacías por defecto: no se inventa un precio. Si existen consumos sin tarifa, el total diario `costoEstimadoUsd` es `null`; `subtotalConTarifaUsd` suma únicamente los registros con tarifa. La estimación es aritmética, no una factura del proveedor. Cada registro conserva las tarifas usadas: cambiarlas no recalcula consumos anteriores.

## Endpoints

| Método | Ruta | Resultado |
| --- | --- | --- |
| GET | `/api/notas` | Lista de notas |
| POST | `/api/notas` | Crea `{titulo,contenido}`, devuelve 201 y `Location` |
| GET | `/api/notas/:id` | Obtiene una nota; 404 si no existe |
| DELETE | `/api/notas/:id` | 204 sin cuerpo; 404 si no existe |
| POST | `/api/ia/preguntar` | 200 con `respuesta` y `uso`; 400 si la pregunta es inválida; 429/502/503 `IA_NO_DISPONIBLE` |
| POST | `/api/notas/:id/resumen` | 200 con `notaId` y `resumen`; 404 sin llamar a Claude; 429/502/503 `IA_NO_DISPONIBLE` |
| GET | `/api-docs` | Documentación interactiva Swagger UI |

Copiar el `id` devuelto y sustituir `ID`:

```bash
curl -X POST http://localhost:3000/api/ia/conversaciones/ID/mensajes \
  -H 'Content-Type: application/json' -d '{"pregunta":"Explica qué es Express"}'
curl -N -X POST http://localhost:3000/api/ia/conversaciones/ID/stream \
  -H 'Content-Type: application/json' -d '{"pregunta":"Resume tu explicación anterior"}'
curl http://localhost:3000/api/ia/consumo
```

SSE envía `event: texto` con `{texto}`, `event: fin` con `{uso,modelo}` o `event: error` con `{status,error}`. Un error antes del primer fragmento usa JSON y su código HTTP. Después de iniciar el stream, el HTTP ya es 200 y el error se comunica mediante el evento SSE. `EventSource` del navegador no sirve para este POST: usar `fetch` con lectura del stream o `curl -N`. Swagger documenta el contrato, pero puede esperar al final para mostrar el cuerpo.

Las solicitudes reales consumen créditos. Las pruebas siguientes no requieren claves ni utilizan el proveedor.

## Base de datos y arquitectura

```text
prisma/schema.prisma                 Modelos Nota, Conversacion, Mensaje y Consumo
prisma/migrations/                   SQL versionado
prisma.config.ts                     Adaptador SQLite del CLI
lab5-api/src/config/database.js       Cliente Prisma de la aplicación
lab5-api/src/services/claude.service.js Único módulo de servicio que llama al SDK
lab5-api/src/services/ia.service.js    Historial, turnos y transacción de mensajes/consumo
lab5-api/src/services/consumo.service.js Registro y agregado UTC
lab5-api/src/services/notas.service.js CRUD asíncrono
```

`buscar(id)` ahora devuelve una promesa: utilizar `await notas.buscar(Number(id))`. Las rutas Express 5 esperan las operaciones y envían sus errores al manejador central. El SDK se inicializa al primer uso para permitir ejecutar el CRUD sin credenciales.

Se usa el adaptador oficial `@prisma/adapter-libsql` para SQLite y el motor JavaScript, evitando descargar motores Rust. Prisma, su cliente y el adaptador están fijados en 6.19.0. La configuración de migraciones con adaptador es experimental en esa versión: las migraciones se probaron y deben revisarse antes de actualizar Prisma. `DATABASE_URL` se resuelve en la configuración/constructor del adaptador; usar rutas absolutas para archivos personalizados.

## Integración con Claude (integrante B)

- `src/services/claude.service.js` es el **único** módulo que importa `@anthropic-ai/sdk`. El cliente se crea en la primera pregunta válida (con `timeout` de 30 s y un reintento), de modo que el servidor arranca aunque falte la clave. Usa `messages.create` con `model` desde `CLAUDE_MODEL`, `max_tokens: 1024`, un `system` configurable y devuelve `{ respuesta, uso }`.
- `src/routes/ia.routes.js` implementa `POST /api/ia/preguntar`. Zod exige una pregunta de 3 a 2000 caracteres (tras recortar espacios) **antes** de llamar a Claude.
- `POST /api/notas/:id/resumen` (en `notas.routes.js`) llama primero a `notas.buscar(id)` de A: si la nota no existe responde 404 sin gastar créditos. Envía el contenido como mensaje y la instrucción «Resume el texto en 3 viñetas breves, en español.» como `system`.
- `errorHandler.js` traduce los errores del SDK sin reenviar el mensaje del proveedor; en consola solo se registra estado y tipo:

| Error de Claude | Respuesta de nuestra API |
| --- | --- |
| 401, 400 u otro | 502 `{ "error": "IA_NO_DISPONIBLE" }` |
| 429 | 429 `{ "error": "IA_NO_DISPONIBLE" }` |
| 529 | 503 `{ "error": "IA_NO_DISPONIBLE" }` |
| Conexión o timeout | 502 `{ "error": "IA_NO_DISPONIBLE" }` |

`lab5-api/test/ia.test.js` agrega 7 pruebas con `supertest` que simulan `claude.service`: no consumen créditos ni necesitan clave, y **no sustituyen** las capturas reales con ★.

```bash
npm run db:generate
npm run db:setup
```

`db:setup` aplica las migraciones pendientes sin borrar datos. No se ejecuta `migrate reset`. Los `.db`, `.env` y `node_modules` están ignorados. Conservar el archivo SQLite y realizar copias antes de cambiar el esquema.

## Pruebas y evidencias

```bash
npm test
npm run test:dev
npx playwright install chromium
npm run test:browser
```

Si hay Chromium instalado: `CHROMIUM_PATH=/usr/bin/chromium npm run test:browser`.

**37 pruebas aprobadas en Node 20.20.2 y 24.22.1.** La suite comprueba CRUD, validación, errores, historial, aislamiento de conversaciones, límites de turnos, SSE incremental, errores tras iniciar el stream, cancelación, concurrencia, rate limit, tarifas, fronteras UTC, persistencia y el contrato del SDK. Supertest recibe un servicio Claude falso; otra prueba inspecciona las llamadas del servicio al SDK mediante un cliente falso.

Cada proceso de pruebas usa una SQLite temporal; no borra la base local del usuario. La prueba de desarrollo confirma que la nota **se conserva** tras reiniciar nodemon. La de navegador ejecuta seis operaciones desde Swagger y genera capturas reales del CRUD.

Ver [validación de extras](docs/EXTRAS.md) y [evidencias](docs/evidencias). GitHub Actions ejecuta instalación, suite y prueba de desarrollo en Node 20 y 24; el resultado remoto debe consultarse en Actions.

![Crear nota desde Swagger](docs/evidencias/01-crear-nota.png)

Pruebas manuales de pareja: B debe repetir el CRUD desde Swagger UI. A debe probar pregunta libre, resumen, nota inexistente, pregunta de una letra y credencial inválida (cambiar `ANTHROPIC_API_KEY` por un valor falso, reiniciar y preguntar: 502 `IA_NO_DISPONIBLE` y `Claude API: 401` en la consola). Las capturas con ★ requieren llamadas reales con clave: guardarlas sin claves en `docs/evidencias/`.

En Windows, la prueba de `servidor.test.js` que detiene el proceso con SIGTERM falla porque Windows no entrega esa señal al proceso; el resto pasa (24 de 25) y en Linux/CI pasan todas.

No hay cuentas ni autorización: no publicar como servicio multiusuario. Quien conozca un UUID puede acceder a esa conversación; el consumo agregado también es accesible. Los límites por IP y el bloqueo de turnos son locales a un proceso; varias instancias requieren un almacén compartido y autenticación. Express no confía por defecto en `X-Forwarded-For`; un proxy debe configurarse explícitamente con una política de confianza acotada.

1. **¿Por qué la clave no puede estar en el frontend?** El usuario puede inspeccionar JavaScript, mapas de código y solicitudes en las herramientas del navegador. Una clave allí permitiría llamadas no autorizadas y gastos a cargo del propietario. Debe permanecer en el backend y fuera de Git.
2. **¿Qué responder cuando Claude devuelve 401?** Nuestra API responde 502 con `{ "error": "IA_NO_DISPONIBLE" }` (implementado en `errorHandler.js` y cubierto por `ia.test.js`). El 401 significa que la clave **del servidor** fue rechazada por el proveedor, no que el cliente de nuestra API no esté autenticado; reenviarlo confundiría al cliente y podría filtrar detalles internos. El detalle queda solo en la consola del servidor.
3. **`system` frente a `messages`:** `system` define el comportamiento (rol, idioma, formato); `messages` contiene lo que dice el usuario. En el resumen, `system` es «Resume el texto en 3 viñetas breves, en español.» y el mensaje es el contenido de la nota. Experimento real cambiando `system` a «Resume el texto en una frase»: **[completar con lo observado]**.
4. **Tokens y costo:** `max_tokens` limita la salida; validar y limitar la pregunta a 2000 caracteres reduce la entrada. Valores reales (campo `uso` de la respuesta):

| Llamada real | input_tokens | output_tokens |
| --- | --- | --- |
| Pregunta 1 | [completar] | [completar] |
| Pregunta 2 | [completar] | [completar] |
5. **Sin validar antes de Claude:** se gastarían créditos en entradas vacías o demasiado largas y podrían enviarse tipos o parámetros inválidos, causando errores y latencia innecesaria.
6. **Conflictos de Git:** `feature/ia` se creó desde `main` ya con el CRUD de A, por lo que no hubo conflicto textual. Sí hubo una diferencia de contrato: la versión inicial de B devolvía 400 para ids no numéricos en el resumen, pero A ya validaba `:id` con `router.param` y responde 404; B adaptó su ruta y sus pruebas al comportamiento de A en lugar de duplicar la validación. También se corrigió la ruta `apis` de `swagger.js`, que en Windows dejaba Swagger UI sin endpoints.

## Pareja y reflexión

| Integrante | Nombre | Papel original |
| --- | --- | --- |
| A | Por completar | Express, CRUD, Zod, Swagger |
| B | Por completar | Integración Claude y revisión cruzada |

Los extras de IA se incorporaron posteriormente por solicitud del usuario; no se atribuyen como trabajo ni aprobación de B. Las [guías de exposición y revisión](docs/GUIA_EXPOSICION_PERSONA_A.md) de la primera fase explican su contexto original; consultar primero `docs/EXTRAS.md` para el comportamiento actual.

1. La clave debe permanecer en el backend: el código y las solicitudes del navegador son inspeccionables. `.gitignore` no elimina claves publicadas en el historial.
2. Un 401 de Claude devuelve 502 genérico porque falla la autenticación del backend con su proveedor, no la del cliente con esta API.
3. `system` define comportamiento (por ejemplo, tres viñetas); `messages` contiene el historial con roles. Las pruebas inspeccionan ambos parámetros sin contactar al proveedor.
4. Los tokens reales de dos llamadas quedan pendientes de pruebas autorizadas con Claude; los valores de los tests son simulados. `max_tokens` limita la salida; validación e historial acotado limitan la entrada.
5. Sin validación se desperdician créditos en entradas vacías, largas o mal formadas y aumentan errores/latencia.
6. La revisión de pareja y el registro de conflictos siguen pendientes. No se inventan aprobaciones ni capturas de Claude.

Todo se sube a `feature/notas`, sin fusionar directamente a `main`.
