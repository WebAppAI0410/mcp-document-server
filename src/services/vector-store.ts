import { DocumentResult, PackageInfo, VersionInfo } from '../types/mcp';

export interface SearchOptions {
  query: string;
  filter?: {
    package?: string;
    version?: string;
  };
  limit?: number;
}

export interface VectorDocument {
  id: string;
  content: string;
  embedding: number[];
  metadata: {
    package: string;
    version: string;
    url?: string;
    title?: string;
    section?: string;
  };
}

export abstract class VectorStore {
  abstract initialize(): Promise<void>;
  abstract addDocument(doc: VectorDocument): Promise<void>;
  abstract addDocuments(docs: VectorDocument[]): Promise<void>;
  abstract search(options: SearchOptions): Promise<DocumentResult[]>;
  abstract listPackages(): Promise<PackageInfo[]>;
  abstract listVersions(packageName: string): Promise<VersionInfo[]>;
  abstract deletePackageVersion(packageName: string, version: string): Promise<void>;
  abstract close(): Promise<void>;
}

export class MockVectorStore extends VectorStore {
  private documents: VectorDocument[] = [];

  async initialize(): Promise<void> {
    // Mock initialization
  }

  async addDocument(doc: VectorDocument): Promise<void> {
    this.documents.push(doc);
  }

  async addDocuments(docs: VectorDocument[]): Promise<void> {
    this.documents.push(...docs);
  }

  async search(options: SearchOptions): Promise<DocumentResult[]> {
    let filtered = this.documents;

    if (options.filter?.package) {
      filtered = filtered.filter(doc => doc.metadata.package === options.filter!.package);
    }

    if (options.filter?.version) {
      filtered = filtered.filter(doc => doc.metadata.version === options.filter!.version);
    }

    // Simple text search for mock
    const query = options.query.toLowerCase();
    const results = filtered
      .filter(doc => doc.content.toLowerCase().includes(query))
      .map(doc => ({
        content: doc.content,
        score: Math.random() * 0.5 + 0.5, // Mock score between 0.5 and 1
        metadata: doc.metadata,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, options.limit || 5);

    return results;
  }

  async listPackages(): Promise<PackageInfo[]> {
    const packageMap = new Map<string, Set<string>>();

    for (const doc of this.documents) {
      if (!packageMap.has(doc.metadata.package)) {
        packageMap.set(doc.metadata.package, new Set());
      }
      packageMap.get(doc.metadata.package)!.add(doc.metadata.version);
    }

    return Array.from(packageMap.entries()).map(([name, versions]) => ({
      name,
      versions: Array.from(versions).sort(),
      last_updated: new Date().toISOString(),
    }));
  }

  async listVersions(packageName: string): Promise<VersionInfo[]> {
    const versions = new Map<string, number>();

    for (const doc of this.documents) {
      if (doc.metadata.package === packageName) {
        const count = versions.get(doc.metadata.version) || 0;
        versions.set(doc.metadata.version, count + 1);
      }
    }

    if (versions.size === 0) {
      throw new Error('Package not found');
    }

    return Array.from(versions.entries()).map(([version, doc_count]) => ({
      version,
      release_date: new Date().toISOString(),
      doc_count,
      last_indexed: new Date().toISOString(),
    }));
  }

  async deletePackageVersion(packageName: string, version: string): Promise<void> {
    this.documents = this.documents.filter(
      doc => !(doc.metadata.package === packageName && doc.metadata.version === version)
    );
  }

  async close(): Promise<void> {
    // Mock close
  }
}