import { defineConfig } from 'astro/config';
import preact from '@astrojs/preact';
import palante from './integraciones/palante.mjs';
import { loadEnv } from 'vite';

// PALANTE_FIXTURES=1 construye con datos de prueba en dist-fixtures/ solo para pruebas locales y CI.
const conFixtures = process.env.PALANTE_FIXTURES === '1';
// Las variables PUBLIC_ viven en el .env de la raíz del repositorio; las del entorno mandan sobre el archivo.
const env = { ...loadEnv(process.env.NODE_ENV ?? 'production', '..', 'PUBLIC_'), ...process.env };

export default defineConfig({
  site: env.PUBLIC_SITE_URL || 'https://palante.pages.dev',
  output: 'static',
  outDir: conFixtures ? './dist-fixtures' : './dist',
  publicDir: conFixtures ? './public-fixtures' : './public',
  trailingSlash: 'never',
  compressHTML: true,
  build: {
    format: 'file',
    inlineStylesheets: 'always',
  },
  integrations: [preact(), palante({ permitirFixtures: conFixtures, rutas: env.PUBLIC_RUTAS === 'true' })],
  vite: {
    envDir: '..',
    ssr: { external: ['@resvg/resvg-js'] },
  },
});
