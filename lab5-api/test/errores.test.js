const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const handler = require('../src/middlewares/errorHandler');
const { AppError } = require('../src/utils/errors');

test('el manejador central conserva AppError y oculta detalles internos', async (t) => {
  const log = t.mock.method(console, 'error', () => {});
  const app = express();
  app.get('/controlado', () => { throw new AppError(404, 'Nota no encontrada'); });
  app.get('/inesperado', async () => { throw new Error('DETALLE_PRIVADO_DE_PRUEBA'); });
  app.use(handler);
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const controlled = await fetch(`${base}/controlado`);
  assert.equal(controlled.status, 404);
  assert.deepEqual(await controlled.json(), { error: 'Nota no encontrada' });
  const unexpected = await fetch(`${base}/inesperado`);
  assert.equal(unexpected.status, 500);
  assert.deepEqual(await unexpected.json(), { error: 'Error interno' });
  assert.equal(log.mock.callCount(), 1);
  assert.match(log.mock.calls[0].arguments[1].message, /DETALLE_PRIVADO_DE_PRUEBA/);
});
