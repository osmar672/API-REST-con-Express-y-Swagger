const Anthropic = require('@anthropic-ai/sdk');
const { AppError } = require('../utils/errors');

// Recibir un cliente permite probar el servicio sin consumir créditos.
function crearServicio(client) {
  return {
    async preguntar(texto, system) {
      const msg = await client.messages.create({
        model: process.env.CLAUDE_MODEL || 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        system: system ?? 'Eres un asistente útil. Responde en español.',
        messages: [{ role: 'user', content: texto }]
      });
      const respuesta = msg.content
        .filter((bloque) => bloque.type === 'text')
        .map((bloque) => bloque.text).join('\n');
      return { respuesta, uso: msg.usage };
    }
  };
}

let servicio;
async function preguntar(texto, system) {
  // Inicialización diferida: notas y Swagger arrancan incluso sin una clave.
  if (!process.env.ANTHROPIC_API_KEY?.trim()) {
    throw new AppError(502, 'IA_NO_DISPONIBLE');
  }
  if (!servicio) {
    const client = new Anthropic({ timeout: 30000, maxRetries: 1 });
    servicio = crearServicio(client);
  }
  return servicio.preguntar(texto, system);
}
module.exports = { preguntar, crearServicio };
