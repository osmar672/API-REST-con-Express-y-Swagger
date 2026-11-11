const router = require('express').Router();
const { z } = require('zod');
const validar = require('../middlewares/validar');
const claude = require('../services/claude.service');

// Validar antes de llamar a Claude evita gastar créditos en entradas vacías o enormes.
const preguntaSchema = z.object({
  pregunta: z.string().trim().min(3).max(2000),
});

/**
 * @openapi
 * /api/ia/preguntar:
 *   post:
 *     summary: Envía una pregunta a Claude
 *     tags: [IA]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Pregunta'
 *     responses:
 *       200:
 *         description: Respuesta del modelo y tokens utilizados
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/RespuestaIA'
 *       400:
 *         $ref: '#/components/responses/DatosInvalidos'
 *       413:
 *         description: Cuerpo demasiado grande
 *       429:
 *         $ref: '#/components/responses/IANoDisponible'
 *       502:
 *         $ref: '#/components/responses/IANoDisponible'
 *       503:
 *         $ref: '#/components/responses/IANoDisponible'
 */
router.post('/preguntar', validar(preguntaSchema), async (req, res) => {
  res.json(await claude.preguntar(req.body.pregunta));
});

module.exports = router;
