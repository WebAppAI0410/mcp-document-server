export interface ScraperPreset {
  name: string;
  contentSelector: string;
  removeSelectors?: string[];
  titleSelector?: string;
  urlPatterns?: RegExp[];
}

export const scraperPresets: Record<string, ScraperPreset> = {
  nextjs: {
    name: 'Next.js Documentation',
    contentSelector: 'main',
    removeSelectors: [
      'nav',
      'header',
      'footer',
      '.sidebar',
      '.table-of-contents',
      'button',
      '.feedback',
    ],
    titleSelector: 'h1',
    urlPatterns: [/nextjs\.org\/docs/],
  },
  react: {
    name: 'React Documentation',
    contentSelector: 'article',
    removeSelectors: [
      'nav',
      'header',
      'footer',
      '.toc',
      '.edit-link',
      '.navigation-footer',
    ],
    titleSelector: 'h1',
    urlPatterns: [/react\.dev\/(learn|reference)/],
  },
  reactNative: {
    name: 'React Native Documentation',
    contentSelector: '.docMainWrapper',
    removeSelectors: [
      '.docsNavContainer',
      'footer',
      '.docLastUpdate',
      '.editThisPage',
    ],
    titleSelector: 'h1',
    urlPatterns: [/reactnative\.dev\/docs/],
  },
  convex: {
    name: 'Convex Documentation',
    contentSelector: 'main',
    removeSelectors: [
      'nav',
      'aside',
      'footer',
      '.breadcrumbs',
      '.page-nav',
    ],
    titleSelector: 'h1',
    urlPatterns: [/docs\.convex\.dev/],
  },
  cloudflare: {
    name: 'Cloudflare Workers Documentation',
    contentSelector: 'main',
    removeSelectors: [
      'nav',
      'header',
      'footer',
      '.sidebar',
      '.breadcrumb',
      '.feedback',
    ],
    titleSelector: 'h1',
    urlPatterns: [/developers\.cloudflare\.com\/workers/],
  },
  expo: {
    name: 'Expo Documentation',
    contentSelector: 'main',
    removeSelectors: [
      'nav',
      'header',
      'footer',
      '.sidebar',
      '.on-this-page',
      '.edit-page-link',
    ],
    titleSelector: 'h1',
    urlPatterns: [/docs\.expo\.dev/],
  },
  clerk: {
    name: 'Clerk Documentation',
    contentSelector: 'main',
    removeSelectors: [
      'nav',
      'header',
      'footer',
      '.sidebar',
      '.toc',
      '.feedback',
    ],
    titleSelector: 'h1',
    urlPatterns: [/clerk\.com\/docs/],
  },
  stripe: {
    name: 'Stripe Documentation',
    contentSelector: 'article',
    removeSelectors: [
      'nav',
      'header',
      'footer',
      '.sidebar',
      '.method-list',
      '.feedback',
    ],
    titleSelector: 'h1',
    urlPatterns: [/stripe\.com\/docs/],
  },
  python: {
    name: 'Python Documentation',
    contentSelector: 'div.body',
    removeSelectors: [
      'div.sphinxsidebar',
      'div.related',
      'div.footer',
      'div.navigation',
    ],
    titleSelector: 'h1',
    urlPatterns: [/docs\.python\.org/],
  },
  mastra: {
    name: 'Mastra Documentation',
    contentSelector: 'main',
    removeSelectors: [
      'nav',
      'header',
      'footer',
      '.sidebar',
      '.toc',
    ],
    titleSelector: 'h1',
    urlPatterns: [/mastra\.ai\/docs/],
  },
};

export function getPresetForUrl(url: string): ScraperPreset | undefined {
  for (const preset of Object.values(scraperPresets)) {
    if (preset.urlPatterns?.some(pattern => pattern.test(url))) {
      return preset;
    }
  }
  return undefined;
}

export function getPresetByName(name: string): ScraperPreset | undefined {
  return scraperPresets[name.toLowerCase()];
}