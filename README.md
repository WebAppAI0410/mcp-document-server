# MCP Document Server

A Model Context Protocol (MCP) server that provides version-specific documentation for reducing app development errors. It enables LLMs like Claude Code to access exact documentation versions matching your project dependencies.

## Features

- 🎯 **Version-Specific Documentation**: Access documentation for specific versions (e.g., `next@14.2.2`)
- 🔍 **Semantic & Keyword Search**: Intelligent document search with vector embeddings
- ⚡ **Real-time Updates**: Hot-reload documentation within 30 seconds
- 🏗️ **Multiple Vector DB Support**: SQLite, PostgreSQL with pgvector, or Qdrant
- 🤖 **Offline Embeddings**: Support for Ollama when OpenAI is unavailable
- 🔒 **Secure**: Token-based authentication with localhost bypass for development

## Supported Technologies

- Next.js / React / React Native
- Convex / Cloudflare Workers
- Mastra SDK / Python
- Expo / Clerk / Stripe

## Quick Start

### Using Docker Compose (Recommended)

```bash
# Clone the repository
git clone https://github.com/WebAppAI0410/mcp-document-server.git
cd mcp-document-server

# Copy environment variables
cp .env.example .env
# Edit .env with your OpenAI API key

# Start the server
docker compose up -d

# Add default documentation sources
./bin/add_default_sources.sh
```

### Local Development

```bash
# Install dependencies
npm install

# Start development databases
docker compose -f docker-compose.dev.yml up -d

# Start the server
npm run dev

# In another terminal, add documentation sources
npm run add-source next 14.2.2 https://nextjs.org/docs --preset nextjs
```

## Claude Code Integration

### 1. Register the MCP server

```bash
claude mcp add http://localhost:6111
```

### 2. Enable in your project

```bash
claude mcp enable
```

### 3. Use in Claude Code

The server will automatically be available for queries like:
- "Why does mutation require 'args' to be an object in Convex 1.6?"
- "How to handle errors in Next.js 14.2.2 app router?"

## API Endpoints

### MCP Tools

- `GET /v1/tools` - List available MCP tools
- `POST /v1/query-docs` - Search documentation
- `GET /v1/packages` - List indexed packages
- `GET /v1/packages/:package/versions` - List package versions

### Health Check

- `GET /healthz` - Server health status

## Configuration

Environment variables (see `.env.example`):

```env
# Server
PORT=6111
HOST=127.0.0.1

# OpenAI (for embeddings)
OPENAI_API_KEY=your-key
EMBEDDING_MODEL=text-embedding-3-small

# Database (choose one)
DB_TYPE=sqlite  # or postgres, qdrant
```

## Adding Documentation Sources

### Basic usage

```bash
npm run add-source <package> <version> <url>
```

### With preset

```bash
npm run add-source next 14.2.2 https://nextjs.org/docs --preset nextjs
```

### From sitemap

```bash
npm run add-source react 18.3.0 https://react.dev --sitemap https://react.dev/sitemap.xml
```

## Development

### Running tests

```bash
npm test              # Run tests
npm run test:watch    # Watch mode
npm run test:coverage # Coverage report
```

### Type checking and linting

```bash
npm run typecheck
npm run lint
```

### Building for production

```bash
npm run build
```

## Architecture

```
┌─────────────┐     ┌─────────────┐
│  LLM Host   │───►│  MCP Server │
│(Claude Code)│     │  (Fastify)  │
└─────────────┘     │  ├ API      │
                    │  ├ Vector DB │───► pgvector/Qdrant
                    │  └ Scraper   │
                    └─────────────┘
```

## Performance

- Single query latency: ≤ 300ms (@ 10 QPS)
- Concurrent embeddings: 5 workers
- Cache TTL: 30 minutes

## Security

- Token-based authentication for production
- Localhost bypass for development
- Rate limiting: 100 requests/minute

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT License - see [LICENSE](LICENSE) file for details

## Support

- Issues: [GitHub Issues](https://github.com/WebAppAI0410/mcp-document-server/issues)
- Documentation: [MCP Protocol Docs](https://modelcontextprotocol.io)
