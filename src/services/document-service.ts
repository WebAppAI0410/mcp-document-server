import { VectorStore } from './vector-store';
import {
  QueryDocsRequest,
  QueryDocsResponse,
  ListPackagesResponse,
  ListVersionsResponse,
  DocumentResult,
} from '../types/mcp';

export class DocumentService {
  constructor(private vectorStore: VectorStore) {}

  async queryDocuments(request: QueryDocsRequest): Promise<QueryDocsResponse> {
    const startTime = Date.now();

    const searchResults = await this.vectorStore.search({
      query: request.question,
      filter: {
        package: request.library,
        version: request.version,
      },
      limit: 5,
    });

    let results = searchResults;

    // Apply max_tokens limit if specified
    if (request.max_tokens) {
      results = this.truncateResults(results, request.max_tokens);
    }

    // Add citations if requested
    if (request.include_citations) {
      results = this.addCitations(results);
    }

    const queryTime = Date.now() - startTime;

    return {
      results,
      total_results: results.length,
      query_time_ms: queryTime,
    };
  }

  async listPackages(): Promise<ListPackagesResponse> {
    const packages = await this.vectorStore.listPackages();
    return { packages };
  }

  async listVersions(packageName: string): Promise<ListVersionsResponse> {
    const versions = await this.vectorStore.listVersions(packageName);
    return {
      package: packageName,
      versions,
    };
  }

  private truncateResults(results: DocumentResult[], maxTokens: number): DocumentResult[] {
    const tokensPerChar = 0.25; // Rough estimate
    const maxChars = maxTokens / tokensPerChar;

    return results.map(result => ({
      ...result,
      content: result.content.slice(0, maxChars),
    }));
  }

  private addCitations(results: DocumentResult[]): DocumentResult[] {
    return results.map(result => ({
      ...result,
      citations: result.metadata.url ? [result.metadata.url] : [],
    }));
  }
}