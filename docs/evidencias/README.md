# Evidencias por fase

- `extras/pruebas-node20.txt` y `extras/pruebas-node24.txt`: suite actual de 37 casos aprobados con persistencia e IA simulada.
- `extras/instalacion-node20.txt`: instalación limpia y generación de Prisma para esta fase.
- `extras/migraciones.txt`: aplicación idempotente de las migraciones actuales.
- `desarrollo.json`: comprobación actual de nodemon; contiene la nota que se conserva en SQLite tras reiniciar.
- `01-crear-nota.png` a `06-nota-eliminada.png` y `resultados.json`: seis operaciones del CRUD realizadas desde Swagger/Chromium; regeneradas en la fase de extras usando SQLite temporal.
- `node20/` y `desarrollo-node24.json`: registros históricos anteriores a Prisma. Aquella fase usaba memoria; no representan la persistencia actual.

Las respuestas del proveedor incluidas en las pruebas de extras son simuladas. No se aportan capturas ni tokens facturados de Claude real.
