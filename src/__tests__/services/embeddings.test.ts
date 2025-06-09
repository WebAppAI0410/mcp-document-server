import { EmbeddingService, EmbeddingProvider } from '../../services/embeddings';
import OpenAI from 'openai';

jest.mock('openai');

describe('EmbeddingService', () => {
  let embeddingService: EmbeddingService;
  let mockOpenAI: jest.Mocked<OpenAI>;

  beforeEach(() => {
    mockOpenAI = {
      embeddings: {
        create: jest.fn(),
      },
    } as any;

    (OpenAI as any).mockImplementation(() => mockOpenAI);
  });

  describe('OpenAI Provider', () => {
    beforeEach(() => {
      process.env.OPENAI_API_KEY = 'test-key';
      embeddingService = new EmbeddingService({
        provider: EmbeddingProvider.OPENAI,
        model: 'text-embedding-3-small',
      });
    });

    it('should generate embeddings for single text', async () => {
      const text = 'How to use React hooks';
      const mockEmbedding = new Array(1536).fill(0).map(() => Math.random());

      mockOpenAI.embeddings.create.mockResolvedValue({
        data: [{ embedding: mockEmbedding, index: 0, object: 'embedding' }],
        model: 'text-embedding-3-small',
        usage: { prompt_tokens: 10, total_tokens: 10 },
        object: 'list',
      } as any);

      const result = await embeddingService.embed(text);

      expect(mockOpenAI.embeddings.create).toHaveBeenCalledWith({
        model: 'text-embedding-3-small',
        input: text,
      });

      expect(result).toEqual(mockEmbedding);
      expect(result).toHaveLength(1536);
    });

    it('should batch embed multiple texts', async () => {
      const texts = [
        'React hooks documentation',
        'Next.js app router',
        'Convex mutations',
      ];

      const mockEmbeddings = texts.map(() => 
        new Array(1536).fill(0).map(() => Math.random())
      );

      mockOpenAI.embeddings.create.mockResolvedValue({
        data: mockEmbeddings.map((embedding, index) => ({
          embedding,
          index,
          object: 'embedding',
        })),
        model: 'text-embedding-3-small',
        usage: { prompt_tokens: 30, total_tokens: 30 },
        object: 'list',
      } as any);

      const results = await embeddingService.batchEmbed(texts);

      expect(mockOpenAI.embeddings.create).toHaveBeenCalledWith({
        model: 'text-embedding-3-small',
        input: texts,
      });

      expect(results).toHaveLength(3);
      results.forEach((result, index) => {
        expect(result).toEqual(mockEmbeddings[index]);
      });
    });

    it('should handle API errors gracefully', async () => {
      mockOpenAI.embeddings.create.mockRejectedValue(
        new Error('API rate limit exceeded')
      );

      await expect(embeddingService.embed('test')).rejects.toThrow(
        'API rate limit exceeded'
      );
    });
  });

  describe('Ollama Provider', () => {
    beforeEach(() => {
      embeddingService = new EmbeddingService({
        provider: EmbeddingProvider.OLLAMA,
        model: 'bge-small-en',
        baseUrl: 'http://localhost:11434',
      });
    });

    it('should generate embeddings using Ollama', async () => {
      const text = 'Test document';
      const mockEmbedding = new Array(384).fill(0).map(() => Math.random());

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ embedding: mockEmbedding }),
      } as Response);

      const result = await embeddingService.embed(text);

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:11434/api/embeddings',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'bge-small-en',
            prompt: text,
          }),
        })
      );

      expect(result).toEqual(mockEmbedding);
    });

    it('should handle Ollama connection errors', async () => {
      global.fetch = jest.fn().mockRejectedValue(
        new Error('Connection refused')
      );

      await expect(embeddingService.embed('test')).rejects.toThrow(
        'Connection refused'
      );
    });
  });

  describe('Embedding chunking', () => {
    beforeEach(() => {
      process.env.OPENAI_API_KEY = 'test-key';
      embeddingService = new EmbeddingService({
        provider: EmbeddingProvider.OPENAI,
        model: 'text-embedding-3-small',
        maxTokensPerChunk: 100,
      });
    });

    it('should chunk long texts before embedding', async () => {
      const longText = 'This is a very long text. '.repeat(100);
      const chunks = embeddingService['chunkText'](longText);

      expect(chunks.length).toBeGreaterThan(1);
      chunks.forEach(chunk => {
        expect(chunk.length).toBeLessThanOrEqual(400); // ~100 tokens
      });
    });

    it('should preserve sentence boundaries when chunking', async () => {
      const text = 'First sentence. Second sentence. Third sentence. Fourth sentence.';
      const chunks = embeddingService['chunkText'](text);

      chunks.forEach(chunk => {
        expect(chunk).toMatch(/\.(\s|$)/); // Should end with a period
      });
    });
  });
});