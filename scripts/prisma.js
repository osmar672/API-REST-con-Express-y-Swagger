require('dotenv').config();
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const databaseUrl = process.env.DATABASE_URL || `file:${path.resolve(__dirname, '../prisma/dev.db')}`;
const result = spawnSync(process.execPath, [require.resolve('prisma/build/index.js'), ...process.argv.slice(2), '--config', path.resolve(__dirname, '../prisma.config.ts')], {
  stdio: 'inherit', env: { ...process.env, DATABASE_URL: databaseUrl },
});
if (result.error) console.error(result.error.message);
process.exit(result.status ?? 1);
