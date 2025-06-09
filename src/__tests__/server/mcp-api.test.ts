import { FastifyInstance } from 'fastify';
import { build } from '../../server/app';
import { MCPToolsResponse, QueryDocsRequest, QueryDocsResponse } from '../../types/mcp';

describe('MCP API Endpoints', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = build({ logger: false });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('GET /v1/tools', () => {
    it('should return available MCP tools', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/tools',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body) as MCPToolsResponse;
      
      expect(body.tools).toBeInstanceOf(Array);
      expect(body.tools.length).toBeGreaterThan(0);
      
      const queryDocsTool = body.tools.find(tool => tool.name === 'query-docs');
      expect(queryDocsTool).toBeDefined();
      expect(queryDocsTool?.description).toContain('Search documentation');
      expect(queryDocsTool?.inputSchema.properties).toHaveProperty('library');
      expect(queryDocsTool?.inputSchema.properties).toHaveProperty('version');
      expect(queryDocsTool?.inputSchema.properties).toHaveProperty('question');
    });

    it('should include all required tools', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/tools',
      });

      const body = JSON.parse(response.body) as MCPToolsResponse;
      const toolNames = body.tools.map(tool => tool.name);
      
      expect(toolNames).toContain('query-docs');
      expect(toolNames).toContain('list-packages');
      expect(toolNames).toContain('list-versions');
    });
  });

  describe('POST /v1/query-docs', () => {
    it('should return 400 for missing required fields', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/query-docs',
        payload: {
          library: 'next',
          // missing version and question
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 401 for unauthorized requests', async () => {
      const validPayload: QueryDocsRequest = {
        library: 'next',
        version: '14.2.2',
        question: 'app router error handling',
      };

      const response = await app.inject({
        method: 'POST',
        url: '/v1/query-docs',
        payload: validPayload,
        headers: {
          'x-forwarded-for': '192.168.1.1', // Not localhost
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should accept valid query requests from localhost', async () => {
      const validPayload: QueryDocsRequest = {
        library: 'next',
        version: '14.2.2',
        question: 'app router error handling',
        max_tokens: 500,
        include_citations: true,
      };

      const response = await app.inject({
        method: 'POST',
        url: '/v1/query-docs',
        payload: validPayload,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body) as QueryDocsResponse;
      
      expect(body).toHaveProperty('results');
      expect(body).toHaveProperty('total_results');
      expect(body).toHaveProperty('query_time_ms');
      expect(body.results).toBeInstanceOf(Array);
    });

    it('should respect max_tokens parameter', async () => {
      const payload: QueryDocsRequest = {
        library: 'react',
        version: '18.3.0',
        question: 'hooks usage',
        max_tokens: 100,
      };

      const response = await app.inject({
        method: 'POST',
        url: '/v1/query-docs',
        payload,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body) as QueryDocsResponse;
      
      body.results.forEach(result => {
        expect(result.content.length).toBeLessThanOrEqual(400); // Approximate token to char ratio
      });
    });
  });

  describe('GET /v1/packages', () => {
    it('should return list of available packages', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/packages',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      
      expect(body.packages).toBeInstanceOf(Array);
      expect(body.packages.length).toBeGreaterThanOrEqual(0);
      
      if (body.packages.length > 0) {
        const pkg = body.packages[0];
        expect(pkg).toHaveProperty('name');
        expect(pkg).toHaveProperty('versions');
        expect(pkg).toHaveProperty('last_updated');
      }
    });
  });

  describe('GET /v1/packages/:package/versions', () => {
    it('should return versions for a specific package', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/packages/next/versions',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      
      expect(body.package).toBe('next');
      expect(body.versions).toBeInstanceOf(Array);
    });

    it('should return 404 for non-existent package', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/packages/non-existent-pkg/versions',
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('GET /healthz', () => {
    it('should return health status', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/healthz',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      
      expect(body.status).toBe('healthy');
      expect(body).toHaveProperty('uptime');
      expect(body).toHaveProperty('timestamp');
    });
  });
});