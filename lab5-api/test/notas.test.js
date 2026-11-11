const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const app = require('../src/app');
let server, base;
before(async () => {
  server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => new Promise((resolve) => server.close(resolve)));
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

test('buscar(id) entrega copias y lanza AppError 404 para la integración con B', () => {
  const service = require('../src/services/notas.service');
  const { AppError } = require('../src/utils/errors');
  const nota = service.crear({ titulo: 'Contrato B', contenido: 'Resumen futuro' });
  const copy = service.buscar(nota.id);
  copy.contenido = 'Cambio externo';
  assert.equal(service.buscar(nota.id).contenido, 'Resumen futuro');
  assert.throws(() => service.buscar(999999), (err) => err instanceof AppError && err.status === 404);
});
