import fastify, { FastifyInstance, FastifyServerOptions } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { config } from '../config';
import { mcpRoutes } from './routes/mcp';
import { healthRoutes } from './routes/health';
import { authPlugin } from './plugins/auth';
import { errorHandler } from './plugins/error-handler';
import { logger } from '../utils/logger';

export function build(opts: FastifyServerOptions = {}): FastifyInstance {
  const app = fastify({
    logger: opts.logger !== false ? logger : false,
    ...opts,
  });

  // Register plugins
  app.register(helmet);
  app.register(cors, {
    origin: config.server.nodeEnv === 'production' ? false : true,
  });
  app.register(rateLimit, {
    max: config.rateLimit.max,
    timeWindow: config.rateLimit.timeWindow,
  });

  // Custom plugins
  app.register(authPlugin);
  app.register(errorHandler);

  // Routes
  app.register(mcpRoutes, { prefix: '/v1' });
  app.register(healthRoutes);

  return app;
}