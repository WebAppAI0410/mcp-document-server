export interface MCPToolProperty {
  type: string;
  description?: string;
  enum?: string[];
  items?: MCPToolProperty;
  properties?: Record<string, MCPToolProperty>;
  required?: string[];
  default?: unknown;
  [key: string]: unknown;
}

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, MCPToolProperty>;
    required?: string[];
  };
}

export interface MCPToolsResponse {
  tools: MCPTool[];
}

export interface QueryDocsRequest {
  library: string;
  version: string;
  question: string;
  max_tokens?: number;
  include_citations?: boolean;
}

export interface QueryDocsResponse {
  results: DocumentResult[];
  total_results: number;
  query_time_ms: number;
}

export interface DocumentResult {
  content: string;
  score: number;
  metadata: {
    package: string;
    version: string;
    url?: string;
    title?: string;
    section?: string;
  };
  citations?: string[];
}

export interface ListPackagesResponse {
  packages: PackageInfo[];
}

export interface PackageInfo {
  name: string;
  description?: string;
  versions: string[];
  last_updated: string;
}

export interface ListVersionsRequest {
  package: string;
}

export interface ListVersionsResponse {
  package: string;
  versions: VersionInfo[];
}

export interface VersionInfo {
  version: string;
  release_date: string;
  doc_count: number;
  last_indexed: string;
}