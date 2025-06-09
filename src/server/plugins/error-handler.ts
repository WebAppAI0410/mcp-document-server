import { FastifyInstance, FastifyError, FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';

const errorHandlerAsync: FastifyPluginAsync = async (app: FastifyInstance) => {
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
      void reply.status(statusCode).send({
        error: 'Internal Server Error',
        message: 'An unexpected error occurred',
      });
    } else {
      void reply.status(statusCode).send({
        error: error.name || 'Error',
        message: error.message,
      });
    }
  });
};

export const errorHandler = fp(errorHandlerAsync);