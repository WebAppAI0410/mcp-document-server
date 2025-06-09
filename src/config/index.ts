import dotenv from 'dotenv';

dotenv.config();

export const config = {
  server: {
    port: parseInt(process.env.PORT || '6111', 10),
    host: process.env.HOST || '127.0.0.1',
    nodeEnv: process.env.NODE_ENV || 'development',
  },
  auth: {
    token: process.env.AUTH_TOKEN,
    allowLocalhost: true,
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    embeddingModel: process.env.EMBEDDING_MODEL || 'text-embedding-3-small',
  },
  database: {
    type: process.env.DB_TYPE || 'sqlite',
    sqlite: {
      path: process.env.SQLITE_PATH || './data/vectors.db',
    },
    postgres: {
      host: process.env.POSTGRES_HOST || 'localhost',
      port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
      database: process.env.POSTGRES_DB || 'mcp_docs',
      user: process.env.POSTGRES_USER || 'postgres',
      password: process.env.POSTGRES_PASSWORD || 'password',
    },
    qdrant: {
      url: process.env.QDRANT_URL || 'http://localhost:6333',
      apiKey: process.env.QDRANT_API_KEY,
    },
  },
  ollama: {
    baseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
    embeddingModel: process.env.OLLAMA_EMBEDDING_MODEL || 'bge-small-en',
  },
  storage: {
    rawDocsPath: process.env.RAW_DOCS_PATH || './raw_docs',
    vectorDataPath: process.env.VECTOR_DATA_PATH || './vector_data',
  },
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    file: process.env.LOG_FILE || './logs/mcp-server.log',
  },
  performance: {
    maxConcurrentEmbeddings: parseInt(process.env.MAX_CONCURRENT_EMBEDDINGS || '5', 10),
    embeddingBatchSize: parseInt(process.env.EMBEDDING_BATCH_SIZE || '100', 10),
    cacheTTL: parseInt(process.env.CACHE_TTL || '1800', 10),
  },
  rateLimit: {
    max: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
    timeWindow: parseInt(process.env.RATE_LIMIT_TIMEWINDOW || '60000', 10),
  },
};

export type Config = typeof config;