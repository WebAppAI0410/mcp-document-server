import { FastifyInstance, FastifyError } from 'fastify';

export async function errorHandler(app: FastifyInstance) {
  app.setErrorHandler((error: FastifyError, request, reply) => {
    const statusCode = error.statusCode || 500;
    
    app.log.error({
      err: error,
      request: {
        method: request.method,
        url: request.url,
        headers: request.headers,
        body: request.body,
      },
    });

    if (statusCode >= 500) {
      reply.status(statusCode).send({
        error: 'Internal Server Error',
        message: 'An unexpected error occurred',
      });
    } else {
      reply.status(statusCode).send({
        error: error.name || 'Error',
        message: error.message,
      });
    }
  });
}