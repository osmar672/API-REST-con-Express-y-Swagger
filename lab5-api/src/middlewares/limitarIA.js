const { rateLimit } = require('express-rate-limit');
module.exports = ({ limit = Number(process.env.IA_RATE_LIMIT || 10), windowMs = 60000 } = {}) => {
  if (!Number.isSafeInteger(limit) || limit < 1) throw new Error('IA_RATE_LIMIT debe ser un entero positivo.');
  return rateLimit({ windowMs, limit, standardHeaders: 'draft-8', legacyHeaders: false,
    message: { error: 'LIMITE_IA_EXCEDIDO' },
  });
};
