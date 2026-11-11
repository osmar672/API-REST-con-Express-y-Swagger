const temporary = require('../../scripts/lib/database-temporal')();
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const app = require('../src/app');
let server, base;
before(async () => {
  await temporary.ready;
  server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => { await new Promise((resolve) => server.close(resolve)); await temporary.close(); });
const post = (body) => fetch(`${base}/api/notas`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

test('CRUD: crear dos notas, listar, buscar y eliminar sin reutilizar ids', async () => {
  const first = await post({ titulo: ' Primera ', contenido: ' Texto ', extra: 'descartar' });
  assert.equal(first.status, 201);
  const a = await first.json();
  assert.deepEqual(a, { id: a.id, titulo: 'Primera', contenido: 'Texto' });
  const second = await post({ titulo: 'Segunda', contenido: 'Contenido' });
  assert.equal(second.status, 201);
  const b = await second.json();
  assert.deepEqual(await (await fetch(`${base}/api/notas`)).json(), [a, b]);
  const found = await fetch(`${base}/api/notas/${a.id}`);
  assert.equal(found.status, 200);
  assert.deepEqual(await found.json(), a);
  const deleted = await fetch(`${base}/api/notas/${b.id}`, { method: 'DELETE' });
  assert.equal(deleted.status, 204);
  assert.equal(await deleted.text(), '');
  assert.equal((await fetch(`${base}/api/notas/${b.id}`)).status, 404);
  assert.equal((await fetch(`${base}/api/notas/${b.id}`, { method: 'DELETE' })).status, 404);
  const c = await (await post({ titulo: 'Tercera', contenido: 'Texto' })).json();
  assert.ok(c.id > b.id);
});

test('Zod rechaza cuerpos vacíos, tipos incorrectos, blancos y longitudes excesivas', async () => {
  for (const body of [{}, null, [], { titulo: 1, contenido: 'x' }, { titulo: '   ', contenido: 'x' }, { titulo: 'x', contenido: '' }, { titulo: 'x'.repeat(101), contenido: 'x' }, { titulo: 'x', contenido: 'x'.repeat(5001) }]) {
    const response = await post(body);
    assert.equal(response.status, 400);
    const data = await response.json();
    assert.ok(data.error || data.errores?.length);
  }
  assert.equal((await post({ titulo: 'x'.repeat(100), contenido: 'x'.repeat(5000) })).status, 201);
});

test('ids inexistentes o inválidos responden 404 uniforme', async () => {
  for (const id of ['99', 'abc', '0', '-1', '1.5']) {
    for (const method of ['GET', 'DELETE']) {
      const response = await fetch(`${base}/api/notas/${id}`, { method });
      assert.equal(response.status, 404);
      assert.deepEqual(await response.json(), { error: 'Nota no encontrada' });
    }
  }
});

test('JSON mal formado y rutas desconocidas tienen errores controlados', async () => {
  const response = await fetch(`${base}/api/notas`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{' });
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: 'JSON inválido' });
  assert.equal((await fetch(`${base}/no-existe`)).status, 404);
});

test('Swagger UI sirve HTML y documenta las cuatro operaciones de notas', async () => {
  const response = await fetch(`${base}/api-docs/`);
  assert.equal(response.status, 200);
  assert.match(await response.text(), /Swagger UI/);
  const spec = require('../src/config/swagger');
  assert.equal(spec.openapi, '3.0.0');
  for (const method of ['get', 'post']) assert.ok(spec.paths['/api/notas'][method]);
  for (const method of ['get', 'delete']) assert.ok(spec.paths['/api/notas/{id}'][method]);
  await require('@apidevtools/swagger-parser').validate(spec);
});

test('buscar(id) entrega copias y lanza AppError 404 para la integración con B', async () => {
  const service = require('../src/services/notas.service');
  const { AppError } = require('../src/utils/errors');
  const nota = await service.crear({ titulo: 'Contrato B', contenido: 'Resumen futuro' });
  const copy = await service.buscar(nota.id);
  copy.contenido = 'Cambio externo';
  assert.equal((await service.buscar(nota.id)).contenido, 'Resumen futuro');
  await assert.rejects(() => service.buscar(999999), (err) => err instanceof AppError && err.status === 404);
});

test('no interpreta representaciones ambiguas de id como notas existentes', async () => {
  const nota = await (await post({ titulo: 'Identificador', contenido: 'Texto' })).json();
  for (const id of [`0${nota.id}`, `${nota.id}.0`, `${nota.id}e0`, `0x${nota.id.toString(16)}`, '2147483648', '9999999999999', '9007199254740992']) {
    for (const method of ['GET', 'DELETE']) {
      assert.equal((await fetch(`${base}/api/notas/${id}`, { method })).status, 404);
    }
  }
  assert.equal((await fetch(`${base}/api/notas/${nota.id}`)).status, 200);
});

test('crear publica Location y los errores de validación no alteran las notas', async () => {
  const before = await (await fetch(`${base}/api/notas`)).json();
  const response = await post({ titulo: '', contenido: 'Inválido' });
  assert.equal(response.status, 400);
  const data = await response.json();
  assert.ok(data.errores.some((issue) => issue.path.includes('titulo')));
  assert.deepEqual(await (await fetch(`${base}/api/notas`)).json(), before);
  const valid = await post({ titulo: 'Recurso', contenido: 'Ubicación' });
  const nota = await valid.json();
  assert.equal(valid.headers.get('location'), `/api/notas/${nota.id}`);
  assert.deepEqual(await (await fetch(base + valid.headers.get('location'))).json(), nota);
});

test('cuerpo excesivo devuelve 413 sin insertar datos', async () => {
  const before = await (await fetch(`${base}/api/notas`)).json();
  const response = await post({ titulo: 'Grande', contenido: 'x'.repeat(110000) });
  assert.equal(response.status, 413);
  assert.deepEqual(await response.json(), { error: 'Cuerpo demasiado grande' });
  assert.deepEqual(await (await fetch(`${base}/api/notas`)).json(), before);
});

test('eliminar una nota conserva las demás y listar entrega copias', async () => {
  const service = require('../src/services/notas.service');
  const a = await service.crear({ titulo: 'Mantener', contenido: 'A' });
  const b = await service.crear({ titulo: 'Eliminar', contenido: 'B' });
  const c = await service.crear({ titulo: 'Mantener', contenido: 'C' });
  await service.eliminar(b.id);
  const list = await service.listar();
  assert.ok(list.some((n) => n.id === a.id));
  assert.ok(list.some((n) => n.id === c.id));
  assert.ok(!list.some((n) => n.id === b.id));
  list.find((n) => n.id === a.id).titulo = 'Cambio externo';
  list.length = 0;
  assert.equal((await service.buscar(a.id)).titulo, 'Mantener');
});
