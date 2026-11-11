const Anthropic = require('@anthropic-ai/sdk');
const { AppError } = require('../utils/errors');
function respuestaError(err) {
  if (err instanceof AppError) return { status: err.status, error: err.message };
  if (err instanceof Anthropic.APIError) return { status: err.status === 429 ? 429 : err.status === 529 ? 503 : 502, error: 'IA_NO_DISPONIBLE' };
  if (err instanceof Anthropic.APIConnectionError) return { status: 502, error: 'IA_NO_DISPONIBLE' };
  if (err.type === 'entity.parse.failed') return { status: 400, error: 'JSON inválido' };
  if (err.type === 'entity.too.large') return { status: 413, error: 'Cuerpo demasiado grande' };
  return { status: 500, error: 'Error interno' };
}
module.exports = (err, req, res, next) => {
  if (res.headersSent) return next(err);
  const result = respuestaError(err);
  if (err instanceof Anthropic.APIError || err instanceof Anthropic.APIConnectionError) {
    console.error('Claude API:', err.status || 'CONEXION');
  } else if (result.status === 500) console.error('Error interno:', err);
  res.status(result.status).json({ error: result.error });
};
module.exports.respuestaError = respuestaError;
