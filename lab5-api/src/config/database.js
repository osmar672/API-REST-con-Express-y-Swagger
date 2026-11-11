const path = require('node:path');

// Raíz del repositorio: allí están package.json y la carpeta prisma/.
const RAIZ = path.resolve(__dirname, '../../..');

// Devuelve la URL de SQLite con ruta absoluta para que la API use el mismo
// archivo aunque se arranque desde otra carpeta. Por defecto: prisma/dev.db.
function urlBaseDeDatos() {
  const valor = process.env.DATABASE_URL?.trim() || 'file:./prisma/dev.db';
  const archivo = valor.replace(/^file:/, '');
  return `file:${path.resolve(RAIZ, archivo)}`;
}

module.exports = { urlBaseDeDatos, RAIZ };
