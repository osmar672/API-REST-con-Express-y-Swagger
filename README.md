# Laboratorio 5: Notas, Claude y retos extra

Rama de trabajo: `feature/notas`. Incluye el CRUD del integrante A y, por solicitud posterior, los seis extras: conversación, streaming, límite de solicitudes, consumo/costo, persistencia y pruebas con Claude simulado.

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
| `PORT` | Entero entre 0 y 65535; 3000 por defecto; 0 selecciona puerto libre |
| `DATABASE_URL` | Opcional, URL `file:` absoluta; sin definir se usa `prisma/dev.db` |
| `ANTHROPIC_API_KEY` | Clave local para llamadas reales; sin ella la IA devuelve 503 `IA_NO_CONFIGURADA` |
| `CLAUDE_MODEL` | Modelo de Claude; valor de ejemplo en `.env.example` |
| `IA_RATE_LIMIT` | Solicitudes por IP/minuto; entero positivo, 10 por defecto |
| `CLAUDE_INPUT_USD_PER_MILLION` | Tarifa de entrada en USD por millón; consultar la del modelo usado |
| `CLAUDE_OUTPUT_USD_PER_MILLION` | Tarifa de salida en USD por millón; configurar junto con la anterior |

Las tarifas quedan vacías por defecto: no se inventa un precio. Si existen consumos sin tarifa, el total diario `costoEstimadoUsd` es `null`; `subtotalConTarifaUsd` suma únicamente los registros con tarifa. La estimación es aritmética, no una factura del proveedor. Cada registro conserva las tarifas usadas: cambiarlas no recalcula consumos anteriores.

## Endpoints

| Método | Ruta | Resultado |
| --- | --- | --- |
| GET | `/api/notas` | Lista de notas |
| POST | `/api/notas` | Crea `{titulo,contenido}`, devuelve 201 y `Location` |
| GET | `/api/notas/:id` | Obtiene una nota; 404 si no existe |
| DELETE | `/api/notas/:id` | 204 sin cuerpo; 404 si no existe |
| POST | `/api/notas/:id/resumen` | Resume el contenido en tres viñetas; busca la nota antes de llamar a Claude |
| POST | `/api/ia/preguntar` | Pregunta independiente: `{pregunta}` |
| POST | `/api/ia/conversaciones` | Crea una conversación; devuelve 201 con `id` |
| GET | `/api/ia/conversaciones/:id` | Consulta historial |
| POST | `/api/ia/conversaciones/:id/mensajes` | Añade un turno con `{pregunta}` y devuelve respuesta/uso/modelo |
| POST | `/api/ia/conversaciones/:id/stream` | Turno con respuesta incremental SSE |
| GET | `/api/ia/consumo?fecha=YYYY-MM-DD` | Consumo y estimación del día UTC; por defecto hoy UTC |
| GET | `/api-docs` | Swagger UI con contratos y códigos de error |

Zod valida antes de llamar al SDK: preguntas de 3–2000 caracteres, título de 1–100 y contenido de 1–5000. Se recortan espacios extremos y descartan propiedades desconocidas. IDs de notas: enteros positivos decimales seguros, sin ceros iniciales ni notación científica. Los IDs inválidos o inexistentes responden 404.

Errores: 400 con detalles de validación o JSON inválido; 404 para recurso inexistente; 409 para conversación ocupada o límite de turnos; 413 para cuerpo excesivo; 429 para límite local/proveedor; errores Claude 400/401 se traducen a 502 y 529 a 503 con `IA_NO_DISPONIBLE`. Las respuestas no exponen detalles internos del proveedor.

## Ejemplo de conversación y streaming

Con la clave configurada, crear una conversación:

```bash
curl -X POST http://localhost:3000/api/ia/conversaciones
```

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

Comandos de base:

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

## Límites de esta aplicación de laboratorio

No hay cuentas ni autorización: no publicar como servicio multiusuario. Quien conozca un UUID puede acceder a esa conversación; el consumo agregado también es accesible. Los límites por IP y el bloqueo de turnos son locales a un proceso; varias instancias requieren un almacén compartido y autenticación. Express no confía por defecto en `X-Forwarded-For`; un proxy debe configurarse explícitamente con una política de confianza acotada.

La contabilidad registra solicitudes completadas con uso conocido. Fallos, desconexiones y respuestas parciales pueden consumir tokens en el proveedor sin entregar métricas finales: no se presentan como costo cero conocido ni aparecen como consumo confirmado. No hay caché de prompts, herramientas ni cobros adicionales contemplados. Una desconexión cancela el stream y evita guardar un turno incompleto. Las llamadas tienen timeout de 45 segundos, sin reintentos automáticos; historial máximo de 10 turnos y salida máxima de 1024 tokens.

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
