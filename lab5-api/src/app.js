const express = require('express');
const swaggerUi = require('swagger-ui-express');
const spec = require('./config/swagger');
const errorHandler = require('./middlewares/errorHandler');
const database = require('./config/database');
const crearLimitador = require('./middlewares/limitarIA');
function createApp({ db = database, claude = require('./services/claude.service'), rateLimit, tarifas } = {}) {
  const notas = require('./services/notas.service').crearServicio(db);
  const consumo = require('./services/consumo.service').crearServicio(db, tarifas);
  const ia = require('./services/ia.service').crearServicio(db, claude, consumo);
  const limitarIA = crearLimitador(rateLimit);
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json());
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(spec));
  app.use('/api/notas', require('./routes/notas.routes')(notas, claude, consumo, limitarIA));
  app.use('/api/ia', limitarIA, require('./routes/ia.routes')(ia, consumo));
  app.use((req, res) => res.status(404).json({ error: 'Ruta no encontrada' }));
  app.use(errorHandler);
  return app;
}
module.exports = createApp();
module.exports.createApp = createApp;
