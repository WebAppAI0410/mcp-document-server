import { QdrantVectorStore } from '../../services/qdrant-vector-store';
import { VectorDocument } from '../../services/vector-store';
import { QdrantClient } from '@qdrant/js-client-rest';
import { v4 as uuidv4 } from 'uuid';

jest.mock('@qdrant/js-client-rest');

describe('QdrantVectorStore', () => {
  let vectorStore: QdrantVectorStore;
  let mockClient: jest.Mocked<QdrantClient>;

  beforeEach(() => {
    mockClient = {
      getCollections: jest.fn(),
      createCollection: jest.fn(),
      collectionExists: jest.fn(),
      upsert: jest.fn(),
      search: jest.fn(),
      delete: jest.fn(),
      scroll: jest.fn(),
    } as any;

    (QdrantClient as any).mockImplementation(() => mockClient);

    vectorStore = new QdrantVectorStore({
      url: 'http://localhost:6333',
      apiKey: 'test-api-key',
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('initialize', () => {
    it('should create collection if it does not exist', async () => {
      mockClient.collectionExists.mockResolvedValue({ exists: false });

      await vectorStore.initialize();

      expect(mockClient.createCollection).toHaveBeenCalledWith('documents', {
        vectors: {
          size: 1536,
          distance: 'Cosine',
        },
        optimizers_config: {
          default_segment_number: 2,
        },
        replication_factor: 2,
      });
    });

    it('should not create collection if it already exists', async () => {
      mockClient.collectionExists.mockResolvedValue({ exists: true });

      await vectorStore.initialize();

      expect(mockClient.createCollection).not.toHaveBeenCalled();
    });

    it('should handle initialization errors', async () => {
      mockClient.collectionExists.mockRejectedValue(new Error('Connection failed'));

      await expect(vectorStore.initialize()).rejects.toThrow('Connection failed');
    });
  });

  describe('addDocument', () => {
    it('should upsert a document with vector and payload', async () => {
      const doc: VectorDocument = {
        id: uuidv4(),
        content: 'Test document content',
        embedding: new Array(1536).fill(0).map(() => Math.random()),
        metadata: {
          package: 'next',
          version: '14.2.2',
          url: 'https://nextjs.org/docs/test',
          title: 'Test Page',
          section: 'Getting Started',
        },
      };

      await vectorStore.addDocument(doc);

      expect(mockClient.upsert).toHaveBeenCalledWith('documents', {
        wait: true,
        points: [
          {
            id: doc.id,
            vector: doc.embedding,
            payload: {
              content: doc.content,
              package: doc.metadata.package,
              version: doc.metadata.version,
              url: doc.metadata.url,
              title: doc.metadata.title,
              section: doc.metadata.section,
            },
          },
        ],
      });
    });

    it('should handle upsert errors', async () => {
      const doc: VectorDocument = {
        id: uuidv4(),
        content: 'Content',
        embedding: [0.1, 0.2, 0.3],
        metadata: {
          package: 'react',
          version: '18.3.0',
        },
      };

      mockClient.upsert.mockRejectedValue(new Error('Upsert failed'));

      await expect(vectorStore.addDocument(doc)).rejects.toThrow('Upsert failed');
    });
  });

  describe('addDocuments', () => {
    it('should batch upsert multiple documents', async () => {
      const docs: VectorDocument[] = [
        {
          id: uuidv4(),
          content: 'Doc 1',
          embedding: new Array(1536).fill(0.1),
          metadata: { package: 'next', version: '14.2.2' },
        },
        {
          id: uuidv4(),
          content: 'Doc 2',
          embedding: new Array(1536).fill(0.2),
          metadata: { package: 'next', version: '14.2.2' },
        },
      ];

      await vectorStore.addDocuments(docs);

      expect(mockClient.upsert).toHaveBeenCalledWith('documents', {
        wait: true,
        points: expect.arrayContaining([
          expect.objectContaining({
            id: docs[0].id,
            vector: docs[0].embedding,
            payload: expect.objectContaining({
              content: docs[0].content,
              package: 'next',
              version: '14.2.2',
            }),
          }),
          expect.objectContaining({
            id: docs[1].id,
            vector: docs[1].embedding,
            payload: expect.objectContaining({
              content: docs[1].content,
              package: 'next',
              version: '14.2.2',
            }),
          }),
        ]),
      });
    });

    it('should handle batch size limits', async () => {
      // Create 150 documents (batch size is typically 100)
      const docs: VectorDocument[] = Array.from({ length: 150 }, (_, i) => ({
        id: uuidv4(),
        content: `Doc ${i}`,
        embedding: new Array(1536).fill(0.1),
        metadata: { package: 'react', version: '18.3.0' },
      }));

      await vectorStore.addDocuments(docs);

      // Should be called twice (100 + 50)
      expect(mockClient.upsert).toHaveBeenCalledTimes(2);
    });
  });

  describe('search', () => {
    it('should perform vector similarity search with filters', async () => {
      const mockResults = {
        points: [
          {
            id: 'doc1',
            score: 0.95,
            payload: {
              content: 'React hooks documentation',
              package: 'react',
              version: '18.3.0',
              url: 'https://react.dev/hooks',
              title: 'Hooks',
            },
          },
          {
            id: 'doc2',
            score: 0.88,
            payload: {
              content: 'Using useEffect hook',
              package: 'react',
              version: '18.3.0',
              url: 'https://react.dev/hooks/useeffect',
              title: 'useEffect',
            },
          },
        ],
      };

      // Mock embedding generation
      const mockEmbedding = new Array(1536).fill(0.1);
      vectorStore['generateQueryEmbedding'] = jest.fn().mockResolvedValue(mockEmbedding);

      mockClient.search.mockResolvedValue(mockResults);

      const results = await vectorStore.search({
        query: 'react hooks',
        filter: {
          package: 'react',
          version: '18.3.0',
        },
        limit: 5,
      });

      expect(mockClient.search).toHaveBeenCalledWith('documents', {
        vector: mockEmbedding,
        filter: {
          must: [
            {
              key: 'package',
              match: { value: 'react' },
            },
            {
              key: 'version',
              match: { value: '18.3.0' },
            },
          ],
        },
        limit: 5,
        with_payload: true,
      });

      expect(results).toHaveLength(2);
      expect(results[0].score).toBe(0.95);
      expect(results[0].content).toBe('React hooks documentation');
      expect(results[0].metadata.package).toBe('react');
    });

    it('should search without filters', async () => {
      const mockEmbedding = new Array(1536).fill(0.1);
      vectorStore['generateQueryEmbedding'] = jest.fn().mockResolvedValue(mockEmbedding);

      mockClient.search.mockResolvedValue({ points: [] });

      await vectorStore.search({
        query: 'any query',
        limit: 10,
      });

      expect(mockClient.search).toHaveBeenCalledWith('documents', {
        vector: mockEmbedding,
        limit: 10,
        with_payload: true,
      });
    });
  });

  describe('listPackages', () => {
    it('should aggregate packages from scroll results', async () => {
      mockClient.scroll.mockResolvedValueOnce({
        points: [
          {
            id: '1',
            payload: {
              package: 'next',
              version: '14.2.2',
            },
          },
          {
            id: '2',
            payload: {
              package: 'next',
              version: '14.2.1',
            },
          },
          {
            id: '3',
            payload: {
              package: 'react',
              version: '18.3.0',
            },
          },
        ],
        next_page_offset: null,
      });

      const packages = await vectorStore.listPackages();

      expect(packages).toHaveLength(2);
      expect(packages[0].name).toBe('next');
      expect(packages[0].versions).toEqual(['14.2.2', '14.2.1']);
      expect(packages[1].name).toBe('react');
      expect(packages[1].versions).toEqual(['18.3.0']);
    });

    it('should handle pagination in scroll', async () => {
      mockClient.scroll
        .mockResolvedValueOnce({
          points: [
            { id: '1', payload: { package: 'next', version: '14.2.2' } },
          ],
          next_page_offset: 'offset1',
        })
        .mockResolvedValueOnce({
          points: [
            { id: '2', payload: { package: 'react', version: '18.3.0' } },
          ],
          next_page_offset: null,
        });

      const packages = await vectorStore.listPackages();

      expect(mockClient.scroll).toHaveBeenCalledTimes(2);
      expect(packages).toHaveLength(2);
    });
  });

  describe('listVersions', () => {
    it('should return versions for a specific package', async () => {
      mockClient.scroll.mockResolvedValue({
        points: [
          {
            id: '1',
            payload: {
              package: 'next',
              version: '14.2.2',
            },
          },
          {
            id: '2',
            payload: {
              package: 'next',
              version: '14.2.2',
            },
          },
          {
            id: '3',
            payload: {
              package: 'next',
              version: '14.2.1',
            },
          },
        ],
        next_page_offset: null,
      });

      const versions = await vectorStore.listVersions('next');

      expect(mockClient.scroll).toHaveBeenCalledWith('documents', {
        filter: {
          must: [
            {
              key: 'package',
              match: { value: 'next' },
            },
          ],
        },
        limit: 1000,
        with_payload: ['package', 'version'],
      });

      expect(versions).toHaveLength(2);
      expect(versions[0].version).toBe('14.2.2');
      expect(versions[0].doc_count).toBe(2);
      expect(versions[1].version).toBe('14.2.1');
      expect(versions[1].doc_count).toBe(1);
    });

    it('should throw error for non-existent package', async () => {
      mockClient.scroll.mockResolvedValue({
        points: [],
        next_page_offset: null,
      });

      await expect(vectorStore.listVersions('unknown')).rejects.toThrow(
        'Package not found'
      );
    });
  });

  describe('deletePackageVersion', () => {
    it('should delete all points for a package version', async () => {
      await vectorStore.deletePackageVersion('next', '14.2.0');

      expect(mockClient.delete).toHaveBeenCalledWith('documents', {
        wait: true,
        filter: {
          must: [
            {
              key: 'package',
              match: { value: 'next' },
            },
            {
              key: 'version',
              match: { value: '14.2.0' },
            },
          ],
        },
      });
    });
  });

  describe('close', () => {
    it('should be a no-op for Qdrant', async () => {
      await expect(vectorStore.close()).resolves.not.toThrow();
    });
  });
});