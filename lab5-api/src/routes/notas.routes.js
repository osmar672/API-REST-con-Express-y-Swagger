const router = require('express').Router();
const { z } = require('zod');
const validar = require('../middlewares/validar');
const notas = require('../services/notas.service');
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
router.get('/', (req, res) => res.json(notas.listar()));

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
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Nota'
 *       400:
 *         $ref: '#/components/responses/DatosInvalidos'
 *       413:
 *         description: Cuerpo demasiado grande
 */
router.post('/', validar(notaSchema), (req, res) => res.status(201).json(notas.crear(req.body)));

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
router.get('/:id', (req, res) => res.json(notas.buscar(Number(req.params.id))));

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
router.delete('/:id', (req, res) => {
  notas.eliminar(Number(req.params.id));
  res.status(204).end();
});
module.exports = router;
