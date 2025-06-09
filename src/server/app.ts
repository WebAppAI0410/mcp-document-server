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
  void app.register(helmet);
  void app.register(cors, {
    origin: config.server.nodeEnv === 'production' ? false : true,
  });
  void app.register(rateLimit, {
    max: config.rateLimit.max,
    timeWindow: config.rateLimit.timeWindow,
  });

  // Custom plugins
  void app.register(authPlugin);
  void app.register(errorHandler);

  // Routes
  void app.register(mcpRoutes, { prefix: '/v1' });
  void app.register(healthRoutes);

  return app;
}