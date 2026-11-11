const { randomUUID } = require('node:crypto');
const { AppError } = require('../utils/errors');
function crearServicio(db, claude, consumo) {
  const ocupadas = new Set();
  async function buscar(id) {
    const conversacion = await db.conversacion.findUnique({ where: { id }, include: { mensajes: { orderBy: { id: 'asc' } } } });
    if (!conversacion) throw new AppError(404, 'Conversación no encontrada');
    return conversacion;
  }
  const crear = () => db.conversacion.create({ data: { id: randomUUID() } });
  async function preguntar(pregunta) {
    const result = await claude.preguntar([{ role: 'user', content: pregunta }]);
    await consumo.registrar(result, 'pregunta');
    return result;
  }
  async function turno(id, pregunta, opciones) {
    if (ocupadas.has(id)) throw new AppError(409, 'Conversación ocupada');
    ocupadas.add(id);
    try {
      const conversacion = await buscar(id);
      if (conversacion.mensajes.length >= 20) throw new AppError(409, 'Límite de 10 turnos por conversación');
      const messages = [...conversacion.mensajes.map((m) => ({ role: m.rol, content: m.contenido })), { role: 'user', content: pregunta }];
      const result = opciones
        ? await claude.stream(messages, opciones.onText, { signal: opciones.signal })
        : await claude.preguntar(messages);
      // Un fallo o una desconexión no añade un turno incompleto al historial.
      if (opciones?.signal.aborted) throw new AppError(499, 'Solicitud cancelada');
      await db.$transaction(async (tx) => {
        await tx.mensaje.createMany({ data: [
          { conversacionId: id, rol: 'user', contenido: pregunta },
          { conversacionId: id, rol: 'assistant', contenido: result.respuesta },
        ] });
        await consumo.registrar(result, opciones ? 'stream' : 'conversacion', tx);
      });
      return result;
    } finally { ocupadas.delete(id); }
  }
  return { crear, buscar, preguntar, turno };
}
module.exports = { crearServicio };
