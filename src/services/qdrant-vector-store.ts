import { QdrantClient } from '@qdrant/js-client-rest';
import { VectorStore, VectorDocument, SearchOptions, DocumentResult, PackageInfo, VersionInfo } from './vector-store';
import { EmbeddingService, EmbeddingProvider } from './embeddings';
import { config } from '../config';
import { logger } from '../utils/logger';

export interface QdrantConfig {
  url: string;
  apiKey?: string;
}

export class QdrantVectorStore extends VectorStore {
  private client: QdrantClient;
  private embeddingService: EmbeddingService;
  private collectionName = 'documents';
  private embeddingDimension: number = 1536; // Default for OpenAI
  private batchSize = 100;

  constructor(qdrantConfig: QdrantConfig) {
    super();
    this.client = new QdrantClient({
      url: qdrantConfig.url,
      apiKey: qdrantConfig.apiKey,
    });

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
    try {
      const collectionExists = await this.client.collectionExists(this.collectionName);

      if (!collectionExists.exists) {
        await this.client.createCollection(this.collectionName, {
          vectors: {
            size: this.embeddingDimension,
            distance: 'Cosine',
          },
          optimizers_config: {
            default_segment_number: 2,
          },
          replication_factor: 2,
        });

        void logger.info(`Created Qdrant collection: ${this.collectionName}`);
      } else {
        void logger.info(`Qdrant collection already exists: ${this.collectionName}`);
      }
    } catch (error) {
      void logger.error('Failed to initialize Qdrant vector store:', error);
      throw error;
    }
  }

  async addDocument(doc: VectorDocument): Promise<void> {
    try {
      await this.client.upsert(this.collectionName, {
        wait: true,
        points: [
          {
            id: doc.id,
            vector: doc.embedding,
            payload: {
              content: doc.content,
              package: doc.metadata.package,
              version: doc.metadata.version,
              url: doc.metadata.url || null,
              title: doc.metadata.title || null,
              section: doc.metadata.section || null,
            },
          },
        ],
      });
    } catch (error) {
      void logger.error('Failed to add document to Qdrant:', error);
      throw error;
    }
  }

  async addDocuments(docs: VectorDocument[]): Promise<void> {
    try {
      // Process in batches
      for (let i = 0; i < docs.length; i += this.batchSize) {
        const batch = docs.slice(i, i + this.batchSize);
        
        const points = batch.map(doc => ({
          id: doc.id,
          vector: doc.embedding,
          payload: {
            content: doc.content,
            package: doc.metadata.package,
            version: doc.metadata.version,
            url: doc.metadata.url || null,
            title: doc.metadata.title || null,
            section: doc.metadata.section || null,
          },
        }));

        await this.client.upsert(this.collectionName, {
          wait: true,
          points,
        });

        void logger.info(`Added batch ${i / this.batchSize + 1} of ${Math.ceil(docs.length / this.batchSize)}`);
      }

      void logger.info(`Added ${docs.length} documents to Qdrant successfully`);
    } catch (error) {
      void logger.error('Failed to add documents batch to Qdrant:', error);
      throw error;
    }
  }

  async search(options: SearchOptions): Promise<DocumentResult[]> {
    try {
      // Generate embedding for query
      const queryEmbedding = await this.generateQueryEmbedding(options.query);

      // Build filter
      interface QdrantFilter {
        must?: Array<{
          key: string;
          match: { value: string };
        }>;
      }
      const filter: QdrantFilter = {};
      if (options.filter?.package || options.filter?.version) {
        filter.must = [];
        
        if (options.filter.package) {
          filter.must.push({
            key: 'package',
            match: { value: options.filter.package },
          });
        }

        if (options.filter.version) {
          filter.must.push({
            key: 'version',
            match: { value: options.filter.version },
          });
        }
      }

      interface QdrantSearchParams {
        vector: number[];
        limit: number;
        with_payload: boolean;
        filter?: QdrantFilter;
      }
      const searchParams: QdrantSearchParams = {
        vector: queryEmbedding,
        limit: options.limit || 5,
        with_payload: true,
      };

      if (filter.must) {
        searchParams.filter = filter;
      }

      const results = await this.client.search(this.collectionName, searchParams);

      interface QdrantSearchResult {
        id?: string | number;
        score?: number;
        payload?: Record<string, unknown>;
      }

      return (results as QdrantSearchResult[]).map((point) => ({
        content: point.payload!.content as string,
        score: point.score || 0,
        metadata: {
          package: point.payload!.package as string,
          version: point.payload!.version as string,
          url: point.payload!.url as string | undefined,
          title: point.payload!.title as string | undefined,
          section: point.payload!.section as string | undefined,
        },
      }));
    } catch (error) {
      void logger.error('Qdrant search failed:', error);
      throw error;
    }
  }

