const Anthropic = require('@anthropic-ai/sdk');
const OpenAI = require('openai');
const { AppError } = require('../utils/errors');

// Único módulo que habla con el modelo. LLM_PROVIDER en .env elige el proveedor
// (groq o claude) sin tocar rutas ni controladores.
const PROVEEDORES = {
  claude: {
    variableClave: 'ANTHROPIC_API_KEY',
    modelo: () => process.env.CLAUDE_MODEL || 'claude-haiku-4-5-20251001',
    crearCliente: () => new Anthropic({ timeout: 30000, maxRetries: 1 }),
  },
  groq: {
    variableClave: 'GROQ_API_KEY',
    modelo: () => process.env.GROQ_MODEL || 'openai/gpt-oss-20b',
    // Groq es compatible con la API de OpenAI: basta con cambiar baseURL.
    crearCliente: () => new OpenAI({
      baseURL: 'https://api.groq.com/openai/v1',
      apiKey: process.env.GROQ_API_KEY,
      timeout: 30000,
      maxRetries: 1,
    }),
  },
};
const SYSTEM_POR_DEFECTO = 'Eres un asistente útil. Responde en español.';

// Recibir el cliente permite probar el servicio sin consumir créditos.
function crearServicio(client, proveedor = 'claude') {
  return {
    async preguntar(texto, system) {
      const model = PROVEEDORES[proveedor].modelo();
      const instrucciones = system ?? SYSTEM_POR_DEFECTO;

      if (proveedor === 'groq') {
        const r = await client.chat.completions.create({
          model,
          max_tokens: 1024,
          messages: [
            { role: 'system', content: instrucciones },
            { role: 'user', content: texto },
          ],
        });
        // Se normaliza el uso al mismo formato que Claude para no cambiar el contrato.
        return {
          respuesta: r.choices[0]?.message?.content ?? '',
          uso: { input_tokens: r.usage?.prompt_tokens ?? 0, output_tokens: r.usage?.completion_tokens ?? 0 },
        };
      }

      const msg = await client.messages.create({
        model,
        max_tokens: 1024,
        system: instrucciones,
        messages: [{ role: 'user', content: texto }],
      });
      const respuesta = msg.content
        .filter((bloque) => bloque.type === 'text')
        .map((bloque) => bloque.text).join('\n');
      return { respuesta, uso: msg.usage };
    },
  };
}

function proveedorActual() {
  const nombre = (process.env.LLM_PROVIDER || 'claude').trim().toLowerCase();
  if (!PROVEEDORES[nombre]) {
    console.error(`LLM_PROVIDER inválido: ${nombre}. Use "groq" o "claude".`);
    throw new AppError(502, 'IA_NO_DISPONIBLE');
  }
  return nombre;
}

const servicios = {};
async function preguntar(texto, system) {
  const proveedor = proveedorActual();
  // Inicialización diferida: notas y Swagger arrancan incluso sin una clave.
  if (!process.env[PROVEEDORES[proveedor].variableClave]?.trim()) {
    throw new AppError(502, 'IA_NO_DISPONIBLE');
  }
  servicios[proveedor] ??= crearServicio(PROVEEDORES[proveedor].crearCliente(), proveedor);
  return servicios[proveedor].preguntar(texto, system);
}

module.exports = { preguntar, crearServicio };
