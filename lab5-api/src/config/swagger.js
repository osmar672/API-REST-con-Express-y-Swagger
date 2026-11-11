const path = require('node:path');
const swaggerJsdoc = require('swagger-jsdoc');
const ia = require('./openapi-ia');

module.exports = swaggerJsdoc({
  failOnErrors: true,
  definition: {
    openapi: '3.0.0',
    info: { title: 'Lab 5: Notas + IA', version: '1.0.0', description: 'CRUD del integrante A. Notas, historial y consumo persisten en SQLite. Los extremos de titulo y contenido se recortan antes de validar.' },
    servers: [{ url: '/' }],
    tags: [{ name: 'Notas', description: 'Notas almacenadas en memoria' }, { name: 'IA', description: 'Claude, historial, streaming y consumo' }],
    paths: {
      ...ia.paths,
      '/api-docs': { get: { summary: 'Abre la documentación interactiva', responses: { 200: { description: 'Interfaz Swagger UI', content: { 'text/html': { schema: { type: 'string' } } } } } } },
    },
    components: {
      schemas: {
        ...ia.schemas,
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
      },
    },
  },
  apis: [path.join(__dirname, '../routes/*.js')],
});
