const { AppError } = require('../utils/errors');
function tarifasDesdeEntorno() {
  const a = process.env.CLAUDE_INPUT_USD_PER_MILLION;
  const b = process.env.CLAUDE_OUTPUT_USD_PER_MILLION;
  if (!a && !b) return null;
  if (!a || !b || ![a, b].every((v) => v.trim() !== '' && Number.isFinite(Number(v)) && Number(v) >= 0)) {
    throw new Error('Configurar ambas tarifas de Claude como números no negativos.');
  }
  return { entrada: Number(a), salida: Number(b) };
}
function crearServicio(db, tarifas = tarifasDesdeEntorno()) {
  async function registrar(resultado, operacion, tx = db) {
    const { input_tokens, output_tokens } = resultado.uso || {};
    if (![input_tokens, output_tokens].every((n) => Number.isSafeInteger(n) && n >= 0)) {
      throw new AppError(502, 'USO_IA_INVALIDO');
    }
    const costoUsd = tarifas ? (input_tokens * tarifas.entrada + output_tokens * tarifas.salida) / 1e6 : null;
    return tx.consumo.create({ data: {
      modelo: resultado.modelo, operacion, inputTokens: input_tokens, outputTokens: output_tokens,
      costoUsd, tarifaEntrada: tarifas?.entrada ?? null, tarifaSalida: tarifas?.salida ?? null,
    } });
  }
  async function diario(fecha) {
    const desde = new Date(`${fecha}T00:00:00.000Z`);
    if (!Number.isFinite(desde.getTime()) || desde.toISOString().slice(0, 10) !== fecha) throw new AppError(400, 'Fecha inválida');
    const hasta = new Date(desde.getTime() + 86400000);
    const where = { fecha: { gte: desde, lt: hasta } };
    const [total, sinTarifa] = await Promise.all([
      db.consumo.aggregate({ where, _sum: { inputTokens: true, outputTokens: true, costoUsd: true }, _count: true }),
      db.consumo.count({ where: { ...where, costoUsd: null } }),
    ]);
    const subtotal = Number((total._sum.costoUsd || 0).toFixed(8));
    return { fecha, zonaHoraria: 'UTC', solicitudes: total._count,
      inputTokens: total._sum.inputTokens || 0, outputTokens: total._sum.outputTokens || 0,
      costoEstimadoUsd: sinTarifa ? null : subtotal, subtotalConTarifaUsd: subtotal,
      solicitudesSinTarifa: sinTarifa, estimacionCompleta: sinTarifa === 0,
    };
  }
  return { registrar, diario };
}
module.exports = { crearServicio };
