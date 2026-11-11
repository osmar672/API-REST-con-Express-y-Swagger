// Configuración de la CLI de Prisma (migraciones). La API usa la misma URL.
require('dotenv').config({ quiet: true });
const { defineConfig } = require('prisma/config');
const { urlBaseDeDatos } = require('./lab5-api/src/config/database');

module.exports = defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: { url: urlBaseDeDatos() },
});
