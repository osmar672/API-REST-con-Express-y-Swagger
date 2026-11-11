const json = (schema) => ({ 'application/json': { schema } });
const ref = (name) => ({ $ref: `#/components/schemas/${name}` });
const pregunta = { required: true, content: json(ref('Pregunta')) };
const error = (description) => ({ description, content: json(ref('Error')) });
const responses = {
  400: error('Entrada inválida'), 404: error('Nota o conversación no encontrada'),
  409: error('Conversación ocupada o máximo de turnos alcanzado'),
  429: error('Límite local o del proveedor; el límite local incluye Retry-After'),
  502: error('IA_NO_DISPONIBLE'), 503: error('IA_NO_CONFIGURADA o proveedor saturado'),
};
const id = { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } };
const success = (schema) => ({ description: 'Solicitud completada', content: json(schema) });
const operation = (summary, options = {}) => ({ tags: ['IA'], summary, ...options });
module.exports = {
  schemas: {
    Pregunta: { type: 'object', required: ['pregunta'], properties: { pregunta: { type: 'string', minLength: 3, maxLength: 2000, example: '¿Qué es una API REST?' } } },
    RespuestaIA: { type: 'object', properties: { respuesta: { type: 'string' }, modelo: { type: 'string' }, uso: { type: 'object', properties: { input_tokens: { type: 'integer' }, output_tokens: { type: 'integer' } } } } },
    Conversacion: { type: 'object', properties: { id: { type: 'string', format: 'uuid' }, mensajes: { type: 'array', items: { type: 'object', properties: { rol: { type: 'string', enum: ['user', 'assistant'] }, contenido: { type: 'string' } } } } } },
    ConsumoDiario: { type: 'object', properties: {
      fecha: { type: 'string', format: 'date' }, zonaHoraria: { type: 'string', example: 'UTC' }, solicitudes: { type: 'integer' }, inputTokens: { type: 'integer' }, outputTokens: { type: 'integer' },
      costoEstimadoUsd: { type: 'number', nullable: true }, subtotalConTarifaUsd: { type: 'number' }, solicitudesSinTarifa: { type: 'integer' }, estimacionCompleta: { type: 'boolean' },
    } },
  },
  paths: {
    '/api/ia/preguntar': { post: operation('Pregunta independiente a Claude', { requestBody: pregunta, responses: { ...responses, 200: success(ref('RespuestaIA')) } }) },
    '/api/ia/conversaciones': { post: operation('Crea una conversación sin consumir tokens', { responses: { 201: { ...success(ref('Conversacion')), description: 'Conversación creada' }, 429: responses[429] } }) },
    '/api/ia/conversaciones/{id}': { get: operation('Consulta el historial persistido', { parameters: [id], responses: { 200: success(ref('Conversacion')), 404: responses[404], 429: responses[429] } }) },
    '/api/ia/conversaciones/{id}/mensajes': { post: operation('Envía un turno con el historial (máximo 10 turnos)', { parameters: [id], requestBody: pregunta, responses: { ...responses, 200: success(ref('RespuestaIA')) } }) },
    '/api/ia/conversaciones/{id}/stream': { post: operation('Recibe texto incremental mediante SSE', {
      description: 'Eventos texto {texto}, fin {uso,modelo} o error {status,error}. Para POST usar fetch o curl -N; EventSource solo admite GET. Un fallo después de iniciar el stream se comunica con el evento error, no cambiando el HTTP 200.',
      parameters: [id], requestBody: pregunta, responses: { ...responses, 200: { description: 'Stream SSE', content: { 'text/event-stream': { schema: { type: 'string' }, example: 'event: texto\ndata: {"texto":"Hola"}\n\nevent: fin\ndata: {"uso":{"input_tokens":8,"output_tokens":2}}\n\n' } } } },
    }) },
    '/api/ia/consumo': { get: operation('Consulta consumo y costo estimado diario (UTC)', { parameters: [{ name: 'fecha', in: 'query', schema: { type: 'string', format: 'date' }, description: 'YYYY-MM-DD; por defecto hoy UTC. Sin tarifas: costoEstimadoUsd es null.' }], responses: { 200: success(ref('ConsumoDiario')), 400: responses[400], 429: responses[429] } }) },
    '/api/notas/{id}/resumen': { post: operation('Resume una nota en tres viñetas', { parameters: [{ ...id, schema: { type: 'integer', minimum: 1, maximum: 2147483647 } }], responses: { ...responses, 200: success({ type: 'object', properties: { notaId: { type: 'integer' }, resumen: { type: 'string' }, uso: { type: 'object' } } }) } }) },
  },
};
