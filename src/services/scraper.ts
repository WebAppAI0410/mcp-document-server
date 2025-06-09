import * as cheerio from 'cheerio';
import { Element } from 'domhandler';
import TurndownService from 'turndown';
import { ScraperPreset } from './scraper-presets';

export interface ScrapedDocument {
  content: string;
  metadata: {
    url: string;
    title?: string;
    description?: string;
    section?: string;
  };
}

export interface ChunkOptions {
  maxChunkSize: number;
  overlap: number;
}

export interface DocumentChunk {
  content: string;
  metadata: {
    url: string;
    title?: string;
    section?: string;
    chunkIndex: number;
    totalChunks: number;
  };
}

export class DocumentScraper {
  private turndown: TurndownService;

  constructor() {
    this.turndown = new TurndownService({
      headingStyle: 'atx',
      codeBlockStyle: 'fenced',
    });

    // Configure turndown for better code block handling
    interface TurndownNode {
      textContent?: string | null;
      [key: string]: unknown;
    }
    
    this.turndown.addRule('codeBlock', {
      filter: ['pre'],
      replacement: (_content, node) => {
        if (!node || typeof node !== 'object') {
          return '';
        }
        const turndownNode = node as TurndownNode;
        const code = turndownNode.textContent || '';
        const lang = this.extractLanguage(node as unknown as Element);
        return `\n\`\`\`${lang}\n${code}\n\`\`\`\n`;
      },
    });
  }

  async scrapeUrl(url: string): Promise<string> {
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Remove script and style tags
    $('script, style').remove();

    // Convert to markdown
    const content = this.turndown.turndown($.html());
    return content;
  }

  async scrapeWithPreset(
    url: string,
    preset: ScraperPreset
  ): Promise<ScrapedDocument> {
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Remove unwanted elements
    if (preset.removeSelectors) {
      preset.removeSelectors.forEach(selector => {
        $(selector).remove();
      });
    }

    // Extract content
    let content: string;
    if (preset.contentSelector) {
      content = $(preset.contentSelector).html() || '';
    } else {
      content = $('body').html() || '';
    }

    // Extract metadata
    const title = preset.titleSelector
      ? $(preset.titleSelector).first().text().trim()
      : $('title').text().trim();

    const description = $('meta[name="description"]').attr('content') || '';

    // Convert to markdown
    const markdown = this.turndown.turndown(content);

    return {
      content: markdown,
      metadata: {
        url,
        title,
        description,
      },
    };
  }

  async scrapeSitemap(
    sitemapUrl: string,
    urlFilter?: RegExp
  ): Promise<string[]> {
    const response = await fetch(sitemapUrl);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const xml = await response.text();
    const $ = cheerio.load(xml, { xmlMode: true });

    const urls: string[] = [];
    $('loc').each((_, element) => {
      const url = $(element).text().trim();
      if (!urlFilter || urlFilter.test(url)) {
        urls.push(url);
      }
    });

    return urls;
  }

  chunkDocument(
    content: string,
    options: ChunkOptions
  ): DocumentChunk[] {
    const chunks: DocumentChunk[] = [];
    const sections = this.splitIntoSections(content);

    sections.forEach((section, _sectionIndex) => {
      const sectionChunks = this.chunkText(
        section.content,
        options.maxChunkSize,
        options.overlap
      );

      sectionChunks.forEach((chunk, _chunkIndex) => {
        chunks.push({
          content: chunk,
          metadata: {
            url: '',
            section: section.title,
            chunkIndex: chunks.length,
            totalChunks: 0, // Will be set after all chunks are created
          },
        });
      });
    });

    // Update total chunks count
    chunks.forEach(chunk => {
      chunk.metadata.totalChunks = chunks.length;
    });

    return chunks;
  }

  private splitIntoSections(content: string): Array<{ title: string; content: string }> {
    const lines = content.split('\n');
    const sections: Array<{ title: string; content: string }> = [];
    let currentSection = { title: 'Introduction', content: '' };

    for (const line of lines) {
      if (line.startsWith('# ')) {
        if (currentSection.content.trim()) {
          sections.push(currentSection);
        }
        currentSection = {
          title: line.substring(2).trim(),
          content: line + '\n',
        };
      } else {
        currentSection.content += line + '\n';
      }
    }

    if (currentSection.content.trim()) {
      sections.push(currentSection);
    }

    return sections;
  }

  private chunkText(
    text: string,
    maxChunkSize: number,
    overlap: number
  ): string[] {
    const chunks: string[] = [];
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
    
    let currentChunk = '';

    for (const sentence of sentences) {
      if (currentChunk.length + sentence.length > maxChunkSize && currentChunk) {
        chunks.push(currentChunk.trim());
        
        // Add overlap from the end of the previous chunk
        const overlapText = this.getOverlapText(currentChunk, overlap);
        currentChunk = overlapText + sentence;
      } else {
        currentChunk += sentence;
      }
    }

    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }

    return chunks;
  }

  private getOverlapText(text: string, overlapSize: number): string {
    if (text.length <= overlapSize) {
      return text;
    }

    // Try to find a sentence boundary
    const lastPart = text.slice(-overlapSize);
    const sentenceEnd = lastPart.lastIndexOf('. ');
    
    if (sentenceEnd > 0) {
      return lastPart.slice(sentenceEnd + 2);
    }

    // Otherwise, find a word boundary
    const wordBoundary = lastPart.indexOf(' ');
    if (wordBoundary > 0) {
      return lastPart.slice(wordBoundary + 1);
    }

    return lastPart;
  }

  private extractLanguage(node: Element): string {
    interface NodeWithAttribs {
      attribs?: {
        class?: string;
        'data-language'?: string;
        [key: string]: string | undefined;
      };
      children?: Array<{
        name: string;
        attribs?: {
          class?: string;
          [key: string]: string | undefined;
        };
      }>;
    }
    
    const nodeWithAttribs = node as unknown as NodeWithAttribs;
    const className = nodeWithAttribs.attribs?.class || '';
    const langMatch = className.match(/language-(\w+)/);
    
    if (langMatch) {
      return langMatch[1];
    }

    // Check for data attributes
    const dataLang = nodeWithAttribs.attribs?.['data-language'];
    if (dataLang) {
      return dataLang;
    }

    // Check code element inside pre
    const codeElement = nodeWithAttribs.children?.find((child) => child.name === 'code');
    if (codeElement?.attribs?.class) {
      const codeLangMatch = codeElement.attribs.class.match(/language-(\w+)/);
      if (codeLangMatch) {
        return codeLangMatch[1];
      }
    }

    return '';
  }
}