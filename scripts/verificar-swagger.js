// Prueba opcional de navegador. No requiere Claude ni un servidor externo.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs/promises');
const temporary = require('./lib/database-temporal')();
const app = require('../lab5-api/src/app');

async function main() {
  await temporary.ready;
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  let browser;
  try {
    browser = await chromium.launch({
      headless: true,
      ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
    });
    const page = await browser.newPage({ viewport: { width: 1366, height: 1000 }, deviceScaleFactor: 1 });
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const base = `http://127.0.0.1:${server.address().port}`;
    const output = path.resolve(__dirname, '../docs/evidencias');
    await fs.mkdir(output, { recursive: true });
    await page.goto(`${base}/api-docs/`);
    await page.locator('#operations-Notas-post_api_notas').waitFor();
    const results = [];

    async function execute(selector, { body, id, status, capture }) {
      const operation = page.locator(selector);
      if (!(await operation.locator('.opblock-body').isVisible())) {
        await operation.locator('.opblock-summary').click();
      }
      const tryButton = operation.locator('.try-out__btn').first();
      if ((await tryButton.textContent()).trim() === 'Try it out') await tryButton.click();
      if (body !== undefined) await operation.locator('textarea').fill(JSON.stringify(body, null, 2));
      if (id !== undefined) await operation.locator('input[type="text"]').fill(String(id));
      const responsePromise = page.waitForResponse((response) => response.url().startsWith(`${base}/api/notas`) && response.request().method() !== 'OPTIONS');
      await operation.getByRole('button', { name: 'Execute', exact: true }).click();
      const response = await responsePromise;
      assert.equal(response.status(), status);
      await operation.locator('.responses-inner .response-col_status').filter({ hasText: String(status) }).first().waitFor();
      const data = status === 204 ? null : await response.json();
      await operation.screenshot({ path: path.join(output, capture) });
      results.push({ method: response.request().method(), path: new URL(response.url()).pathname, status, capture });
      return data;
    }

    const note = await execute('#operations-Notas-post_api_notas', {
      body: { titulo: 'Prueba desde Swagger UI', contenido: 'Creación real mediante Try it out y Execute.' }, status: 201, capture: '01-crear-nota.png',
    });
    assert.equal(note.titulo, 'Prueba desde Swagger UI');
    const list = await execute('#operations-Notas-get_api_notas', { status: 200, capture: '02-listar-notas.png' });
    assert.deepEqual(list, [note]);
    const found = await execute('#operations-Notas-get_api_notas__id_', { id: note.id, status: 200, capture: '03-consultar-nota.png' });
    assert.deepEqual(found, note);
    const invalid = await execute('#operations-Notas-post_api_notas', { body: {}, status: 400, capture: '04-validacion-zod.png' });
    assert.equal(invalid.errores.length, 2);
    await execute('#operations-Notas-delete_api_notas__id_', { id: note.id, status: 204, capture: '05-eliminar-nota.png' });
    const missing = await execute('#operations-Notas-get_api_notas__id_', { id: note.id, status: 404, capture: '06-nota-eliminada.png' });
    assert.deepEqual(missing, { error: 'Nota no encontrada' });
    assert.deepEqual(errors, []);
    await fs.writeFile(path.join(output, 'resultados.json'), JSON.stringify({ browser: 'Chromium', cases: results, pageErrors: errors }, null, 2) + '\n');
    console.log('Swagger UI: 6 operaciones verificadas desde el navegador; capturas en docs/evidencias.');
  } finally {
    if (browser) await browser.close();
    await new Promise((resolve) => server.close(resolve));
    await temporary.close();
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
