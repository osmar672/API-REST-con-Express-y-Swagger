const temporary = require('../../scripts/lib/database-temporal')();
const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const db = require('../src/config/database');
const { createApp } = require('../src/app');
const Anthropic = require('@anthropic-ai/sdk');
const { crearServicio: servicioClaude } = require('../src/services/claude.service');
const { crearServicio: servicioConsumo } = require('../src/services/consumo.service');
const { crearServicio: servicioIA } = require('../src/services/ia.service');
const respuesta = (text = 'Respuesta simulada') => ({ respuesta: text, modelo: 'modelo-prueba', uso: { input_tokens: 100, output_tokens: 20 } });
function fixture({ tarifas = { entrada: 2, salida: 10 }, limit = 100 } = {}) {
  const calls = [];
  const claude = {
    async preguntar(messages, system) { calls.push({ messages, system }); return respuesta(); },
    async stream(messages, onText) { calls.push({ messages }); await onText('Hola '); await onText('mundo'); return respuesta('Hola mundo'); },
  };
  return { calls, claude, app: createApp({ db, claude, tarifas, rateLimit: { limit } }) };
}
before(() => temporary.ready);
after(() => temporary.close());
beforeEach(async () => {
  await db.mensaje.deleteMany(); await db.conversacion.deleteMany(); await db.consumo.deleteMany(); await db.nota.deleteMany();
});
const conversation = async (app) => (await request(app).post('/api/ia/conversaciones').expect(201)).body.id;

test('Supertest: pregunta registra tokens y costo calculado con tarifas explícitas', async () => {
  const { app, calls } = fixture();
  const response = await request(app).post('/api/ia/preguntar').send({ pregunta: ' Hola mundo ' }).expect(200);
  assert.equal(response.body.respuesta, 'Respuesta simulada');
  assert.deepEqual(calls[0].messages, [{ role: 'user', content: 'Hola mundo' }]);
  const daily = (await request(app).get('/api/ia/consumo').expect(200)).body;
  assert.equal(daily.solicitudes, 1); assert.equal(daily.inputTokens, 100); assert.equal(daily.outputTokens, 20);
  assert.equal(daily.costoEstimadoUsd, 0.0004);
  const saved = await db.consumo.findFirst(); assert.equal(saved.tarifaEntrada, 2); assert.equal(saved.tarifaSalida, 10);
});

test('Supertest: validación antes de Claude en preguntas, turnos y streaming', async () => {
  const { app, calls } = fixture(); const id = await conversation(app);
  for (const endpoint of ['/preguntar', `/conversaciones/${id}/mensajes`, `/conversaciones/${id}/stream`]) {
    for (const body of [{}, { pregunta: 'x' }, { pregunta: ' '.repeat(4) }, { pregunta: 'x'.repeat(2001) }]) {
      await request(app).post('/api/ia' + endpoint).send(body).expect(400);
    }
  }
  assert.equal(calls.length, 0); assert.equal(await db.consumo.count(), 0);
});

test('Supertest: envía el historial alternado y lo conserva entre instancias', async () => {
  const { app, calls, claude } = fixture(); const id = await conversation(app);
  await request(app).post(`/api/ia/conversaciones/${id}/mensajes`).send({ pregunta: 'Primera pregunta' }).expect(200);
  await request(app).post(`/api/ia/conversaciones/${id}/mensajes`).send({ pregunta: 'Segunda pregunta' }).expect(200);
  assert.deepEqual(calls[1].messages, [
    { role: 'user', content: 'Primera pregunta' }, { role: 'assistant', content: 'Respuesta simulada' }, { role: 'user', content: 'Segunda pregunta' },
  ]);
  const otherDb = require('../src/config/database').crearDatabase(temporary.url);
  try {
    const otherApp = createApp({ db: otherDb, claude, rateLimit: { limit: 100 } });
    const history = (await request(otherApp).get(`/api/ia/conversaciones/${id}`).expect(200)).body;
    assert.equal(history.mensajes.length, 4); assert.equal(history.mensajes[3].rol, 'assistant');
  } finally { await otherDb.$disconnect(); }
});

test('Supertest: historial aislado, conversación inexistente y límite de diez turnos', async () => {
  const { app, calls } = fixture(); const a = await conversation(app); const b = await conversation(app);
  for (let i = 0; i < 10; i++) await request(app).post(`/api/ia/conversaciones/${a}/mensajes`).send({ pregunta: `Pregunta ${i}` }).expect(200);
  await request(app).post(`/api/ia/conversaciones/${a}/mensajes`).send({ pregunta: 'Turno once' }).expect(409);
  assert.equal((await request(app).get(`/api/ia/conversaciones/${b}`).expect(200)).body.mensajes.length, 0);
  await request(app).post('/api/ia/conversaciones/inexistente/mensajes').send({ pregunta: 'Sin conversación' }).expect(404);
  assert.equal(calls.length, 10);
});

