// Comprobación opcional de npm run dev en Linux/macOS; no necesita Claude.
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const { setTimeout: delay } = require('node:timers/promises');

async function main() {
  if (process.platform === 'win32') throw new Error('Esta comprobación usa grupos de procesos POSIX. Ejecutar en Linux, macOS o WSL.');
  const root = path.resolve(__dirname, '..');
  const marker = path.join(root, 'lab5-api/src/utils', `verificar-dev-${randomUUID()}.js`);
  let created = false;
  const child = spawn('npm', ['run', 'dev'], {
    cwd: root, env: { ...process.env, PORT: '0', NO_COLOR: '1' },
    detached: true, stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  let startupError;
  child.on('error', (error) => { startupError = error; });
  child.stdout.on('data', (data) => { output += data.toString(); });
  child.stderr.on('data', (data) => { output += data.toString(); });
  const exit = new Promise((resolve) => child.once('close', resolve));
  async function waitForStart(count) {
    const deadline = Date.now() + 15000;
    while (Date.now() < deadline) {
      if (startupError) throw startupError;
      const starts = [...output.matchAll(/API iniciada en puerto (\d+)/g)];
      if (starts.length >= count) return Number(starts[count - 1][1]);
      if (child.exitCode !== null) throw new Error(`npm run dev terminó inesperadamente: ${output}`);
      await delay(100);
    }
    throw new Error(`No se observó el arranque ${count}: ${output}`);
  }
  let result;
  try {
    const initial = await waitForStart(1);
    const response = await fetch(`http://127.0.0.1:${initial}/api/notas`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ titulo: 'Prueba de recarga', contenido: 'Se pierde al reiniciar.' }),
    });
    assert.equal(response.status, 201);
    assert.equal((await response.json()).titulo, 'Prueba de recarga');
    await fs.writeFile(marker, '// Archivo temporal para comprobar el observador de nodemon.\n', { flag: 'wx' });
    created = true;
    const restarted = await waitForStart(2);
    assert.match(output, /restarting due to changes/);
    const list = await fetch(`http://127.0.0.1:${restarted}/api/notas`);
    assert.equal(list.status, 200);
    assert.deepEqual(await list.json(), []);
    const docs = await fetch(`http://127.0.0.1:${restarted}/api-docs/`);
    assert.equal(docs.status, 200);
    assert.match(await docs.text(), /Swagger UI/);
    result = { node: process.version, command: 'npm run dev', initialCreateStatus: 201, restartObserved: true, notesAfterRestart: [], swaggerAfterRestartStatus: 200 };
  } finally {
    if (child.pid) {
      try { process.kill(-child.pid, 'SIGTERM'); } catch (error) { if (error.code !== 'ESRCH') throw error; }
      const stopped = await Promise.race([exit.then(() => true), delay(6000, false, { ref: false })]);
      if (!stopped) {
        try { process.kill(-child.pid, 'SIGKILL'); } catch (error) { if (error.code !== 'ESRCH') throw error; }
        await exit;
      }
    }
    if (created) await fs.unlink(marker);
  }
  const evidence = path.join(root, 'docs/evidencias/desarrollo.json');
  await fs.mkdir(path.dirname(evidence), { recursive: true });
  await fs.writeFile(evidence, JSON.stringify(result, null, 2) + '\n');
  console.log('npm run dev: creación 201, recarga automática, memoria reiniciada y Swagger 200. Procesos y archivo temporal cerrados.');
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
