// Service worker de Palante. Se empaqueta con esbuild y Workbox inyecta la lista de precarga.
import { precacheAndRoute, matchPrecache, cleanupOutdatedCaches } from 'workbox-precaching';
import { registerRoute, setCatchHandler } from 'workbox-routing';
import { NetworkFirst, StaleWhileRevalidate } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { clientsClaim } from 'workbox-core';

self.skipWaiting();
clientsClaim();
cleanupOutdatedCaches();

// Estructura de la app: páginas principales, CSS, JS, fuente e iconos.
precacheAndRoute(self.__WB_MANIFEST, { cleanURLs: true });

// Páginas: primero la red; sin conexión, la copia guardada.
registerRoute(
  ({ request }) => request.mode === 'navigate',
  new NetworkFirst({
    cacheName: 'palante-paginas',
    networkTimeoutSeconds: 4,
    plugins: [new ExpirationPlugin({ maxEntries: 80, maxAgeSeconds: 60 * 60 * 24 * 60 })],
  }),
);

// Datos de cada módulo visitado: se sirven de la copia y se actualizan en segundo plano.
registerRoute(
  ({ url }) => url.origin === self.location.origin && url.pathname.startsWith('/data/') && !url.pathname.endsWith('.csv') && !url.pathname.endsWith('.zip'),
  new StaleWhileRevalidate({
    cacheName: 'palante-datos',
    plugins: [new ExpirationPlugin({ maxEntries: 120 })],
  }),
);

// Código del mapa de calles (Leaflet): se guarda la primera vez que se abre /rutas, no antes.
registerRoute(
  ({ url }) => url.origin === self.location.origin && url.pathname.startsWith('/_astro/') && url.pathname.endsWith('.js'),
  new StaleWhileRevalidate({ cacheName: 'palante-codigo', plugins: [new ExpirationPlugin({ maxEntries: 20 })] }),
);

// Sin red y sin copia: la página de sin conexión.
setCatchHandler(async ({ request }) => {
  if (request.mode === 'navigate') {
    return (await matchPrecache('/sin-conexion.html')) ?? Response.error();
  }
  return Response.error();
});
