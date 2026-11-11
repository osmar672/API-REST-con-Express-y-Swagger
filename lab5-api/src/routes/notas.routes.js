const { Router } = require('express');
const { z } = require('zod');
const validar = require('../middlewares/validar');
module.exports = (notas, claude, consumo, limitarIA) => {
const router = Router();
const { AppError } = require('../utils/errors');

// Evita que valores como 1e0, 0x1 o 1.0 se interpreten como el id 1.
router.param('id', (req, res, next, value) => {
  if (!/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(Number(value))) {
    return next(new AppError(404, 'Nota no encontrada'));
  }
  next();
});
const notaSchema = z.object({
  titulo: z.string().trim().min(1).max(100),
  contenido: z.string().trim().min(1).max(5000),
});

/**
 * @openapi
 * /api/notas:
 *   get:
 *     summary: Lista todas las notas
 *     tags: [Notas]
 *     responses:
 *       200:
 *         description: Lista de notas
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Nota'
 */
router.get('/', async (req, res) => res.json(await notas.listar()));

/**
 * @openapi
 * /api/notas:
 *   post:
 *     summary: Crea una nota
 *     tags: [Notas]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/NotaEntrada'
 *     responses:
 *       201:
 *         description: Nota creada
 *         headers:
 *           Location:
 *             description: Ruta de la nota creada
 *             schema:
 *               type: string
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Nota'
 *       400:
 *         $ref: '#/components/responses/DatosInvalidos'
 *       413:
 *         description: Cuerpo demasiado grande
 */
router.post('/', validar(notaSchema), async (req, res) => {
  const nota = await notas.crear(req.body);
  res.location(`/api/notas/${nota.id}`).status(201).json(nota);
});

/**
 * @openapi
 * /api/notas/{id}:
 *   get:
 *     summary: Obtiene una nota por su identificador
 *     tags: [Notas]
 *     parameters:
 *       - $ref: '#/components/parameters/NotaId'
 *     responses:
 *       200:
 *         description: Nota encontrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Nota'
 *       404:
 *         $ref: '#/components/responses/NotaNoEncontrada'
 */
router.get('/:id', async (req, res) => res.json(await notas.buscar(Number(req.params.id))));

/**
 * @openapi
 * /api/notas/{id}:
 *   delete:
 *     summary: Elimina una nota
 *     tags: [Notas]
 *     parameters:
 *       - $ref: '#/components/parameters/NotaId'
 *     responses:
 *       204:
 *         description: Nota eliminada, sin cuerpo de respuesta
 *       404:
 *         $ref: '#/components/responses/NotaNoEncontrada'
 */
router.delete('/:id', async (req, res) => {
  await notas.eliminar(Number(req.params.id));
  res.status(204).end();
});
router.post('/:id/resumen', limitarIA, async (req, res) => {
  const nota = await notas.buscar(Number(req.params.id));
  const result = await claude.preguntar([{ role: 'user', content: nota.contenido }], 'Resume el texto en 3 viñetas breves, en español.');
  await consumo.registrar(result, 'resumen');
  res.json({ notaId: nota.id, resumen: result.respuesta, uso: result.uso });
});
return router;
};
