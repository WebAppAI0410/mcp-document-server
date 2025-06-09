# MCP Document Server - Development Guide

This project implements a Model Context Protocol (MCP) server that provides version-specific documentation for various technologies to reduce app development errors.

## Project Overview

### Purpose
Enable LLMs like Claude Code to access exact documentation versions matching project dependencies, preventing API changes, deprecation issues, and type mismatches.

### Key Features
- Version-specific documentation (e.g., `next@14.2.2`)
- Semantic search with vector embeddings
- Multiple vector DB support (PostgreSQL pgvector, Qdrant, SQLite)
- Offline embeddings with Ollama
- Hot-reload within 30 seconds
- MCP protocol compliance

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌──────────────┐
│  LLM Host   │───►│  MCP Server │───►│  Vector DB   │
│(Claude Code)│     │  (Fastify)  │     │(PG/Qdrant)  │
└─────────────┘     └─────────────┘     └──────────────┘
                           │
                           ▼
                    ┌─────────────┐
                    │  Scraper    │
                    │  Service    │
                    └─────────────┘
```

## Core Components

### 1. MCP API Server (`src/server/`)
- **Framework**: Fastify
- **Routes**: `/v1/tools`, `/v1/query-docs`, `/v1/packages`
- **Auth**: Token-based with localhost bypass
- **Rate limiting**: 100 req/min

### 2. Vector Stores (`src/services/*-vector-store.ts`)
- **PostgresVectorStore**: Uses pgvector extension
- **QdrantVectorStore**: REST API client
- **MockVectorStore**: For testing
- **Factory Pattern**: `VectorStoreFactory` for runtime selection

### 3. Document Processing
- **Scraper**: HTML to Markdown conversion with presets
- **Embeddings**: OpenAI (1536d) or Ollama (384d)
- **Chunking**: Smart text splitting with overlap

### 4. CLI Tools (`src/cli/`)
- **add-source**: Scrape and index documentation
- **Presets**: Configured for Next.js, React, Convex, etc.

## Development Workflow

### Running Tests
```bash
npm test                 # Run all tests
npm run test:watch       # Watch mode
npm run test:coverage    # Coverage report
```

### Type Checking & Linting
```bash
npm run typecheck
npm run lint
```

### Local Development
```bash
# Start dependencies
docker compose -f docker-compose.dev.yml up -d

# Run server
npm run dev

# Add documentation
npm run add-source next 14.2.2 https://nextjs.org/docs --preset nextjs
```

## Testing Strategy

### Unit Tests
- Vector store implementations
- Document service logic
- Embedding service
- Scraper functionality

### Integration Tests
- API endpoints
- Database connections
- MCP protocol compliance

### Test Structure
```
src/__tests__/
├── server/          # API tests
├── services/        # Service tests
└── setup.ts         # Test configuration
```

## Configuration

### Environment Variables
- `DB_TYPE`: sqlite | postgres | qdrant
- `OPENAI_API_KEY`: For embeddings
- `PORT`: Server port (default: 6111)
- `AUTH_TOKEN`: API authentication

### Database Selection
The system automatically selects the appropriate vector store based on `DB_TYPE`:
- Development: SQLite or Mock
- Production: PostgreSQL with pgvector
- Large scale: Qdrant

## Common Tasks

### Adding New Documentation Source
1. Create preset in `scraper-presets.ts`
2. Test scraping with dry-run
3. Run indexing with `add-source`
4. Verify with `/v1/packages` endpoint

### Debugging Vector Search
1. Check embedding generation
2. Verify vector dimensions match
3. Test similarity thresholds
4. Review filter conditions

### Performance Optimization
- Batch document insertions
- Use connection pooling
- Enable query caching
- Optimize vector indexes

## Docker Deployment

### Production
```bash
docker compose up -d
```

### Development
```bash
docker compose -f docker-compose.dev.yml up -d
```

## CI/CD Pipeline

### GitHub Actions
1. **CI**: Tests, linting, type checking
2. **Release**: Docker image building
3. **Docs Update**: Daily documentation checks
4. **Dependabot**: Weekly dependency updates

## Troubleshooting

### Common Issues
1. **Embedding dimension mismatch**: Check model configuration
2. **Connection timeouts**: Verify database connectivity
3. **Rate limiting**: Adjust `RATE_LIMIT_MAX`
4. **Memory usage**: Tune batch sizes

### Debug Commands
```bash
# Check server health
curl http://localhost:6111/healthz

# List packages
curl http://localhost:6111/v1/packages

# Test vector store connection
npm run test -- postgres-vector-store.test.ts
```

## Future Enhancements
- [ ] SQLite vector store implementation
- [ ] Recursive web scraping
- [ ] Incremental updates
- [ ] Version change detection
- [ ] Custom embedding models
- [ ] Multi-language support