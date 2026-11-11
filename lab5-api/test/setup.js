// Se carga antes de cada archivo de prueba (node --test --require).
// Crea una base SQLite temporal y vacía para no tocar prisma/dev.db.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Database = require('better-sqlite3');
const { RAIZ } = require('../src/config/database');

const archivo = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'lab5-test-')), 'test.db');
process.env.DATABASE_URL = `file:${archivo}`;

// Aplica las migraciones de Prisma en orden.
const carpeta = path.join(RAIZ, 'prisma', 'migrations');
const db = new Database(archivo);
for (const migracion of fs.readdirSync(carpeta).filter((n) => fs.statSync(path.join(carpeta, n)).isDirectory()).sort()) {
  db.exec(fs.readFileSync(path.join(carpeta, migracion, 'migration.sql'), 'utf8'));
}
db.close();

process.on('exit', () => {
  try { fs.rmSync(path.dirname(archivo), { recursive: true, force: true }); } catch { /* sin acción */ }
});
