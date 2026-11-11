# Revisión del trabajo del integrante A

> Documento de la fase original de A. Desde la integración de extras, el CRUD es asíncrono y persistente, y las rutas de IA están implementadas. Consultar [EXTRAS.md](EXTRAS.md) y el README para el estado actual; los resultados de la fase inicial son históricos.

## Alcance según la guía

| Requisito de A | Implementación | Evidencia |
| --- | --- | --- |
| Express, app separada del proceso de arranque | `lab5-api/src/app.js`, `index.js` | Pruebas HTTP y proceso hijo |
| Crear, listar, obtener y eliminar notas | `routes/notas.routes.js`, `services/notas.service.js` | Pruebas de ciclo completo y navegador |
| Validación Zod | `middlewares/validar.js` | Campos vacíos, tipos, blancos, límites y propiedades desconocidas |
| Errores centralizados | `utils/errors.js`, `middlewares/errorHandler.js` | 400, 404, 413 y 500 sin detalles internos |
| Swagger con esquemas y códigos | `src/config/swagger.js`, anotaciones en rutas | Validador OpenAPI y operaciones desde Swagger UI |
| Integración con B | `buscar(id)` y router vacío de IA | Prueba del contrato, sin llamar a Claude |
| Configuración y documentación compartidas | `.env.example`, `.gitignore`, `README.md` | Variables sin secretos, comandos de ejecución |
| Rama y commits | `feature/notas` | Historial de Git |

## Correcciones de esta revisión

- Se retiró `node_modules` del índice de Git; las dependencias se reproducen con `npm ci` y el lockfile. Los archivos locales no fueron eliminados por la retirada del índice.
- Se declaró `@apidevtools/swagger-parser` como dependencia de desarrollo directa. Las pruebas no dependen de que otra biblioteca lo instale indirectamente.
- El servidor valida `PORT`, informa el puerto real cuando se usa `0`, maneja puerto ocupado y permite detenerse con SIGTERM/SIGINT. La prueba de puerto ocupado detectó un fallo al leer `server.address()` desde el callback de Express 5; se corrigió usando el evento `listening`.
- Las rutas rechazan identificadores ambiguos como `1e0`, `1.0`, `0x1` o enteros fuera del rango seguro; responden 404 sin consultar o eliminar otra nota.
- Crear una nota devuelve `Location`, además de 201 y el recurso.
- OpenAPI incorpora ejemplos, cabecera Location y la ruta de documentación. Las rutas de IA pendientes no se presentan como implementadas.

## Comprobaciones reproducibles

```bash
npm ci
npm test
npx playwright install chromium
npm run test:browser
```

Para usar un Chromium ya instalado:

```bash
CHROMIUM_PATH=/usr/bin/chromium npm run test:browser
```

La prueba de navegador arranca una instancia temporal con puerto libre, interactúa con **Try it out → Execute**, comprueba respuestas y guarda seis capturas junto con `resultados.json` en `docs/evidencias/`. Cierra navegador y servidor al terminar. No necesita `.env` ni acceso a Claude. Genera sus propios datos de prueba, que se pierden al cerrar el proceso.

La suite HTTP y de proceso tiene **18 pruebas**, incluidas validación de OpenAPI, aislamiento de errores internos, conservación de notas tras rechazos, cuerpo excesivo, arranque desde otro directorio, puerto ocupado y apagado. No contiene pruebas de IA ni consume créditos.

El flujo `.github/workflows/test.yml` repite instalación y pruebas en Node.js 20 y 24. Se verificó instalación limpia y 18 pruebas en Node.js 20.20.2, además de las 18 aprobadas en Node.js 24.22.1; no se presenta la configuración del flujo como evidencia de una ejecución remota aprobada.

## Validación adicional y preparación de la exposición

- Node 20.20.2 se obtuvo de `nodejs.org` y su archivo se verificó contra el SHA-256 publicado en `SHASUMS256.txt`, conservando TLS. No se cambió el Node predeterminado del entorno.
- `docs/evidencias/node20/instalacion.txt` y `pruebas.txt` contienen las salidas de la instalación limpia y las 18 pruebas con ese runtime.
- `npm run test:dev` inicia el comando real de desarrollo y verifica creación 201, reinicio automático por cambio de archivo, colección vacía tras el reinicio y Swagger 200. El archivo de cambio es temporal; el script lo elimina y detiene los procesos que inició. El registro está en `docs/evidencias/desarrollo.json`.
- `docs/GUIA_EXPOSICION_PERSONA_A.md` explica el código y una demostración reproducible. `docs/PR_PERSONA_A.md` prepara el pull request y la lista de revisión sin atribuir aprobaciones a B.

## Límites de la entrega de A

La revisión de B y la fusión de ramas requieren participación real del compañero. No se inventan nombres, aprobaciones, conflictos, métricas de tokens ni capturas de Claude. A debe completar las pruebas cruzadas marcadas en la guía cuando B aporte su implementación y las credenciales se configuren localmente.

La auditoría `npm audit --omit=dev --audit-level=high` terminó con código 0, sin vulnerabilidades altas o críticas, y reportó tres avisos moderados en la cadena `swagger-jsdoc → glob → minimatch`. No se ejecutó `audit fix --force`, ya que propone cambiar la versión de Swagger. Los avisos moderados siguen pendientes de evaluación y actualización compatible; no se afirma que la auditoría esté limpia.
