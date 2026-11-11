const { test } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const Anthropic = require('@anthropic-ai/sdk');
const OpenAI = require('openai');
const app = require('../src/app');
const claude = require('../src/services/claude.service');
const spec = require('../src/config/swagger');

// Todas las pruebas simulan Claude: no consumen créditos ni necesitan API key.

test('el servicio arma messages.create y extrae texto y tokens', async () => {
  let parametros;
  const servicio = claude.crearServicio({
    messages: {
      create: async (p) => {
        parametros = p;
        return { content: [{ type: 'text', text: 'Uno' }, { type: 'text', text: 'Dos' }], usage: { input_tokens: 10, output_tokens: 20 } };
      },
    },
  });
  const r = await servicio.preguntar('Contenido', 'Resume en una frase.');
  assert.equal(parametros.max_tokens, 1024);
  assert.equal(parametros.model, process.env.CLAUDE_MODEL || 'claude-haiku-4-5-20251001');
  assert.equal(parametros.system, 'Resume en una frase.');
  assert.deepEqual(parametros.messages, [{ role: 'user', content: 'Contenido' }]);
  assert.deepEqual(r, { respuesta: 'Uno\nDos', uso: { input_tokens: 10, output_tokens: 20 } });
});

test('con Groq arma chat.completions.create y normaliza los tokens', async () => {
  let parametros;
  const servicio = claude.crearServicio({
    chat: {
      completions: {
        create: async (p) => {
          parametros = p;
          return { choices: [{ message: { content: 'Hola' } }], usage: { prompt_tokens: 7, completion_tokens: 3 } };
        },
      },
    },
  }, 'groq');
  const r = await servicio.preguntar('Pregunta', 'Responde breve.');
  assert.equal(parametros.max_tokens, 1024);
  assert.equal(parametros.model, process.env.GROQ_MODEL || 'llama-3.3-70b-versatile');
  assert.deepEqual(parametros.messages, [{ role: 'system', content: 'Responde breve.' }, { role: 'user', content: 'Pregunta' }]);
  assert.deepEqual(r, { respuesta: 'Hola', uso: { input_tokens: 7, output_tokens: 3 } });
});

test('errores de Groq: 401 -> 502, 429 -> 429, 503 -> 503, sin detalles', async (t) => {
  let status;
  t.mock.method(claude, 'preguntar', async () => {
    throw OpenAI.APIError.generate(status, { error: { message: 'DETALLE_PRIVADO' } }, 'DETALLE_PRIVADO', new Headers());
  });
  t.mock.method(console, 'error', () => {});
  for (const [original, esperado] of [[401, 502], [400, 502], [429, 429], [503, 503]]) {
    status = original;
    await request(app).post('/api/ia/preguntar').send({ pregunta: 'Hola mundo' }).expect(esperado, { error: 'IA_NO_DISPONIBLE' });
  }
});

test('con LLM_PROVIDER=groq y sin GROQ_API_KEY la IA devuelve 502', async () => {
  const anterior = { p: process.env.LLM_PROVIDER, k: process.env.GROQ_API_KEY };
  process.env.LLM_PROVIDER = 'groq';
  delete process.env.GROQ_API_KEY;
  try {
    await request(app).post('/api/ia/preguntar').send({ pregunta: 'Hola mundo' }).expect(502, { error: 'IA_NO_DISPONIBLE' });
  } finally {
    if (anterior.p === undefined) delete process.env.LLM_PROVIDER; else process.env.LLM_PROVIDER = anterior.p;
    if (anterior.k !== undefined) process.env.GROQ_API_KEY = anterior.k;
  }
});

test('POST /api/ia/preguntar valida antes de llamar y devuelve respuesta y uso', async (t) => {
  const mock = t.mock.method(claude, 'preguntar', async () => ({ respuesta: 'Simulada', uso: { input_tokens: 1, output_tokens: 2 } }));
  for (const body of [{}, { pregunta: 'a' }, { pregunta: '   ' }, { pregunta: 123 }, { pregunta: 'x'.repeat(2001) }]) {
    await request(app).post('/api/ia/preguntar').send(body).expect(400);
  }
  assert.equal(mock.mock.callCount(), 0);
  const r = await request(app).post('/api/ia/preguntar').send({ pregunta: ' ¿Qué es REST? ' }).expect(200);
  assert.deepEqual(r.body, { respuesta: 'Simulada', uso: { input_tokens: 1, output_tokens: 2 } });
  assert.equal(mock.mock.calls[0].arguments[0], '¿Qué es REST?');
});

