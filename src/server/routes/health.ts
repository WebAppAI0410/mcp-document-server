import { FastifyInstance } from 'fastify';

export async function healthRoutes(app: FastifyInstance) {
  app.get('/healthz', async (request, reply) => {
    const uptime = process.uptime();
    const memoryUsage = process.memoryUsage();

    return {
      status: 'healthy',
      uptime: Math.floor(uptime),
      timestamp: new Date().toISOString(),
      memory: {
        rss: Math.floor(memoryUsage.rss / 1024 / 1024), // MB
        heapUsed: Math.floor(memoryUsage.heapUsed / 1024 / 1024), // MB
        heapTotal: Math.floor(memoryUsage.heapTotal / 1024 / 1024), // MB
      },
    };
  });
}