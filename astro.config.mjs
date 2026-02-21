// @ts-check
import { defineConfig } from 'astro/config';
import { paraglideVitePlugin } from '@inlang/paraglide-js';

import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';

const BUILD_DATE = new Date();

// https://astro.build/config
export default defineConfig({
  site: 'https://chemistry.svistunov.online',
  i18n: {
    defaultLocale: 'ru',
    locales: ['ru', 'en', 'pl', 'es'],
    routing: {
      prefixDefaultLocale: false,
      redirectToDefaultLocale: false,
    },
  },
  vite: {
    plugins: [
      paraglideVitePlugin({
        project: './project.inlang',
        outdir: './src/paraglide',
      }),
    ],
  },
  integrations: [
    react(),
    sitemap({
      filter: (page) =>
        !page.includes('/profile/') && !page.includes('/profil/') && !page.includes('/perfil/'),
      changefreq: 'weekly',
      priority: 0.7,
      serialize: (item) => {
        // Homepage — highest priority
        if (item.url === 'https://chemistry.svistunov.online/') {
          return { ...item, priority: 1.0, changefreq: 'weekly', lastmod: BUILD_DATE };
        }
        // Main section pages (any locale)
        if (
          item.url.endsWith('/periodic-table/') ||
          item.url.endsWith('/tablica-okresowa/') ||
          item.url.endsWith('/tabla-periodica/') ||
          item.url.endsWith('/substances/') ||
          item.url.endsWith('/substancje/') ||
          item.url.endsWith('/sustancias/') ||
          item.url.endsWith('/reactions/') ||
          item.url.endsWith('/reakcje/') ||
          item.url.endsWith('/reacciones/') ||
          item.url.endsWith('/diagnostics/') ||
          item.url.endsWith('/diagnostyka/') ||
          item.url.endsWith('/diagnostico/')
        ) {
          return { ...item, priority: 0.9, changefreq: 'weekly', lastmod: BUILD_DATE };
        }
        // Individual substance pages
        if (item.url.includes('/substances/') && !item.url.endsWith('/substances/')) {
          return { ...item, priority: 0.6, changefreq: 'monthly', lastmod: BUILD_DATE };
        }
        if (item.url.includes('/substancje/') && !item.url.endsWith('/substancje/')) {
          return { ...item, priority: 0.6, changefreq: 'monthly', lastmod: BUILD_DATE };
        }
        if (item.url.includes('/sustancias/') && !item.url.endsWith('/sustancias/')) {
          return { ...item, priority: 0.6, changefreq: 'monthly', lastmod: BUILD_DATE };
        }
        // Exam comparison — high priority unique content
        if (item.url.includes('/compare') || item.url.includes('/porownanie') || item.url.includes('/comparar')) {
          return { ...item, priority: 0.8, changefreq: 'monthly', lastmod: BUILD_DATE };
        }
        return { ...item, lastmod: BUILD_DATE };
      },
    }),
  ],
});
