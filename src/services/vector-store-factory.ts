import { VectorStore, MockVectorStore } from './vector-store';
import { PostgresVectorStore } from './postgres-vector-store';
import { QdrantVectorStore } from './qdrant-vector-store';
import { config } from '../config';
import { logger } from '../utils/logger';

export enum VectorStoreType {
  MOCK = 'mock',
  SQLITE = 'sqlite',
  POSTGRES = 'postgres',
  QDRANT = 'qdrant',
}

export class VectorStoreFactory {
  private static instance: VectorStore | null = null;

  static async create(type?: VectorStoreType): Promise<VectorStore> {
    // Use singleton pattern to reuse connections
    if (this.instance) {
      return this.instance;
    }

    const storeType = type || (config.database.type as VectorStoreType);
    logger.info(`Creating vector store of type: ${storeType}`);

    let store: VectorStore;

    switch (storeType) {
      case VectorStoreType.POSTGRES:
        store = new PostgresVectorStore({
          host: config.database.postgres.host,
          port: config.database.postgres.port,
          database: config.database.postgres.database,
          user: config.database.postgres.user,
          password: config.database.postgres.password,
        });
        break;

      case VectorStoreType.QDRANT:
        store = new QdrantVectorStore({
          url: config.database.qdrant.url,
          apiKey: config.database.qdrant.apiKey,
        });
        break;

      case VectorStoreType.SQLITE:
        // TODO: Implement SQLiteVectorStore
        logger.warn('SQLite vector store not yet implemented, falling back to mock');
        store = new MockVectorStore();
        break;

      case VectorStoreType.MOCK:
        store = new MockVectorStore();
        break;

      default:
        throw new Error(`Unsupported vector store type: ${storeType as string}`);
    }

    // Initialize the store
    await store.initialize();
    
    // Cache the instance
    this.instance = store;
    
    return store;
  }

  static async close(): Promise<void> {
    if (this.instance) {
      await this.instance.close();
      this.instance = null;
    }
  }

  static reset(): void {
    // Reset the instance (useful for testing)
    this.instance = null;
  }
}