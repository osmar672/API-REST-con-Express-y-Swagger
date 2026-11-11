// Se carga antes de cada archivo de prueba (node --test --import).
// Crea una base MySQL temporal y vacía (lab5_test_xxxx) para no tocar la base real,
// le aplica las migraciones de Prisma y la elimina al terminar.
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { after } from 'node:test';
import mariadb from 'mariadb';

const require = createRequire(import.meta.url);
const { urlBaseDeDatos, opcionesConexion } = require('../src/config/database.js');

const base = new URL(urlBaseDeDatos());
const nombre = `lab5_test_${randomBytes(4).toString('hex')}`;
const { database, connectionLimit, ...servidor } = opcionesConexion(base.href);

async function conectar() {
  return mariadb.createConnection({ ...servidor, multipleStatements: true });
}

const conexion = await conectar();
try {
  await conexion.query(`CREATE DATABASE \`${nombre}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await conexion.query(`USE \`${nombre}\``);
  const carpeta = fileURLToPath(new URL('../../prisma/migrations', import.meta.url));
  for (const migracion of fs.readdirSync(carpeta).filter((n) => fs.statSync(path.join(carpeta, n)).isDirectory()).sort()) {
    await conexion.query(fs.readFileSync(path.join(carpeta, migracion, 'migration.sql'), 'utf8'));
  }
} finally {
  await conexion.end();
}

base.pathname = `/${nombre}`;
process.env.DATABASE_URL = base.href;

after(async () => {
  // Cierra el pool de Prisma (si se usó) para que el proceso pueda terminar.
  await require('../src/services/notas.service.js').prisma.$disconnect();
  const c = await conectar();
  try { await c.query(`DROP DATABASE IF EXISTS \`${nombre}\``); } finally { await c.end(); }
});
