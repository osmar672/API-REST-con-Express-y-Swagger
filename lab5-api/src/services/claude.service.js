const Anthropic = require('@anthropic-ai/sdk');
const { AppError } = require('../utils/errors');
const SYSTEM = 'Eres un asistente útil. Responde en español.';

function crearServicio({ client, model = process.env.CLAUDE_MODEL || 'claude-haiku-4-5-20251001' } = {}) {
  function obtenerCliente() {
    if (!client) {
      if (!process.env.ANTHROPIC_API_KEY) throw new AppError(503, 'IA_NO_CONFIGURADA');
      client = new Anthropic({ timeout: 45000, maxRetries: 0 });
    }
    return client;
  }
  const parametros = (messages, system) => ({ model, max_tokens: 1024, system: system || SYSTEM, messages });
  function resultado(msg) {
    return { respuesta: msg.content.filter((b) => b.type === 'text').map((b) => b.text).join(''), uso: msg.usage, modelo: msg.model || model };
  }
  async function preguntar(messages, system) {
    return resultado(await obtenerCliente().messages.create(parametros(messages, system)));
  }
  async function stream(messages, onText, { signal, system } = {}) {
    const runner = obtenerCliente().messages.stream(parametros(messages, system), { signal });
    try {
      for await (const event of runner) {
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
          await onText(event.delta.text);
        }
      }
      return resultado(await runner.finalMessage());
    } finally {
      if (signal?.aborted) runner.abort();
    }
  }
  return { preguntar, stream };
}
module.exports = { ...crearServicio(), crearServicio };
