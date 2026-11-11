const path = require('node:path');
const swaggerJsdoc = require('swagger-jsdoc');

module.exports = swaggerJsdoc({
  failOnErrors: true,
  definition: {
    openapi: '3.0.0',
    info: { title: 'Lab 5: Notas + IA', version: '1.0.0' },
    servers: [{ url: '/' }],
    tags: [{ name: 'Notas', description: 'Notas almacenadas en memoria' }, { name: 'IA', description: 'Integración a cargo del integrante B' }],
    components: {
      schemas: {
        NotaEntrada: {
          type: 'object', required: ['titulo', 'contenido'],
          properties: {
            titulo: { type: 'string', minLength: 1, maxLength: 100 },
            contenido: { type: 'string', minLength: 1, maxLength: 5000 },
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
