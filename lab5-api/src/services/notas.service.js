const { AppError } = require('../utils/errors');

const notas = [];
let nextId = 1;
const listar = () => notas.map((nota) => ({ ...nota }));

// Contrato de integración con B: id numérico; nota o AppError 404.
function buscar(id) {
  const nota = notas.find((nota) => nota.id === id);
  if (!nota) throw new AppError(404, 'Nota no encontrada');
  return { ...nota };
}

function crear({ titulo, contenido }) {
  const nota = { id: nextId++, titulo, contenido };
  notas.push(nota);
  return { ...nota };
}

function eliminar(id) {
  buscar(id);
  notas.splice(notas.findIndex((nota) => nota.id === id), 1);
}

module.exports = { listar, buscar, crear, eliminar };