test('Supertest: resumen busca la nota antes de llamar a Claude', async () => {
  const { app, calls } = fixture();
  await request(app).post('/api/notas/999/resumen').expect(404); assert.equal(calls.length, 0);
  const note = await db.nota.create({ data: { titulo: 'Nota', contenido: 'Contenido de la nota' } });
  const r = await request(app).post(`/api/notas/${note.id}/resumen`).expect(200);
  assert.equal(r.body.notaId, note.id); assert.equal(r.body.resumen, 'Respuesta simulada');
  assert.equal(calls[0].messages[0].content, note.contenido); assert.match(calls[0].system, /3 viñetas/);
  assert.equal((await db.consumo.findFirst()).operacion, 'resumen');
});

for (const [providerStatus, status] of [[400, 502], [401, 502], [429, 429], [529, 503]]) {
  test(`Supertest: error Claude ${providerStatus} se traduce a ${status} sin filtrar detalles`, async (t) => {
    t.mock.method(console, 'error', () => {});
    const { app, claude } = fixture(); const id = await conversation(app);
    claude.preguntar = async () => { throw Anthropic.APIError.generate(providerStatus, { error: { message: 'SECRETO_SIMULADO' } }, 'SECRETO_SIMULADO', new Headers()); };
    const r = await request(app).post(`/api/ia/conversaciones/${id}/mensajes`).send({ pregunta: 'Fallará el proveedor' }).expect(status);
    assert.deepEqual(r.body, { error: 'IA_NO_DISPONIBLE' });
    assert.equal(await db.mensaje.count(), 0); assert.equal(await db.consumo.count(), 0);
  });
}

test('Supertest: límite compartido protege preguntas y resúmenes, sin confiar en X-Forwarded-For', async () => {
  const { app, calls } = fixture({ limit: 1 });
  await request(app).post('/api/ia/preguntar').send({ pregunta: 'Primera pregunta' }).expect(200);
  const note = await db.nota.create({ data: { titulo: 'Nota', contenido: 'Texto' } });
  const r = await request(app).post(`/api/notas/${note.id}/resumen`).set('X-Forwarded-For', '203.0.113.10').expect(429);
  assert.deepEqual(r.body, { error: 'LIMITE_IA_EXCEDIDO' }); assert.ok(r.headers['retry-after']); assert.equal(calls.length, 1);
  await request(app).get('/api/notas').expect(200);
});

test('Supertest: texto SSE llega antes de terminar el proveedor y persiste al finalizar', { timeout: 8000 }, async () => {
  const { app, claude } = fixture(); const id = await conversation(app);
  let received; const gate = new Promise((resolve) => { received = resolve; });
  claude.stream = async (messages, onText) => {
    await onText('Hola '); await gate; await onText('mundo'); return respuesta('Hola mundo');
  };
  const r = await request(app).post(`/api/ia/conversaciones/${id}/stream`).send({ pregunta: 'Texto incremental' }).buffer(true).parse((res, done) => {
    let text = ''; res.setEncoding('utf8');
    res.on('data', (chunk) => { text += chunk; if (text.includes('event: texto')) received(); });
    res.on('end', () => done(null, text)); res.on('error', done);
  }).expect(200);
  assert.match(r.headers['content-type'], /text\/event-stream/);
  assert.match(r.body, /event: texto/); assert.match(r.body, /Hola /); assert.match(r.body, /mundo/); assert.match(r.body, /event: fin/);
  assert.equal((await db.mensaje.findMany({ orderBy: { id: 'asc' } }))[1].contenido, 'Hola mundo');
  assert.equal((await db.consumo.findFirst()).operacion, 'stream');
});

test('Supertest: error tras emitir tokens produce evento SSE genérico y no guarda turno parcial', async (t) => {
  t.mock.method(console, 'error', () => {});
  const { app, claude } = fixture(); const id = await conversation(app);
  claude.stream = async (_, onText) => { await onText('Parcial'); throw Anthropic.APIError.generate(529, {}, 'DETALLE_PRIVADO', new Headers()); };
  const r = await request(app).post(`/api/ia/conversaciones/${id}/stream`).send({ pregunta: 'Streaming fallido' }).expect(200);
  assert.match(r.text, /event: error/); assert.match(r.text, /IA_NO_DISPONIBLE/); assert.doesNotMatch(r.text, /DETALLE_PRIVADO/);
  assert.equal(await db.mensaje.count(), 0); assert.equal(await db.consumo.count(), 0);
});

test('concurrencia: segundo turno obtiene 409 y un fallo libera la conversación', async () => {
  let finish; const pending = new Promise((resolve) => { finish = resolve; });
  let started; const start = new Promise((resolve) => { started = resolve; });
  const fake = { preguntar: async () => { started(); await pending; throw new Error('Fallo simulado'); } };
  const service = servicioIA(db, fake, servicioConsumo(db, null)); const c = await service.crear();
  const first = service.turno(c.id, 'Primer turno'); const rejected = assert.rejects(first, /Fallo simulado/);
  await start; await assert.rejects(service.turno(c.id, 'Segundo turno'), (e) => e.status === 409);
  finish(); await rejected;
  fake.preguntar = async () => respuesta(); await service.turno(c.id, 'Reintento válido');
  assert.equal(await db.mensaje.count(), 2);
});

