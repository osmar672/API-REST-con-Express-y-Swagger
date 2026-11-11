const database = require('../config/database');
const { AppError } = require('../utils/errors');
function crearServicio(db) {
  const listar = () => db.nota.findMany({ orderBy: { id: 'asc' } });
  async function buscar(id) {
    const nota = await db.nota.findUnique({ where: { id } });
    if (!nota) throw new AppError(404, 'Nota no encontrada');
    return nota;
  }
  const crear = (data) => db.nota.create({ data });
  async function eliminar(id) {
    const result = await db.nota.deleteMany({ where: { id } });
    if (!result.count) throw new AppError(404, 'Nota no encontrada');
  }
  return { listar, buscar, crear, eliminar };
}
module.exports = { ...crearServicio(database), crearServicio };
