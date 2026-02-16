// @ts-check
import { defineConfig } from 'astro/config';

import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';

const BUILD_DATE = new Date();

// https://astro.build/config
export default defineConfig({
  site: 'https://chemistry.svistunov.online',
  integrations: [
    react(),
    sitemap({
      filter: (page) => !page.includes('/profile/'),
      changefreq: 'weekly',
      priority: 0.7,
      serialize: (item) => {
        // Homepage — highest priority
        if (item.url === 'https://chemistry.svistunov.online/') {
          return { ...item, priority: 1.0, changefreq: 'weekly', lastmod: BUILD_DATE };
        }
        // Main section pages
        if (
          item.url.endsWith('/periodic-table/') ||
          item.url.endsWith('/substances/') ||
          item.url.endsWith('/reactions/') ||
          item.url.endsWith('/diagnostics/')
        ) {
          return { ...item, priority: 0.9, changefreq: 'weekly', lastmod: BUILD_DATE };
        }
        // Individual substance pages
        if (item.url.includes('/substances/') && !item.url.endsWith('/substances/')) {
          return { ...item, priority: 0.6, changefreq: 'monthly', lastmod: BUILD_DATE };
        }
        return { ...item, lastmod: BUILD_DATE };
      },
    }),
  ],
});
