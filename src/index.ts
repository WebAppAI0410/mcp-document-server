import { build } from './server/app';
import { config } from './config';
import { logger } from './utils/logger';

async function start() {
  try {
    const server = build({
      logger: logger,
    });

    await server.listen({
      port: config.server.port,
      host: config.server.host,
    });

    logger.info(`MCP Document Server started on http://${config.server.host}:${config.server.port}`);
    logger.info(`Environment: ${config.server.nodeEnv}`);
    logger.info(`Auth: ${config.auth.allowLocalhost ? 'Localhost allowed' : 'Token required'}`);
  } catch (err) {
    logger.error(err);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  logger.info('Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Shutting down gracefully...');
  process.exit(0);
});

start();