import { DocumentService } from '../../services/document-service';
import { VectorStore } from '../../services/vector-store';
import { QueryDocsRequest } from '../../types/mcp';

jest.mock('../../services/vector-store');

describe('DocumentService', () => {
  let documentService: DocumentService;
  let mockVectorStore: jest.Mocked<VectorStore>;

  beforeEach(() => {
    mockVectorStore = new VectorStore() as jest.Mocked<VectorStore>;
    documentService = new DocumentService(mockVectorStore);
  });

  describe('queryDocuments', () => {
    it('should query documents with proper parameters', async () => {
      const request: QueryDocsRequest = {
        library: 'next',
        version: '14.2.2',
        question: 'How to handle errors in app router?',
        max_tokens: 500,
        include_citations: true,
      };

      const mockResults = [
        {
          content: 'Error handling in App Router...',
          score: 0.95,
          metadata: {
            package: 'next',
            version: '14.2.2',
            url: 'https://nextjs.org/docs/app/error-handling',
            title: 'Error Handling',
          },
        },
      ];

      mockVectorStore.search.mockResolvedValue(mockResults);

      const result = await documentService.queryDocuments(request);

      expect(mockVectorStore.search).toHaveBeenCalledWith({
        query: request.question,
        filter: {
          package: request.library,
          version: request.version,
        },
        limit: 5,
      });

      expect(result.results).toEqual(mockResults);
      expect(result.total_results).toBe(1);
      expect(result.query_time_ms).toBeGreaterThan(0);
    });

    it('should handle empty results', async () => {
      const request: QueryDocsRequest = {
        library: 'unknown',
        version: '0.0.0',
        question: 'non-existent topic',
      };

      mockVectorStore.search.mockResolvedValue([]);

      const result = await documentService.queryDocuments(request);

      expect(result.results).toEqual([]);
      expect(result.total_results).toBe(0);
    });

    it('should limit content based on max_tokens', async () => {
      const request: QueryDocsRequest = {
        library: 'react',
        version: '18.3.0',
        question: 'hooks',
        max_tokens: 50,
      };

      const longContent = 'A'.repeat(1000);
      mockVectorStore.search.mockResolvedValue([
        {
          content: longContent,
          score: 0.9,
          metadata: {
            package: 'react',
            version: '18.3.0',
          },
        },
      ]);

      const result = await documentService.queryDocuments(request);

      expect(result.results[0].content.length).toBeLessThan(longContent.length);
      expect(result.results[0].content.length).toBeLessThanOrEqual(200); // ~50 tokens
    });

    it('should include citations when requested', async () => {
      const request: QueryDocsRequest = {
        library: 'convex',
        version: '1.6.0',
        question: 'mutation args',
        include_citations: true,
      };

      mockVectorStore.search.mockResolvedValue([
        {
          content: 'Mutations require args to be an object',
          score: 0.88,
          metadata: {
            package: 'convex',
            version: '1.6.0',
            url: 'https://docs.convex.dev/mutations',
          },
        },
      ]);

      const result = await documentService.queryDocuments(request);

      expect(result.results[0].citations).toBeDefined();
      expect(result.results[0].citations).toContain('https://docs.convex.dev/mutations');
    });
  });

  describe('listPackages', () => {
    it('should return all available packages', async () => {
      const mockPackages = [
        {
          name: 'next',
          description: 'React framework',
          versions: ['14.2.2', '14.2.1', '14.2.0'],
          last_updated: '2024-05-01',
        },
        {
          name: 'react',
          description: 'UI library',
          versions: ['18.3.0', '18.2.0'],
          last_updated: '2024-04-15',
        },
      ];

      mockVectorStore.listPackages.mockResolvedValue(mockPackages);

      const result = await documentService.listPackages();

      expect(result.packages).toEqual(mockPackages);
      expect(result.packages).toHaveLength(2);
    });
  });

  describe('listVersions', () => {
    it('should return versions for a specific package', async () => {
      const mockVersions = [
        {
          version: '14.2.2',
          release_date: '2024-05-01',
          doc_count: 150,
          last_indexed: '2024-05-02',
        },
        {
          version: '14.2.1',
          release_date: '2024-04-15',
          doc_count: 148,
          last_indexed: '2024-04-16',
        },
      ];

      mockVectorStore.listVersions.mockResolvedValue(mockVersions);

      const result = await documentService.listVersions('next');

      expect(mockVectorStore.listVersions).toHaveBeenCalledWith('next');
      expect(result.package).toBe('next');
      expect(result.versions).toEqual(mockVersions);
    });

    it('should throw error for non-existent package', async () => {
      mockVectorStore.listVersions.mockRejectedValue(
        new Error('Package not found')
      );

      await expect(documentService.listVersions('unknown')).rejects.toThrow(
        'Package not found'
      );
    });
  });
});