test('cancelar streaming no persiste un turno incompleto y libera el bloqueo', async () => {
  const controller = new AbortController();
  const fake = { stream: async () => { controller.abort(); return respuesta(); }, preguntar: async () => respuesta() };
  const service = servicioIA(db, fake, servicioConsumo(db, null)); const c = await service.crear();
  await assert.rejects(service.turno(c.id, 'Cancelar turno', { signal: controller.signal, onText: async () => {} }), (e) => e.status === 499);
  assert.equal(await db.mensaje.count(), 0);
  await service.turno(c.id, 'Nuevo turno'); assert.equal(await db.mensaje.count(), 2);
});

test('consumo diario respeta fronteras UTC y no inventa tarifas', async () => {
  await db.consumo.createMany({ data: [
    { fecha: new Date('2026-11-10T23:59:59Z'), modelo: 'test', operacion: 'pregunta', inputTokens: 999, outputTokens: 999, costoUsd: 9 },
    { fecha: new Date('2026-11-11T00:00:00Z'), modelo: 'test', operacion: 'pregunta', inputTokens: 10, outputTokens: 5, costoUsd: 0.5 },
    { fecha: new Date('2026-11-11T23:59:59Z'), modelo: 'test', operacion: 'stream', inputTokens: 20, outputTokens: 6 },
    { fecha: new Date('2026-11-12T00:00:00Z'), modelo: 'test', operacion: 'pregunta', inputTokens: 999, outputTokens: 999, costoUsd: 9 },
  ] });
  const daily = await servicioConsumo(db, null).diario('2026-11-11');
  assert.equal(daily.solicitudes, 2); assert.equal(daily.inputTokens, 30); assert.equal(daily.outputTokens, 11);
  assert.equal(daily.costoEstimadoUsd, null); assert.equal(daily.subtotalConTarifaUsd, 0.5); assert.equal(daily.solicitudesSinTarifa, 1);
  const { app } = fixture();
  for (const fecha of ['2026-02-30', 'invalida', '2026-13-01']) await request(app).get('/api/ia/consumo').query({ fecha }).expect(400);
});

test('SQLite conserva una nota después de desconectar y abrir otro cliente Prisma', async () => {
  const note = await db.nota.create({ data: { titulo: 'Persistente', contenido: 'Sobrevive al proceso' } });
  const client = require('../src/config/database').crearDatabase(temporary.url);
  try { assert.deepEqual(await client.nota.findUnique({ where: { id: note.id } }), note); }
  finally { await client.$disconnect(); }
});

test('servicio Claude usa el SDK oficial con historial, system y texto incremental', async () => {
  let params, streamed;
  const final = { model: 'test', content: [{ type: 'text', text: 'Hola' }, { type: 'text', text: ' mundo' }], usage: { input_tokens: 8, output_tokens: 2 } };
  const runner = {
    async *[Symbol.asyncIterator]() { yield { type: 'content_block_delta', delta: { type: 'text_delta', text: 'Hola' } }; },
    async finalMessage() { return final; }, abort() {},
  };
  const client = { messages: { create: async (p) => { params = p; return final; }, stream: (p) => { streamed = p; return runner; } } };
  const claude = servicioClaude({ client, model: 'test' });
  const history = [{ role: 'user', content: 'Hola' }, { role: 'assistant', content: 'Hola' }, { role: 'user', content: 'Sigue' }];
  const r = await claude.preguntar(history, 'En tres viñetas');
  assert.deepEqual(params.messages, history); assert.equal(params.system, 'En tres viñetas'); assert.equal(params.max_tokens, 1024); assert.equal(r.respuesta, 'Hola mundo');
  let text = ''; await claude.stream(history, async (token) => { text += token; });
  assert.equal(text, 'Hola'); assert.deepEqual(streamed.messages, history);
});

test('un uso inválido del proveedor revierte mensajes y consumo en la misma transacción', async () => {
  const { app, claude } = fixture(); const id = await conversation(app);
  claude.preguntar = async () => ({ ...respuesta(), uso: { input_tokens: -1, output_tokens: 5 } });
  const r = await request(app).post(`/api/ia/conversaciones/${id}/mensajes`).send({ pregunta: 'Respuesta con uso inválido' }).expect(502);
  assert.deepEqual(r.body, { error: 'USO_IA_INVALIDO' });
  assert.equal(await db.mensaje.count(), 0); assert.equal(await db.consumo.count(), 0);
});

test('sin credencial el servicio falla antes de crear el cliente o contactar al proveedor', async () => {
  const previous = process.env.ANTHROPIC_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
  try {
    const claude = servicioClaude();
    await assert.rejects(claude.preguntar([{ role: 'user', content: 'Sin credencial' }]), (e) => e.status === 503 && e.message === 'IA_NO_CONFIGURADA');
  } finally {
    if (previous === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = previous;
  }
});
