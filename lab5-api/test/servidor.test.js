const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const path = require('node:path');
const os = require('node:os');

const entry = path.resolve(__dirname, '../src/index.js');
function iniciar(t, port) {
  const child = spawn(process.execPath, [entry], {
    cwd: os.tmpdir(), env: { ...process.env, PORT: String(port) }, stdio: ['ignore', 'pipe', 'pipe'],
  });
  t.after(() => { if (child.exitCode === null) child.kill('SIGKILL'); });
  return child;
}
function esperarPuerto(child) {
  return new Promise((resolve, reject) => {
    let output = '';
    child.stdout.on('data', (data) => {
      output += data;
      const match = output.match(/API iniciada en puerto (\d+)/);
      if (match) resolve(Number(match[1]));
    });
    child.once('error', reject);
    child.once('exit', (code) => reject(new Error(`El proceso terminó antes de arrancar: ${code}`)));
  });
}

test('index arranca desde otro directorio, sirve Swagger y se detiene con SIGTERM', { timeout: 10000 }, async (t) => {
  const child = iniciar(t, 0);
  const port = await esperarPuerto(child);
  assert.ok(port > 0);
  const base = `http://127.0.0.1:${port}`;
  assert.deepEqual(await (await fetch(`${base}/api/notas`)).json(), []);
  const script = await fetch(`${base}/api-docs/swagger-ui-init.js`);
  assert.equal(script.status, 200);
  assert.match(await script.text(), /\/api\/notas/);
  const exit = once(child, 'exit');
  child.kill('SIGTERM');
  assert.deepEqual(await exit, [0, null]);
});

for (const port of ['abc', '-1', '65536', '3.5', '']) {
  test(`index rechaza PORT=${JSON.stringify(port)}`, { timeout: 5000 }, async (t) => {
    const child = iniciar(t, port);
    let error = '';
    child.stderr.on('data', (data) => { error += data; });
    const [code] = await once(child, 'exit');
    assert.equal(code, 1);
    assert.match(error, /PORT debe ser un entero/);
  });
}

test('puerto ocupado produce salida fallida y error comprensible', { timeout: 10000 }, async (t) => {
  const first = iniciar(t, 0);
  const port = await esperarPuerto(first);
  const second = iniciar(t, port);
  let error = '';
  second.stderr.on('data', (data) => { error += data; });
  const [code] = await once(second, 'exit');
  assert.equal(code, 1);
  assert.match(error, /EADDRINUSE/);
});
