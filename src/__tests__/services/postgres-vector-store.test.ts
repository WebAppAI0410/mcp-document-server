import { PostgresVectorStore } from '../../services/postgres-vector-store';
import { VectorDocument } from '../../services/vector-store';
import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';

jest.mock('pg');

describe('PostgresVectorStore', () => {
  let vectorStore: PostgresVectorStore;
  let mockPool: jest.Mocked<Pool>;
  let mockClient: any;

  beforeEach(() => {
    mockClient = {
      query: jest.fn(),
      release: jest.fn(),
    };

    mockPool = {
      connect: jest.fn().mockResolvedValue(mockClient),
      query: jest.fn(),
      end: jest.fn(),
    } as any;

    (Pool as any).mockImplementation(() => mockPool);

    vectorStore = new PostgresVectorStore({
      host: 'localhost',
      port: 5432,
      database: 'test_db',
      user: 'test_user',
      password: 'test_password',
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('initialize', () => {
    it('should create tables and extensions', async () => {
      await vectorStore.initialize();

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('CREATE EXTENSION IF NOT EXISTS vector')
      );

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('CREATE TABLE IF NOT EXISTS documents')
      );

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('CREATE INDEX IF NOT EXISTS')
      );

      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should handle initialization errors', async () => {
      mockClient.query.mockRejectedValueOnce(new Error('Connection failed'));

      await expect(vectorStore.initialize()).rejects.toThrow('Connection failed');
      expect(mockClient.release).toHaveBeenCalled();
    });
  });

  describe('addDocument', () => {
    it('should insert a document with embedding', async () => {
      const doc: VectorDocument = {
        id: uuidv4(),
        content: 'Test document content',
        embedding: new Array(1536).fill(0).map(() => Math.random()),
        metadata: {
          package: 'next',
          version: '14.2.2',
          url: 'https://nextjs.org/docs/test',
          title: 'Test Page',
        },
      };

      await vectorStore.addDocument(doc);

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO documents'),
        [
          doc.id,
          doc.content,
          JSON.stringify(doc.embedding),
          doc.metadata.package,
          doc.metadata.version,
          doc.metadata.url,
          doc.metadata.title,
          doc.metadata.section,
        ]
      );
    });

    it('should handle duplicate document IDs', async () => {
      const doc: VectorDocument = {
        id: 'duplicate-id',
        content: 'Content',
        embedding: [0.1, 0.2, 0.3],
        metadata: {
          package: 'react',
          version: '18.3.0',
        },
      };

      mockPool.query.mockRejectedValueOnce({
        code: '23505', // PostgreSQL unique violation
        message: 'Duplicate key',
      });

      await expect(vectorStore.addDocument(doc)).rejects.toThrow();
    });
  });

  describe('addDocuments', () => {
    it('should batch insert multiple documents', async () => {
      const docs: VectorDocument[] = [
        {
          id: uuidv4(),
          content: 'Doc 1',
          embedding: [0.1, 0.2],
          metadata: { package: 'next', version: '14.2.2' },
        },
        {
          id: uuidv4(),
          content: 'Doc 2',
          embedding: [0.3, 0.4],
          metadata: { package: 'next', version: '14.2.2' },
        },
      ];

      await vectorStore.addDocuments(docs);

      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledTimes(docs.length + 2); // BEGIN + inserts + COMMIT
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should rollback on batch insert failure', async () => {
      const docs: VectorDocument[] = [
        {
          id: uuidv4(),
          content: 'Doc 1',
          embedding: [0.1, 0.2],
          metadata: { package: 'next', version: '14.2.2' },
        },
      ];

      mockClient.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockRejectedValueOnce(new Error('Insert failed')); // INSERT

      await expect(vectorStore.addDocuments(docs)).rejects.toThrow('Insert failed');
      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(mockClient.release).toHaveBeenCalled();
    });
  });

  describe('search', () => {
    it('should perform vector similarity search', async () => {
      const mockResults = {
        rows: [
          {
            id: 'doc1',
            content: 'React hooks documentation',
            metadata: {
              package: 'react',
              version: '18.3.0',
              url: 'https://react.dev/hooks',
              title: 'Hooks',
            },
            similarity: 0.95,
          },
          {
            id: 'doc2',
            content: 'Using useEffect hook',
            metadata: {
              package: 'react',
              version: '18.3.0',
              url: 'https://react.dev/hooks/useeffect',
              title: 'useEffect',
            },
            similarity: 0.88,
          },
        ],
      };

      // Mock embedding generation
      const mockEmbedding = new Array(1536).fill(0.1);
      vectorStore['generateQueryEmbedding'] = jest.fn().mockResolvedValue(mockEmbedding);

      mockPool.query.mockResolvedValueOnce(mockResults);

      const results = await vectorStore.search({
        query: 'react hooks',
        filter: {
          package: 'react',
          version: '18.3.0',
        },
        limit: 5,
      });

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT'),
        expect.arrayContaining([
          JSON.stringify(mockEmbedding),
          'react',
          '18.3.0',
          5,
        ])
      );

      expect(results).toHaveLength(2);
      expect(results[0].score).toBe(0.95);
      expect(results[0].metadata.package).toBe('react');
    });

    it('should search without filters', async () => {
      const mockEmbedding = new Array(1536).fill(0.1);
      vectorStore['generateQueryEmbedding'] = jest.fn().mockResolvedValue(mockEmbedding);

      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await vectorStore.search({
        query: 'any query',
        limit: 10,
      });

      const queryCall = mockPool.query.mock.calls[0];
      expect(queryCall[0]).not.toContain('WHERE package = $2');
      expect(queryCall[1]).toHaveLength(2); // Only embedding and limit
    });
  });

  describe('listPackages', () => {
    it('should return all unique packages with versions', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [
          {
            package: 'next',
            versions: ['14.2.2', '14.2.1', '14.2.0'],
            doc_count: 150,
            last_updated: new Date('2024-05-01'),
          },
          {
            package: 'react',
            versions: ['18.3.0', '18.2.0'],
            doc_count: 100,
            last_updated: new Date('2024-04-15'),
          },
        ],
      });

      const packages = await vectorStore.listPackages();

      expect(packages).toHaveLength(2);
      expect(packages[0].name).toBe('next');
      expect(packages[0].versions).toEqual(['14.2.2', '14.2.1', '14.2.0']);
      expect(packages[1].name).toBe('react');
    });
  });

  describe('listVersions', () => {
    it('should return versions for a specific package', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [
          {
            version: '14.2.2',
            doc_count: 50,
            created_at: new Date('2024-05-01'),
            updated_at: new Date('2024-05-02'),
          },
          {
            version: '14.2.1',
            doc_count: 48,
            created_at: new Date('2024-04-15'),
            updated_at: new Date('2024-04-16'),
          },
        ],
      });

      const versions = await vectorStore.listVersions('next');

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT version'),
        ['next']
      );

      expect(versions).toHaveLength(2);
      expect(versions[0].version).toBe('14.2.2');
      expect(versions[0].doc_count).toBe(50);
    });

    it('should throw error for non-existent package', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await expect(vectorStore.listVersions('unknown')).rejects.toThrow(
        'Package not found'
      );
    });
  });

  describe('deletePackageVersion', () => {
    it('should delete all documents for a package version', async () => {
      mockPool.query.mockResolvedValueOnce({ rowCount: 25 });

      await vectorStore.deletePackageVersion('next', '14.2.0');

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM documents'),
        ['next', '14.2.0']
      );
    });
  });

  describe('close', () => {
    it('should close the database connection pool', async () => {
      await vectorStore.close();
      expect(mockPool.end).toHaveBeenCalled();
    });
  });
});