test('POST /api/notas/:id/resumen busca la nota primero y usa el system de tres viñetas', async (t) => {
  const mock = t.mock.method(claude, 'preguntar', async () => ({ respuesta: '- Uno\n- Dos\n- Tres', uso: {} }));
  await request(app).post('/api/notas/999999/resumen').expect(404, { error: 'Nota no encontrada' });
  await request(app).post('/api/notas/abc/resumen').expect(404);
  assert.equal(mock.mock.callCount(), 0);
  const nota = await request(app).post('/api/notas').send({ titulo: 'Prueba', contenido: 'Texto a resumir' }).expect(201);
  const r = await request(app).post(`/api/notas/${nota.body.id}/resumen`).expect(200);
  assert.deepEqual(r.body, { notaId: nota.body.id, resumen: '- Uno\n- Dos\n- Tres' });
  assert.deepEqual(mock.mock.calls[0].arguments, ['Texto a resumir', 'Resume el texto en 3 viñetas breves, en español.']);
});

test('errores de Claude: 401/400 -> 502, 429 -> 429, 529 -> 503, sin detalles', async (t) => {
  let status;
  t.mock.method(claude, 'preguntar', async () => {
    throw new Anthropic.APIError(status, { error: { message: 'DETALLE_PRIVADO' } }, undefined, new Headers());
  });
  t.mock.method(console, 'error', () => {});
  for (const [original, esperado] of [[401, 502], [400, 502], [429, 429], [529, 503]]) {
    status = original;
    await request(app).post('/api/ia/preguntar').send({ pregunta: 'Hola mundo' }).expect(esperado, { error: 'IA_NO_DISPONIBLE' });
  }
});

test('fallo de conexión con el proveedor devuelve 502 sin detalles', async (t) => {
  t.mock.method(claude, 'preguntar', async () => { throw new Anthropic.APIConnectionError({ message: 'Privado' }); });
  t.mock.method(console, 'error', () => {});
  await request(app).post('/api/ia/preguntar').send({ pregunta: 'Hola mundo' }).expect(502, { error: 'IA_NO_DISPONIBLE' });
});

test('sin API key funcionan Swagger y notas, y la IA devuelve 502', async () => {
  const anterior = process.env.ANTHROPIC_API_KEY;
  const proveedor = process.env.LLM_PROVIDER;
  delete process.env.ANTHROPIC_API_KEY;
  process.env.LLM_PROVIDER = 'claude';
  try {
    await request(app).get('/api-docs/').expect(200);
    await request(app).get('/api/notas').expect(200);
    await request(app).post('/api/ia/preguntar').send({ pregunta: 'Hola mundo' }).expect(502, { error: 'IA_NO_DISPONIBLE' });
  } finally {
    if (anterior !== undefined) process.env.ANTHROPIC_API_KEY = anterior;
    if (proveedor === undefined) delete process.env.LLM_PROVIDER; else process.env.LLM_PROVIDER = proveedor;
  }
});

test('Swagger documenta los siete endpoints y los esquemas de IA', () => {
  for (const [ruta, metodo] of [
    ['/api/notas', 'get'], ['/api/notas', 'post'], ['/api/notas/{id}', 'get'], ['/api/notas/{id}', 'delete'],
    ['/api/ia/preguntar', 'post'], ['/api/notas/{id}/resumen', 'post'], ['/api-docs', 'get'],
  ]) assert.ok(spec.paths[ruta]?.[metodo], `${metodo.toUpperCase()} ${ruta}`);
  for (const nombre of ['Pregunta', 'RespuestaIA', 'UsoTokens', 'ResumenNota']) assert.ok(spec.components.schemas[nombre], nombre);
  assert.deepEqual(spec.paths['/api/ia/preguntar'].post.tags, ['IA']);
});
