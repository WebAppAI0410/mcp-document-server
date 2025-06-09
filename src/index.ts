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

    void logger.info(`MCP Document Server started on http://${config.server.host}:${config.server.port}`);
    void logger.info(`Environment: ${config.server.nodeEnv}`);
    void logger.info(`Auth: ${config.auth.allowLocalhost ? 'Localhost allowed' : 'Token required'}`);
  } catch (err) {
    void logger.error(err);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  void logger.info('Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  void logger.info('Shutting down gracefully...');
  process.exit(0);
});

void start();