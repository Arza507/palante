import { defineConfig } from 'astro/config';
import preact from '@astrojs/preact';
import palante from './integraciones/palante.mjs';

// PALANTE_FIXTURES=1 construye con datos de prueba en dist-fixtures/ solo para pruebas locales y CI.
const conFixtures = process.env.PALANTE_FIXTURES === '1';

export default defineConfig({
  site: process.env.PUBLIC_SITE_URL || 'https://palante.pages.dev',
  output: 'static',
  outDir: conFixtures ? './dist-fixtures' : './dist',
  publicDir: conFixtures ? './public-fixtures' : './public',
  trailingSlash: 'never',
  compressHTML: true,
  build: {
    format: 'file',
    inlineStylesheets: 'always',
  },
  integrations: [preact(), palante({ permitirFixtures: conFixtures })],
  vite: {
    ssr: { external: ['@resvg/resvg-js'] },
  },
});
