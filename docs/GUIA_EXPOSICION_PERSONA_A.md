# Guía para explicar el trabajo de la persona A

Esta guía describe el código existente de `feature/notas`. Sirve para preparar la exposición; no reemplaza entender y ejecutar el proyecto. La integración de Claude pertenece a B y sigue pendiente.

## Presentación inicial (30 segundos)

> Mi parte es el backend de notas y su documentación. Separé las rutas HTTP, el servicio que guarda las notas, la validación de entrada y el manejo de errores. La API permite crear, listar, consultar y eliminar notas. Swagger describe esos endpoints y permite probarlos. Las notas se guardan en memoria; no hay base de datos. Dejé el servicio preparado para que mi compañero consulte una nota antes de generar su resumen con Claude.

## Recorrido por el código (3 minutos)

### 1. Arranque y aplicación

Abrir `lab5-api/src/index.js` y `lab5-api/src/app.js`.

- `index.js` carga `.env` antes de importar la aplicación, valida `PORT` y abre el servidor. El puerto por defecto es 3000; con `PORT=0` el sistema elige uno libre y la consola muestra el real.
- `app.js` construye Express, procesa JSON, publica Swagger y monta los routers. Exporta la aplicación sin abrir un puerto: así las pruebas pueden levantar su propia instancia temporal.
- El middleware de ruta desconocida va después de los routers. `errorHandler` va al final para recibir errores de las rutas y del procesamiento del JSON.
- El proceso maneja puerto ocupado y permite apagar el servidor con SIGINT/SIGTERM.

### 2. Entrada HTTP y validación

Abrir `lab5-api/src/routes/notas.routes.js` y `lab5-api/src/middlewares/validar.js`.

Ejemplo: `POST /api/notas` con `{"titulo":"Repaso","contenido":"Express y Zod"}`.

1. Express convierte el JSON recibido en `req.body`.
2. El middleware `validar(notaSchema)` usa `safeParse` de Zod.
3. Se recortan espacios extremos y se validan las longitudes: título de 1 a 100; contenido de 1 a 5000.
4. Si falla, responde 400 con `errores` y no ejecuta la creación.
5. Si funciona, `req.body` contiene solo los datos validados; las propiedades desconocidas se descartan.
6. La ruta llama a `notas.crear` y devuelve 201, la nota creada y `Location` con su ruta.

Los parámetros de URL son texto. Se comprueba que el ID sea un entero positivo decimal seguro y luego se convierte con `Number`. Esto evita que `1e0`, `1.0` o `0x1` se interpreten como el ID 1. Un ID inválido o inexistente devuelve 404 según el contrato de estas rutas.

### 3. Servicio y almacenamiento

Abrir `lab5-api/src/services/notas.service.js`.

| Función | Responsabilidad |
| --- | --- |
| `listar()` | Devuelve copias de las notas |
| `crear({ titulo, contenido })` | Asigna un ID creciente y guarda la nota |
| `buscar(id)` | Devuelve la nota o lanza `AppError` con 404 |
| `eliminar(id)` | Comprueba existencia con `buscar` y elimina solo esa nota |

El servicio no usa `req` ni `res`: conoce las notas, no HTTP. Las copias evitan que quien reciba una nota cambie accidentalmente el arreglo interno. Los IDs no se reutilizan al eliminar una nota, pero vuelven a empezar cuando el proceso se reinicia.

### 4. Errores

Abrir `lab5-api/src/utils/errors.js` y `lab5-api/src/middlewares/errorHandler.js`.

- Una nota inexistente lanza `AppError(404, 'Nota no encontrada')`.
- Express 5 envía al manejador los errores lanzados en las rutas y las promesas rechazadas.
- JSON mal formado devuelve 400; un cuerpo que supera el límite del parser devuelve 413.
- Un error inesperado queda en la consola del servidor y devuelve 500 con `Error interno`, sin exponer detalles al cliente.
- Si ya se enviaron cabeceras, el error pasa al siguiente manejador, evitando intentar responder dos veces.
- B debe ampliar este archivo para traducir errores de Claude; esa parte aún no está implementada.

### 5. Swagger e integración

Abrir `lab5-api/src/config/swagger.js` y volver a las anotaciones `@openapi` de las rutas.

