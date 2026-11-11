const path = require('node:path');
const { PrismaClient } = require('@prisma/client');
const { PrismaLibSQL } = require('@prisma/adapter-libsql');
function crearDatabase(url = process.env.DATABASE_URL || `file:${path.resolve(__dirname, '../../../prisma/dev.db')}`) {
  return new PrismaClient({ adapter: new PrismaLibSQL({ url }) });
}
module.exports = crearDatabase();
module.exports.crearDatabase = crearDatabase;
