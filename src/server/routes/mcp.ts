import { FastifyInstance } from 'fastify';
import { 
  MCPToolsResponse, 
  QueryDocsRequest, 
  QueryDocsResponse,
  ListPackagesResponse,
  ListVersionsResponse 
} from '../../types/mcp';
import { DocumentService } from '../../services/document-service';
import { VectorStoreFactory } from '../../services/vector-store-factory';

let documentService: DocumentService;

export async function mcpRoutes(app: FastifyInstance) {
  // Initialize document service with vector store
  if (!documentService) {
    const vectorStore = await VectorStoreFactory.create();
    documentService = new DocumentService(vectorStore);
  }
  // Get available tools
  app.get<{ Reply: MCPToolsResponse }>('/tools', async (_request, _reply) => {
    const response: MCPToolsResponse = {
      tools: [
        {
          name: 'query-docs',
          description: 'Search documentation for a specific library version',
          inputSchema: {
            type: 'object' as const,
            properties: {
              library: {
                type: 'string',
                description: 'The library/package name (e.g., "next", "react")',
              },
              version: {
                type: 'string',
                description: 'The specific version (e.g., "14.2.2", "18.3.0")',
              },
              question: {
                type: 'string',
                description: 'The search query or question',
              },
              max_tokens: {
                type: 'number',
                description: 'Maximum tokens in the response',
                default: 500,
              },
              include_citations: {
                type: 'boolean',
                description: 'Include source URLs in the response',
                default: true,
              },
            },
            required: ['library', 'version', 'question'],
          },
        },
        {
          name: 'list-packages',
          description: 'List all available packages with their versions',
          inputSchema: {
            type: 'object' as const,
            properties: {},
          },
        },
        {
          name: 'list-versions',
          description: 'List all versions for a specific package',
          inputSchema: {
            type: 'object' as const,
            properties: {
              package: {
                type: 'string',
                description: 'The package name',
              },
            },
            required: ['package'],
          },
        },
      ],
    };
    return response;
  });

  // Query documents
  app.post<{ Body: QueryDocsRequest; Reply: QueryDocsResponse }>('/query-docs', {
    schema: {
      body: {
        type: 'object',
        properties: {
          library: { type: 'string' },
          version: { type: 'string' },
          question: { type: 'string' },
          max_tokens: { type: 'number' },
          include_citations: { type: 'boolean' },
        },
        required: ['library', 'version', 'question'],
      },
    },
  }, async (request, _reply) => {
    return documentService.queryDocuments(request.body);
  });

  // List packages
  app.get<{ Reply: ListPackagesResponse }>('/packages', async (_request, _reply) => {
    return documentService.listPackages();
  });

  // List versions for a package
  app.get<{ 
    Params: { package: string }; 
    Reply: ListVersionsResponse 
  }>('/packages/:package/versions', async (request, reply) => {
    try {
      return await documentService.listVersions(request.params.package);
    } catch (error) {
      if (error instanceof Error && error.message === 'Package not found') {
        void reply.code(404);
        throw new Error('Package not found');
      } else {
        throw error;
      }
    }
  });
}