  async listPackages(): Promise<PackageInfo[]> {
    try {
      const packageMap = new Map<string, Set<string>>();
      let offset: string | number | null = null;

      // Scroll through all documents
      do {
        const scrollResult = await this.client.scroll(this.collectionName, {
          limit: 1000,
          offset,
          with_payload: ['package', 'version'],
        });

        for (const point of scrollResult.points) {
          const pkg = point.payload!.package as string;
          const version = point.payload!.version as string;

          if (!packageMap.has(pkg)) {
            packageMap.set(pkg, new Set());
          }
          packageMap.get(pkg)!.add(version);
        }

        offset = scrollResult.next_page_offset as string | number | null;
      } while (offset !== null);

      // Convert to PackageInfo array
      const packages: PackageInfo[] = Array.from(packageMap.entries()).map(([name, versions]) => ({
        name,
        versions: Array.from(versions).sort((a, b) => b.localeCompare(a)),
        last_updated: new Date().toISOString(), // Qdrant doesn't track this
      }));

      return packages.sort((a, b) => a.name.localeCompare(b.name));
    } catch (error) {
      void logger.error('Failed to list packages from Qdrant:', error);
      throw error;
    }
  }

  async listVersions(packageName: string): Promise<VersionInfo[]> {
    try {
      const versionMap = new Map<string, number>();
      let offset: string | number | null = null;

      // Scroll through documents for this package
      do {
        const scrollResult = await this.client.scroll(this.collectionName, {
          filter: {
            must: [
              {
                key: 'package',
                match: { value: packageName },
              },
            ],
          },
          limit: 1000,
          offset,
          with_payload: ['package', 'version'],
        });

        for (const point of scrollResult.points) {
          const version = point.payload!.version as string;
          versionMap.set(version, (versionMap.get(version) || 0) + 1);
        }

        offset = scrollResult.next_page_offset as string | number | null;
      } while (offset !== null);

      if (versionMap.size === 0) {
        throw new Error('Package not found');
      }

      // Convert to VersionInfo array
      const versions: VersionInfo[] = Array.from(versionMap.entries()).map(([version, count]) => ({
        version,
        release_date: new Date().toISOString(), // Qdrant doesn't track this
        doc_count: count,
        last_indexed: new Date().toISOString(), // Qdrant doesn't track this
      }));

      return versions.sort((a, b) => b.version.localeCompare(a.version));
    } catch (error) {
      void logger.error(`Failed to list versions for package ${packageName} from Qdrant:`, error);
      throw error;
    }
  }

  async deletePackageVersion(packageName: string, version: string): Promise<void> {
    try {
      await this.client.delete(this.collectionName, {
        wait: true,
        filter: {
          must: [
            {
              key: 'package',
              match: { value: packageName },
            },
            {
              key: 'version',
              match: { value: version },
            },
          ],
        },
      });

      void logger.info(`Deleted documents for ${packageName}@${version} from Qdrant`);
    } catch (error) {
      void logger.error(`Failed to delete ${packageName}@${version} from Qdrant:`, error);
      throw error;
    }
  }

  close(): Promise<void> {
    // Qdrant client doesn't need explicit closing
    void logger.info('Qdrant vector store closed');
    return Promise.resolve();
  }

  private async generateQueryEmbedding(query: string): Promise<number[]> {
    return this.embeddingService.embed(query);
  }
}