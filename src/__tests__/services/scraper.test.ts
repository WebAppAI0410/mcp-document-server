import { DocumentScraper } from '../../services/scraper';
import { ScraperPreset } from '../../services/scraper-presets';

describe('DocumentScraper', () => {
  let scraper: DocumentScraper;

  beforeEach(() => {
    scraper = new DocumentScraper();
  });

  describe('scrapeUrl', () => {
    it('should scrape HTML content and convert to markdown', async () => {
      const mockHtml = `
        <html>
          <head><title>Test Page</title></head>
          <body>
            <h1>Test Documentation</h1>
            <p>This is a test paragraph with <strong>bold text</strong>.</p>
            <ul>
              <li>Item 1</li>
              <li>Item 2</li>
            </ul>
            <pre><code>const example = "code";</code></pre>
          </body>
        </html>
      `;

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        text: async () => mockHtml,
      } as Response);

      const result = await scraper.scrapeUrl('https://example.com/docs');

      expect(result).toContain('# Test Documentation');
      expect(result).toContain('This is a test paragraph with **bold text**.');
      expect(result).toContain('* Item 1');
      expect(result).toContain('* Item 2');
      expect(result).toContain('```\nconst example = "code";\n```');
    });

    it('should handle fetch errors', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

      await expect(scraper.scrapeUrl('https://example.com')).rejects.toThrow(
        'Network error'
      );
    });

    it('should handle non-200 responses', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      } as Response);

      await expect(scraper.scrapeUrl('https://example.com')).rejects.toThrow(
        'HTTP 404: Not Found'
      );
    });
  });

  describe('scrapeWithPreset', () => {
    it('should apply preset selectors to extract content', async () => {
      const mockHtml = `
        <html>
          <body>
            <nav>Navigation content</nav>
            <main class="docs-content">
              <article>
                <h1>API Reference</h1>
                <p>Main documentation content</p>
              </article>
            </main>
            <footer>Footer content</footer>
          </body>
        </html>
      `;

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        text: async () => mockHtml,
      } as Response);

      const preset: ScraperPreset = {
        name: 'test-preset',
        contentSelector: '.docs-content',
        removeSelectors: ['nav', 'footer'],
        titleSelector: 'h1',
      };

      const result = await scraper.scrapeWithPreset(
        'https://example.com/docs',
        preset
      );

      expect(result.content).toContain('# API Reference');
      expect(result.content).toContain('Main documentation content');
      expect(result.content).not.toContain('Navigation content');
      expect(result.content).not.toContain('Footer content');
      expect(result.metadata.title).toBe('API Reference');
    });
  });

  describe('scrapeSitemap', () => {
    it('should parse sitemap and return URLs', async () => {
      const mockSitemap = `
        <?xml version="1.0" encoding="UTF-8"?>
        <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
          <url>
            <loc>https://example.com/docs/intro</loc>
            <lastmod>2024-01-01</lastmod>
          </url>
          <url>
            <loc>https://example.com/docs/api</loc>
            <lastmod>2024-01-02</lastmod>
          </url>
        </urlset>
      `;

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        text: async () => mockSitemap,
      } as Response);

      const urls = await scraper.scrapeSitemap('https://example.com/sitemap.xml');

      expect(urls).toHaveLength(2);
      expect(urls).toContain('https://example.com/docs/intro');
      expect(urls).toContain('https://example.com/docs/api');
    });

    it('should filter URLs by pattern', async () => {
      const mockSitemap = `
        <?xml version="1.0" encoding="UTF-8"?>
        <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
          <url><loc>https://example.com/docs/intro</loc></url>
          <url><loc>https://example.com/blog/post1</loc></url>
          <url><loc>https://example.com/docs/api</loc></url>
        </urlset>
      `;

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        text: async () => mockSitemap,
      } as Response);

      const urls = await scraper.scrapeSitemap(
        'https://example.com/sitemap.xml',
        /\/docs\//
      );

      expect(urls).toHaveLength(2);
      expect(urls).toContain('https://example.com/docs/intro');
      expect(urls).toContain('https://example.com/docs/api');
      expect(urls).not.toContain('https://example.com/blog/post1');
    });
  });

  describe('chunkDocument', () => {
    it('should split long documents into chunks', () => {
      const longContent = `
# Section 1
This is the first section with some content.

# Section 2
This is the second section with more content.

# Section 3
This is the third section with even more content.
      `.trim();

      const chunks = scraper.chunkDocument(longContent, {
        maxChunkSize: 100,
        overlap: 20,
      });

      expect(chunks.length).toBeGreaterThan(1);
      chunks.forEach(chunk => {
        expect(chunk.content.length).toBeLessThanOrEqual(120); // maxSize + overlap
      });

      // Check that chunks have proper metadata
      expect(chunks[0].metadata.section).toBe('Section 1');
      expect(chunks[1].metadata.section).toBeTruthy();
    });

    it('should maintain context between chunks with overlap', () => {
      const content = 'This is sentence one. This is sentence two. This is sentence three.';
      
      const chunks = scraper.chunkDocument(content, {
        maxChunkSize: 40,
        overlap: 15,
      });

      // Check that overlapping content exists
      for (let i = 1; i < chunks.length; i++) {
        const prevChunkEnd = chunks[i - 1].content.slice(-15);
        const currentChunkStart = chunks[i].content.slice(0, 15);
        
        // There should be some overlap
        expect(currentChunkStart).toContain(prevChunkEnd.split(' ').pop());
      }
    });
  });
});