`swagger-jsdoc` genera OpenAPI 3 a partir de la configuración y los comentarios. `swagger-ui-express` publica la interfaz. La configuración usa una ruta absoluta a los archivos para no depender del directorio desde el que se inicia Node. `servers: [{ url: '/' }]` permite ejecutar las solicitudes contra el origen donde está abierta la documentación.

B puede utilizar `notas.buscar(Number(req.params.id))` para obtener el contenido. Debe hacerlo **antes** de llamar a Claude: una nota inexistente debe generar 404 sin gastar créditos. El router de IA está montado pero vacío; no hay respuestas de IA simuladas.

## Demostración desde Swagger (3–5 minutos)

Desde la raíz: `npm ci`, crear `.env` a partir de `.env.example` y ejecutar `npm run dev`. La clave de Claude no es necesaria para esta parte.

1. Abrir `/api-docs` en el puerto anunciado. Expandir POST, pulsar **Try it out** y crear dos notas válidas: comprobar 201, IDs y `Location`.
2. Ejecutar GET de la colección: comprobar que aparecen las dos notas.
3. Ejecutar GET con el ID de una nota: comprobar que devuelve los mismos datos.
4. Crear con `{}`: comprobar 400 y errores que señalan `titulo` y `contenido`.
5. Consultar un ID que no existe: comprobar 404 y `Nota no encontrada`.
6. Eliminar la segunda nota: comprobar 204 sin cuerpo. Consultarla otra vez: 404. Listar y comprobar que la primera sigue existiendo.
7. Si hay tiempo, reiniciar el proceso y mostrar que la lista queda vacía. Explicar que esto es una decisión del laboratorio, no persistencia.

Las capturas reproducibles están en `docs/evidencias/`. El script `npm run test:browser` repite seis operaciones usando un navegador real, sin ejecutar llamadas a Claude.

## Preguntas que puede hacer el docente

**¿Por qué separar `app.js` de `index.js`?** Para importar la aplicación en pruebas sin abrir automáticamente un puerto fijo, y separar configuración HTTP de administración del proceso.

**¿Por qué usar 201 al crear y 204 al borrar?** 201 indica que se creó un recurso; 204 indica éxito sin cuerpo. No se debe añadir un JSON a una respuesta 204.

**¿Por qué `safeParse` en vez de confiar en el cliente?** Cualquier cliente puede enviar datos diferentes de los formularios de Swagger. El servidor es quien debe validar el contrato.

**¿Qué ocurre si envían una propiedad `id` al crear?** El esquema la descarta y el servicio asigna su propio ID. El cliente no decide el identificador.

**¿Por qué buscar antes de eliminar?** Reutiliza la regla de existencia y garantiza el mismo error 404. Si la nota no existe, no se hace `splice` con un índice incorrecto.

**¿Por qué devolver copias?** Para evitar que el consumidor del servicio modifique directamente el almacenamiento interno.

**¿Por qué guardar las notas en memoria?** Es lo que solicita el laboratorio para centrarse en REST e integración. No sobreviven a reinicios ni se comparten entre varios procesos.

**¿Swagger prueba toda la API?** No. Describe el contrato y permite solicitudes manuales. La suite automatizada comprueba comportamiento, y el validador OpenAPI comprueba la especificación. Son evidencias complementarias.

**¿Por qué `.env` no se sube?** Puede contener credenciales. `.env.example` muestra únicamente los nombres y valores de configuración no secretos. `.gitignore` evita añadir `.env`, pero no borra secretos que ya se hubieran publicado.

**¿Ya está terminado todo el laboratorio?** Está implementada y verificada la parte de A. Faltan la integración de B, la revisión de pareja y las pruebas cruzadas de IA con resultados reales.

## Evidencia que puedes mostrar

- `npm test`: 18 casos; ver resultados de Node 20 en `docs/evidencias/node20/pruebas.txt`.
- `npm run test:dev`: recarga automática y reinicio de memoria; registro en `docs/evidencias/desarrollo.json`.
- `npm run test:browser`: seis operaciones y capturas de Swagger.
- `git log --oneline`: commits de `feature/notas`.
- GitHub Actions está configurado; su aprobación remota solo se afirma si aparece en la pestaña Actions.
