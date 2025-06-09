#!/usr/bin/env node

import { Command } from 'commander';
import { DocumentScraper } from '../services/scraper';
import { getPresetForUrl, getPresetByName } from '../services/scraper-presets';
import { EmbeddingService, EmbeddingProvider } from '../services/embeddings';
import { VectorStore, MockVectorStore } from '../services/vector-store';
import { config } from '../config';
import { logger } from '../utils/logger';
import PQueue from 'p-queue';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs/promises';
import path from 'path';

const program = new Command();

program
  .name('add-source')
  .description('Add documentation source to the MCP server')
  .argument('<package>', 'Package name (e.g., "next", "react")')
  .argument('<version>', 'Version (e.g., "14.2.2", "18.3.0")')
  .argument('<url>', 'URL or path to documentation')
  .option('-p, --preset <preset>', 'Use a scraper preset')
  .option('-s, --sitemap <url>', 'Scrape from sitemap URL')
  .option('-r, --recursive', 'Recursively scrape linked pages')
  .option('-m, --max-pages <number>', 'Maximum pages to scrape', '100')
  .option('--dry-run', 'Preview what would be scraped without saving')
  .action(async (packageName: string, version: string, url: string, options) => {
    try {
      logger.info(`Adding documentation source for ${packageName}@${version}`);

      const scraper = new DocumentScraper();
      const embeddingService = new EmbeddingService({
        provider: config.openai.apiKey ? EmbeddingProvider.OPENAI : EmbeddingProvider.OLLAMA,
        model: config.openai.apiKey ? config.openai.embeddingModel : config.ollama.embeddingModel,
      });

      // Initialize vector store
      const vectorStore = new MockVectorStore(); // TODO: Use real vector store based on config
      await vectorStore.initialize();

      const queue = new PQueue({ concurrency: config.performance.maxConcurrentEmbeddings });

      let urls: string[] = [];

      // Collect URLs to scrape
      if (options.sitemap) {
        logger.info(`Fetching sitemap from ${options.sitemap}`);
        urls = await scraper.scrapeSitemap(options.sitemap);
        logger.info(`Found ${urls.length} URLs in sitemap`);
      } else if (options.recursive) {
        // TODO: Implement recursive scraping
        urls = [url];
      } else {
        urls = [url];
      }

      // Limit pages
      const maxPages = parseInt(options.maxPages, 10);
      if (urls.length > maxPages) {
        logger.warn(`Limiting to ${maxPages} pages (found ${urls.length})`);
        urls = urls.slice(0, maxPages);
      }

      if (options.dryRun) {
        logger.info('Dry run mode - URLs that would be scraped:');
        urls.forEach(u => console.log(`  - ${u}`));
        return;
      }

      // Process each URL
      let processed = 0;
      const errors: Array<{ url: string; error: string }> = [];

      for (const pageUrl of urls) {
        await queue.add(async () => {
          try {
            logger.info(`Scraping ${pageUrl} (${processed + 1}/${urls.length})`);

            // Determine preset
            const preset = options.preset
              ? getPresetByName(options.preset)
              : getPresetForUrl(pageUrl);

            // Scrape content
            const document = preset
              ? await scraper.scrapeWithPreset(pageUrl, preset)
              : {
                  content: await scraper.scrapeUrl(pageUrl),
                  metadata: { url: pageUrl },
                };

            // Chunk document
            const chunks = scraper.chunkDocument(document.content, {
              maxChunkSize: 1000,
              overlap: 200,
            });

            // Generate embeddings and store
            for (const chunk of chunks) {
              const embedding = await embeddingService.embed(chunk.content);

              await vectorStore.addDocument({
                id: uuidv4(),
                content: chunk.content,
                embedding,
                metadata: {
                  package: packageName,
                  version,
                  url: pageUrl,
                  title: document.metadata.title || chunk.metadata.section,
                  section: chunk.metadata.section,
                },
              });
            }

            // Save raw document
            const rawDocPath = path.join(
              config.storage.rawDocsPath,
              packageName,
              version,
              `${Buffer.from(pageUrl).toString('base64')}.md`
            );

            await fs.mkdir(path.dirname(rawDocPath), { recursive: true });
            await fs.writeFile(rawDocPath, document.content);

            processed++;
          } catch (error) {
            logger.error(`Failed to process ${pageUrl}: ${error}`);
            errors.push({
              url: pageUrl,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        });
      }

      await queue.onIdle();

      logger.info(`Completed: ${processed} pages processed, ${errors.length} errors`);

      if (errors.length > 0) {
        logger.error('Errors encountered:');
        errors.forEach(({ url, error }) => {
          logger.error(`  - ${url}: ${error}`);
        });
      }

      await vectorStore.close();
    } catch (error) {
      logger.error('Failed to add source:', error);
      process.exit(1);
    }
  });

program.parse();