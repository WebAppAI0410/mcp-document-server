import { Pool } from 'pg';
import { VectorStore, VectorDocument, SearchOptions, DocumentResult, PackageInfo, VersionInfo } from './vector-store';
import { EmbeddingService, EmbeddingProvider } from './embeddings';
import { config } from '../config';
import { logger } from '../utils/logger';

export interface PostgresConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
}

export class PostgresVectorStore extends VectorStore {
  private pool: Pool;
  private embeddingService: EmbeddingService;
  private embeddingDimension: number = 1536; // Default for OpenAI

  constructor(pgConfig: PostgresConfig) {
    super();
    this.pool = new Pool(pgConfig);
    
    // Initialize embedding service
    this.embeddingService = new EmbeddingService({
      provider: config.openai.apiKey ? EmbeddingProvider.OPENAI : EmbeddingProvider.OLLAMA,
      model: config.openai.apiKey ? config.openai.embeddingModel : config.ollama.embeddingModel,
    });

    // Adjust dimension based on model
    if (!config.openai.apiKey) {
      this.embeddingDimension = 384; // Common dimension for Ollama models
    }
  }

  async initialize(): Promise<void> {
    const client = await this.pool.connect();
    try {
      // Enable pgvector extension
      await client.query('CREATE EXTENSION IF NOT EXISTS vector');

      // Create documents table
      await client.query(`
        CREATE TABLE IF NOT EXISTS documents (
          id UUID PRIMARY KEY,
          content TEXT NOT NULL,
          embedding vector(${this.embeddingDimension}) NOT NULL,
          package VARCHAR(255) NOT NULL,
          version VARCHAR(100) NOT NULL,
          url TEXT,
          title TEXT,
          section TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Create indexes
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_documents_package_version 
        ON documents(package, version)
      `);

      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_documents_embedding 
        ON documents USING ivfflat (embedding vector_cosine_ops)
        WITH (lists = 100)
      `);

      void logger.info('PostgreSQL vector store initialized successfully');
    } catch (error) {
      void logger.error('Failed to initialize PostgreSQL vector store:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async addDocument(doc: VectorDocument): Promise<void> {
    const query = `
      INSERT INTO documents (id, content, embedding, package, version, url, title, section)
      VALUES ($1, $2, $3::vector, $4, $5, $6, $7, $8)
    `;

    const values = [
      doc.id,
      doc.content,
      JSON.stringify(doc.embedding),
      doc.metadata.package,
      doc.metadata.version,
      doc.metadata.url || null,
      doc.metadata.title || null,
      doc.metadata.section || null,
    ];

    try {
      await this.pool.query(query, values);
    } catch (error) {
      void logger.error('Failed to add document:', error);
      throw error;
    }
  }

  async addDocuments(docs: VectorDocument[]): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      for (const doc of docs) {
        const query = `
          INSERT INTO documents (id, content, embedding, package, version, url, title, section)
          VALUES ($1, $2, $3::vector, $4, $5, $6, $7, $8)
        `;

        const values = [
          doc.id,
          doc.content,
          JSON.stringify(doc.embedding),
          doc.metadata.package,
          doc.metadata.version,
          doc.metadata.url || null,
          doc.metadata.title || null,
          doc.metadata.section || null,
        ];

        await client.query(query, values);
      }

      await client.query('COMMIT');
      void logger.info(`Added ${docs.length} documents successfully`);
    } catch (error) {
      await client.query('ROLLBACK');
      void logger.error('Failed to add documents batch:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async search(options: SearchOptions): Promise<DocumentResult[]> {
    // Generate embedding for query
    const queryEmbedding = await this.generateQueryEmbedding(options.query);

    let query = `
      SELECT 
        id,
        content,
        package,
        version,
        url,
        title,
        section,
        1 - (embedding <=> $1::vector) AS similarity
      FROM documents
    `;

    const values: (string | number)[] = [JSON.stringify(queryEmbedding)];
    const conditions: string[] = [];

    if (options.filter?.package) {
      conditions.push(`package = $${values.length + 1}`);
      values.push(options.filter.package);
    }

    if (options.filter?.version) {
      conditions.push(`version = $${values.length + 1}`);
      values.push(options.filter.version);
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    query += ` ORDER BY embedding <=> $1::vector LIMIT $${values.length + 1}`;
    values.push(options.limit || 5);

    interface SearchResultRow {
      id: string;
      content: string;
      package: string;
      version: string;
      url?: string;
      title?: string;
      section?: string;
      similarity: number;
    }

    try {
      const result = await this.pool.query<SearchResultRow>(query, values);
      
      return result.rows.map(row => ({
        content: row.content,
        score: row.similarity,
        metadata: {
          package: row.package,
          version: row.version,
          url: row.url,
          title: row.title,
          section: row.section,
        },
      }));
    } catch (error) {
      void logger.error('Search failed:', error);
      throw error;
    }
  }

  async listPackages(): Promise<PackageInfo[]> {
    const query = `
      SELECT 
        package,
        array_agg(DISTINCT version ORDER BY version DESC) AS versions,
        COUNT(*) AS doc_count,
        MAX(updated_at) AS last_updated
      FROM documents
      GROUP BY package
      ORDER BY package
    `;

    interface PackageRow {
      package: string;
      versions: string[];
      doc_count: string;
      last_updated: Date;
    }

    try {
      const result = await this.pool.query<PackageRow>(query);
      
      return result.rows.map(row => ({
        name: row.package,
        versions: row.versions,
        last_updated: row.last_updated.toISOString(),
      }));
    } catch (error) {
      void logger.error('Failed to list packages:', error);
      throw error;
    }
  }

  async listVersions(packageName: string): Promise<VersionInfo[]> {
    const query = `
      SELECT 
        version,
        COUNT(*) AS doc_count,
        MIN(created_at) AS created_at,
        MAX(updated_at) AS updated_at
      FROM documents
      WHERE package = $1
      GROUP BY version
      ORDER BY version DESC
    `;

    interface VersionRow {
      version: string;
      doc_count: string;
      created_at: Date;
      updated_at: Date;
    }

    try {
      const result = await this.pool.query<VersionRow>(query, [packageName]);
      
      if (result.rows.length === 0) {
        throw new Error('Package not found');
      }

      return result.rows.map(row => ({
        version: row.version,
        release_date: row.created_at.toISOString(),
        doc_count: parseInt(row.doc_count, 10),
        last_indexed: row.updated_at.toISOString(),
      }));
    } catch (error) {
      void logger.error(`Failed to list versions for package ${packageName}:`, error);
      throw error;
    }
  }

  async deletePackageVersion(packageName: string, version: string): Promise<void> {
    const query = 'DELETE FROM documents WHERE package = $1 AND version = $2';
    
    try {
      const result = await this.pool.query(query, [packageName, version]);
      void logger.info(`Deleted ${result.rowCount} documents for ${packageName}@${version}`);
    } catch (error) {
      void logger.error(`Failed to delete ${packageName}@${version}:`, error);
      throw error;
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
    void logger.info('PostgreSQL connection pool closed');
  }

  private async generateQueryEmbedding(query: string): Promise<number[]> {
    return this.embeddingService.embed(query);
  }
}