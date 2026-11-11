require('dotenv').config();
const app = require('./app');

const valorPuerto = process.env.PORT ?? '3000';
if (!/^\d+$/.test(valorPuerto) || !Number.isInteger(Number(valorPuerto)) || Number(valorPuerto) > 65535) {
  console.error('PORT debe ser un entero entre 0 y 65535.');
  process.exit(1);
}

const server = app.listen(Number(valorPuerto));
server.once('listening', () => {
  console.log(`API iniciada en puerto ${server.address().port}; documentación en /api-docs`);
});
server.on('error', (error) => {
  console.error(`No se pudo iniciar la API: ${error.code || 'ERROR_SERVIDOR'}`);
  process.exitCode = 1;
});

// Permite detener el servidor sin interrumpir las solicitudes en curso.
function detener() {
  server.close(async () => {
    await require('./config/database').$disconnect();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 5000).unref();
}
process.once('SIGTERM', detener);
process.once('SIGINT', detener);
