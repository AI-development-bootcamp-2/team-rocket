// @ts-nocheck
'use strict';
/* eslint-disable @typescript-eslint/no-require-imports */

const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'Time Reporting API',
      version: '1.0.0',
      description: 'REST API for the employee time-reporting system',
    },
    servers: [{ url: '/api', description: 'Current server' }],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
    security: [{ bearerAuth: [] }],
  },
  // Scan all route files for JSDoc @swagger annotations
  apis: ['./src/routes/**/*.ts', './src/routes/**/*', './src/app.ts', './src/app'],
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;


