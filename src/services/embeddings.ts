import OpenAI from 'openai';
import { config } from '../config';

export enum EmbeddingProvider {
  OPENAI = 'openai',
  OLLAMA = 'ollama',
}

export interface EmbeddingOptions {
  provider: EmbeddingProvider;
  model: string;
  baseUrl?: string;
  maxTokensPerChunk?: number;
}

export class EmbeddingService {
  private provider: EmbeddingProvider;
  private model: string;
  private openai?: OpenAI;
  private ollamaBaseUrl?: string;
  private maxTokensPerChunk: number;

  constructor(options: EmbeddingOptions) {
    this.provider = options.provider;
    this.model = options.model;
    this.maxTokensPerChunk = options.maxTokensPerChunk || 8191;

    if (this.provider === EmbeddingProvider.OPENAI) {
      if (!config.openai.apiKey) {
        throw new Error('OpenAI API key is required');
      }
      this.openai = new OpenAI({ apiKey: config.openai.apiKey });
    } else if (this.provider === EmbeddingProvider.OLLAMA) {
      this.ollamaBaseUrl = options.baseUrl || config.ollama.baseUrl;
    }
  }

  async embed(text: string): Promise<number[]> {
    const chunks = this.chunkText(text);
    
    if (chunks.length === 1) {
      return this.embedSingle(chunks[0]);
    }

    const embeddings = await this.batchEmbed(chunks);
    return this.averageEmbeddings(embeddings);
  }

  async batchEmbed(texts: string[]): Promise<number[][]> {
    if (this.provider === EmbeddingProvider.OPENAI) {
      return this.batchEmbedOpenAI(texts);
    } else if (this.provider === EmbeddingProvider.OLLAMA) {
      return this.batchEmbedOllama(texts);
    }
    throw new Error(`Unsupported provider: ${this.provider as string}`);
  }

  private async embedSingle(text: string): Promise<number[]> {
    if (this.provider === EmbeddingProvider.OPENAI) {
      const response = await this.openai!.embeddings.create({
        model: this.model,
        input: text,
      });
      return response.data[0].embedding;
    } else if (this.provider === EmbeddingProvider.OLLAMA) {
      const response = await fetch(`${this.ollamaBaseUrl}/api/embeddings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          prompt: text,
        }),
      });

      if (!response.ok) {
        throw new Error(`Ollama embedding failed: ${response.statusText}`);
      }

      const data = await response.json() as { embedding: number[] };
      return data.embedding;
    }

    throw new Error(`Unsupported provider: ${this.provider as string}`);
  }

  private async batchEmbedOpenAI(texts: string[]): Promise<number[][]> {
    const response = await this.openai!.embeddings.create({
      model: this.model,
      input: texts,
    });

    return response.data.map(item => item.embedding);
  }

  private async batchEmbedOllama(texts: string[]): Promise<number[][]> {
    const embeddings = await Promise.all(
      texts.map(text => this.embedSingle(text))
    );
    return embeddings;
  }

  private chunkText(text: string): string[] {
    const estimatedTokens = text.length / 4;
    
    if (estimatedTokens <= this.maxTokensPerChunk) {
      return [text];
    }

    const chunks: string[] = [];
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
    let currentChunk = '';

    for (const sentence of sentences) {
      const chunkWithSentence = currentChunk + sentence;
      const estimatedTokens = chunkWithSentence.length / 4;

      if (estimatedTokens > this.maxTokensPerChunk && currentChunk) {
        chunks.push(currentChunk.trim());
        currentChunk = sentence;
      } else {
        currentChunk = chunkWithSentence;
      }
    }

    if (currentChunk) {
      chunks.push(currentChunk.trim());
    }

    return chunks;
  }

  private averageEmbeddings(embeddings: number[][]): number[] {
    if (embeddings.length === 0) {
      throw new Error('No embeddings to average');
    }

    const dimension = embeddings[0].length;
    const averaged = new Array<number>(dimension).fill(0);

    for (const embedding of embeddings) {
      for (let i = 0; i < dimension; i++) {
        averaged[i] += embedding[i];
      }
    }

    for (let i = 0; i < dimension; i++) {
      averaged[i] /= embeddings.length;
    }

    return averaged;
  }
}