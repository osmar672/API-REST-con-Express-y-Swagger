const { AppError } = require('../utils/errors');

// El integrante B ampliará este manejador con los errores de Claude.
module.exports = (err, req, res, next) => {
  if (res.headersSent) return next(err);
  if (err instanceof AppError) return res.status(err.status).json({ error: err.message });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'JSON inválido' });
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Cuerpo demasiado grande' });
  console.error('Error interno:', err);
  res.status(500).json({ error: 'Error interno' });
};
