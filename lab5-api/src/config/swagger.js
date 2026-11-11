const path = require('node:path');
const swaggerJsdoc = require('swagger-jsdoc');

module.exports = swaggerJsdoc({
  failOnErrors: true,
  definition: {
    openapi: '3.0.0',
    info: { title: 'Lab 5: Notas + IA', version: '1.0.0', description: 'CRUD de notas (integrante A) e integración con Claude (integrante B). Las notas se guardan en memoria y se pierden al reiniciar. Los extremos de titulo y contenido se recortan antes de validar.' },
    servers: [{ url: '/' }],
    tags: [{ name: 'Notas', description: 'Notas almacenadas en memoria' }, { name: 'IA', description: 'Integración a cargo del integrante B' }],
    paths: {
      '/api-docs': { get: { summary: 'Abre la documentación interactiva', responses: { 200: { description: 'Interfaz Swagger UI', content: { 'text/html': { schema: { type: 'string' } } } } } } },
    },
    components: {
      schemas: {
        NotaEntrada: {
          type: 'object', required: ['titulo', 'contenido'],
          properties: {
            titulo: { type: 'string', minLength: 1, maxLength: 100, example: 'Repaso de Express' },
            contenido: { type: 'string', minLength: 1, maxLength: 5000, example: 'Express permite organizar rutas y middlewares.' },
          },
        },
        Nota: {
          allOf: [
            { $ref: '#/components/schemas/NotaEntrada' },
            { type: 'object', required: ['id'], properties: { id: { type: 'integer', minimum: 1 } } },
          ],
        },
        Error: { type: 'object', properties: { error: { type: 'string' } }, required: ['error'] },
        ErrorValidacion: { type: 'object', properties: { errores: { type: 'array', items: { type: 'object' } } }, required: ['errores'] },
        Pregunta: {
          type: 'object', required: ['pregunta'],
          properties: { pregunta: { type: 'string', minLength: 3, maxLength: 2000, example: 'Explica qué es REST en dos frases.' } },
        },
        UsoTokens: {
          type: 'object', required: ['input_tokens', 'output_tokens'],
          properties: { input_tokens: { type: 'integer' }, output_tokens: { type: 'integer' } },
        },
        RespuestaIA: {
          type: 'object', required: ['respuesta', 'uso'],
          properties: { respuesta: { type: 'string' }, uso: { $ref: '#/components/schemas/UsoTokens' } },
        },
        ResumenNota: {
          type: 'object', required: ['notaId', 'resumen'],
          properties: { notaId: { type: 'integer', minimum: 1 }, resumen: { type: 'string' } },
        },
      },
      parameters: {
        NotaId: { name: 'id', in: 'path', required: true, schema: { type: 'integer', minimum: 1 }, description: 'Identificador de la nota' },
      },
      responses: {
        DatosInvalidos: {
          description: 'Campos inválidos (errores de Zod) o JSON mal formado (error)',
          content: { 'application/json': { schema: { oneOf: [{ $ref: '#/components/schemas/ErrorValidacion' }, { $ref: '#/components/schemas/Error' }] } } },
        },
        NotaNoEncontrada: {
          description: 'Nota no encontrada',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' }, example: { error: 'Nota no encontrada' } } },
        },
        IANoDisponible: {
          description: 'Proveedor de IA (Groq o Claude) no disponible: 502 credencial/conexión/petición, 429 límite de peticiones, 503 saturado',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' }, example: { error: 'IA_NO_DISPONIBLE' } } },
        },
      },
    },
  },
  // swagger-jsdoc usa patrones glob: en Windows hay que convertir \ en /.
  apis: [path.join(__dirname, '../routes/*.js').replace(/\\/g, '/')],
});
