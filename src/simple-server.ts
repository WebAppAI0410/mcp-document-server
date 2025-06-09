import fastify from 'fastify';
import { config } from './config';
import { logger } from './utils/logger';
import { VectorStoreFactory } from './services/vector-store-factory';
import { DocumentService } from './services/document-service';
import { MCPToolsResponse } from './types/mcp';

async function start() {
  const app = fastify({ logger: logger });

  // Initialize services
  const vectorStore = await VectorStoreFactory.create();
  const documentService = new DocumentService(vectorStore);

  // Health check
  app.get('/healthz', () => {
    return {
      status: 'healthy',
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  });

  // MCP tools
  app.get('/v1/tools', (): MCPToolsResponse => {
    return {
      tools: [
        {
          name: 'query-docs',
          description: 'Search documentation',
          inputSchema: {
            type: 'object' as const,
            properties: {
              library: { type: 'string', description: 'Package name' },
              version: { type: 'string', description: 'Version' },
              question: { type: 'string', description: 'Query' },
            },
            required: ['library', 'version', 'question'],
          },
        },
      ],
    };
  });

  // List packages
  app.get('/v1/packages', async () => {
    return documentService.listPackages();
  });

  // Query docs
  app.post('/v1/query-docs', async (request) => {
    return documentService.queryDocuments(request.body as any);
  });

  try {
    await app.listen({
      port: config.server.port,
      host: config.server.host,
    });
    void logger.info(`Simple MCP server started on ${config.server.host}:${config.server.port}`);
  } catch (err) {
    void logger.error(err);
    process.exit(1);
  }
}

void start();