const { Router } = require('express');
const { z } = require('zod');
const { once } = require('node:events');
const validar = require('../middlewares/validar');
const { respuestaError } = require('../middlewares/errorHandler');
const preguntaSchema = z.object({ pregunta: z.string().trim().min(3).max(2000) });
module.exports = (ia, consumo) => {
  const router = Router();
  router.post('/preguntar', validar(preguntaSchema), async (req, res) => res.json(await ia.preguntar(req.body.pregunta)));
  router.post('/conversaciones', async (req, res) => {
    const c = await ia.crear();
    res.location(`/api/ia/conversaciones/${c.id}`).status(201).json(c);
  });
  router.get('/conversaciones/:id', async (req, res) => res.json(await ia.buscar(req.params.id)));
  router.post('/conversaciones/:id/mensajes', validar(preguntaSchema), async (req, res) => res.json(await ia.turno(req.params.id, req.body.pregunta)));
  router.post('/conversaciones/:id/stream', validar(preguntaSchema), async (req, res, next) => {
    const controller = new AbortController();
    const disconnect = () => { if (!res.writableEnded) controller.abort(); };
    res.on('close', disconnect);
    function enviar(event, data) {
      if (controller.signal.aborted) return false;
      if (!res.headersSent) res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'X-Accel-Buffering': 'no' });
      return res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    }
    try {
      const result = await ia.turno(req.params.id, req.body.pregunta, { signal: controller.signal,
        onText: async (text) => {
          if (controller.signal.aborted) return;
          if (!enviar('texto', { texto: text })) await once(res, 'drain', { signal: controller.signal });
        },
      });
      if (!controller.signal.aborted) { enviar('fin', { uso: result.uso, modelo: result.modelo }); res.end(); }
    } catch (error) {
      if (controller.signal.aborted) return;
      if (!res.headersSent) return next(error);
      enviar('error', respuestaError(error));
      res.end();
    } finally { res.off('close', disconnect); }
  });
  router.get('/consumo', async (req, res) => {
    const parsed = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).safeParse(req.query.fecha || new Date().toISOString().slice(0, 10));
    if (!parsed.success) return res.status(400).json({ error: 'Fecha inválida' });
    res.json(await consumo.diario(parsed.data));
  });
  return router;
};
