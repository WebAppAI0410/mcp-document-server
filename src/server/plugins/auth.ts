import { FastifyInstance, FastifyRequest, FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import { config } from '../../config';

const authPluginAsync: FastifyPluginAsync = async (app: FastifyInstance) => {
  app.addHook('onRequest', async (request: FastifyRequest, reply) => {
    // Skip auth for health check
    if (request.url === '/healthz') {
      return;
    }

    // Skip auth for GET /v1/tools (public endpoint)
    if (request.method === 'GET' && request.url === '/v1/tools') {
      return;
    }

    // Check if request is from localhost
    const isLocalhost = isRequestFromLocalhost(request);

    if (config.auth.allowLocalhost && isLocalhost) {
      return;
    }

    // Check auth token
    const authHeader = request.headers.authorization;
    const token = authHeader?.replace('Bearer ', '');

    if (!config.auth.token || token !== config.auth.token) {
      await reply.code(401).send({ error: 'Unauthorized' });
    }
  });
};

export const authPlugin = fp(authPluginAsync);

function isRequestFromLocalhost(request: FastifyRequest): boolean {
  const forwarded = request.headers['x-forwarded-for'];
  const remoteAddress = request.socket.remoteAddress;

  const ip = forwarded 
    ? (Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0].trim())
    : remoteAddress;

  return ip === '127.0.0.1' || 
         ip === '::1' || 
         ip === '::ffff:127.0.0.1' ||
         ip === 'localhost';
}