# Integración de los seis extras

Esta fase amplía la implementación original de la persona A por solicitud expresa del usuario. Las notas dejaron de estar en memoria. Los documentos y registros de la fase inicial se conservan como evidencia histórica; no describen el comportamiento nuevo de persistencia.

## Validación final

Instalación limpia con Node 20, generación del cliente y migraciones verificadas. La suite completa terminó con **37 aprobadas y 0 fallidas** tanto en Node 20.20.2 como en Node 24.22.1. Las salidas están en `docs/evidencias/extras/`. También se repitieron la comprobación de desarrollo con persistencia y las seis operaciones en Chromium. No se hicieron llamadas reales a Claude.

## Estado verificable

- Conversación: el segundo turno incluye usuario, asistente y nueva pregunta; se conserva en SQLite. Historial acotado a diez turnos completos por conversación.
- Streaming: se llama al SDK oficial `messages.stream`; un test no deja terminar al proveedor simulado hasta que Supertest recibe el primer fragmento, demostrando entrega incremental. Se comprueban errores posteriores al primer fragmento y ausencia de turnos parciales.
- Rate limit: una misma instancia de express-rate-limit protege `/api/ia` y `/:id/resumen`. La prueba consume el cupo con una pregunta y comprueba 429 al pedir resumen, sin llamar otra vez al proveedor.
- Costo: cada respuesta completada guarda tokens y modelo. Las tarifas configuradas se guardan junto al registro. La prueba usa tarifas ficticias 2 y 10 USD/millón y 100/20 tokens: `(100*2 + 20*10)/1_000_000 = 0.0004 USD`. Estos números no son precios oficiales ni consumo real.
- Persistencia: clientes Prisma independientes leen la misma nota e historial. La prueba de nodemon verifica que el contenido permanece tras un reinicio real del proceso de desarrollo.
- Supertest: preguntas, resumen, conversaciones, SSE, validación, errores de Claude 400/401/429/529 y límites se ejercitan con dependencias inyectadas. No necesita credenciales ni realiza llamadas de pago.

## Contratos importantes

Los métodos del servicio de notas son ahora asíncronos. Las rutas usan `await`. El historial se confirma junto con el consumo en una transacción cuando termina correctamente la respuesta. Un fallo no deja el mensaje del usuario sin respuesta persistida. Dos turnos simultáneos de la misma conversación reciben exclusión en una sola instancia; la segunda solicitud obtiene 409 y el bloqueo se libera al terminar o fallar.

El registro diario usa fronteras UTC, no la fecha local del dispositivo. Si existe una solicitud sin tarifas, se devuelve `costoEstimadoUsd: null` y se expone un subtotal parcial identificado. Errores del proveedor o desconexiones sin uso final no se contabilizan como si fueran gratuitos; su costo es desconocido.

## Prisma en este entorno

La descarga clásica desde `binaries.prisma.sh` devolvió 403. Se eligió el adaptador oficial libSQL con motor JavaScript; generación y migraciones funcionan con los paquetes npm verificados, sin desactivar TLS ni checksums. El dominio propuesto inicialmente se retiró del borrador de red al dejar de ser necesario.

La configuración de migraciones con adaptador es experimental en Prisma 6.19.0. Las versiones de Prisma y adaptador se fijan para que una actualización no cambie silenciosamente ese contrato. Las migraciones SQL se versionan y `db:setup` se puede ejecutar varias veces sin borrar la base.

## Pruebas pendientes con el proveedor

La funcionalidad se ha verificado mediante simulación del servicio y del cliente SDK. Para validar respuesta, formato de tres viñetas y tokens facturados reales se necesita una clave local y realizar llamadas reales autorizadas. No se sustituyen esas capturas por respuestas simuladas presentadas como Claude real.

Antes de publicar para otros usuarios se requieren autenticación y autorización, almacén compartido de límites/bloqueos, política de retención del historial y observabilidad de consumo parcial. Esta entrega permanece como aplicación de laboratorio en una sola instancia.
