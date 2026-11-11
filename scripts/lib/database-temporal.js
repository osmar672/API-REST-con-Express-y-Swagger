const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createClient } = require('@libsql/client');
// Debe invocarse antes de importar app/config/database. Nunca borra una base del usuario.
module.exports = ({ migrate = true } = {}) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'lab5-test-'));
  const url = `file:${path.join(directory, 'test.db')}`;
  process.env.DATABASE_URL = url;
  const client = createClient({ url });
  const sql = fs.readFileSync(path.resolve(__dirname, '../../prisma/migrations/202611110001_inicial/migration.sql'), 'utf8');
  const ready = (migrate ? client.executeMultiple(sql) : Promise.resolve()).finally(() => client.close());
  async function close() {
    await require('../../lab5-api/src/config/database').$disconnect();
    fs.rmSync(directory, { recursive: true, force: true });
  }
  return { url, ready, close };
};
