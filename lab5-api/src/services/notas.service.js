const { PrismaClient } = require('@prisma/client');
const { PrismaBetterSqlite3 } = require('@prisma/adapter-better-sqlite3');
const { AppError } = require('../utils/errors');
const { urlBaseDeDatos } = require('../config/database');

// Las notas se guardan en SQLite mediante Prisma (tabla "notas").
const prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: urlBaseDeDatos() }) });

// Solo se devuelven estos campos: mantiene el contrato { id, titulo, contenido }.
const campos = { id: true, titulo: true, contenido: true };
// Int de Prisma es de 32 bits: un id mayor no puede existir.
const ID_MAXIMO = 2147483647;

const listar = () => prisma.nota.findMany({ select: campos, orderBy: { id: 'asc' } });

// Contrato de integración con B: id numérico; nota o AppError 404.
async function buscar(id) {
  const nota = Number.isInteger(id) && id >= 1 && id <= ID_MAXIMO
    ? await prisma.nota.findUnique({ where: { id }, select: campos })
    : null;
  if (!nota) throw new AppError(404, 'Nota no encontrada');
  return nota;
}

const crear = ({ titulo, contenido }) => prisma.nota.create({ data: { titulo, contenido }, select: campos });

async function eliminar(id) {
  await buscar(id);
  await prisma.nota.delete({ where: { id } });
}

module.exports = { listar, buscar, crear, eliminar, prisma };
