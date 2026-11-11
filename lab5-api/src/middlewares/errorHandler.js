const Anthropic = require('@anthropic-ai/sdk');
const { AppError } = require('../utils/errors');

// Express 5 envía aquí también los rechazos de las rutas async.
module.exports = (err, req, res, next) => {
  if (res.headersSent) return next(err);
  if (err instanceof AppError) return res.status(err.status).json({ error: err.message });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'JSON inválido' });
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Cuerpo demasiado grande' });
  if (err instanceof Anthropic.APIError || err instanceof Anthropic.APIConnectionError) {
    // Solo se registra estado y tipo; el mensaje del proveedor nunca llega al cliente.
    console.error('Claude API:', err.status ?? 'CONEXION', err.name);
    const status = err.status === 429 ? 429 : err.status === 529 ? 503 : 502;
    return res.status(status).json({ error: 'IA_NO_DISPONIBLE' });
  }
  console.error('Error interno:', err);
  res.status(500).json({ error: 'Error interno' });
};
