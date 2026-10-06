// Integración de Astro para Palante:
// 1. Detiene el build de producción si la marca FIXTURE llega a la salida.
// 2. Escribe sitemap.xml.
// 3. Empaqueta el service worker e inyecta la lista de precarga de Workbox.
import { build } from 'esbuild';
import { injectManifest } from 'workbox-build';
import { readdirSync, readFileSync, statSync, writeFileSync, rmSync } from 'node:fs';
import { join, relative, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const TEXTO = new Set(['.html', '.json', '.csv', '.js', '.css', '.xml', '.txt', '.geojson', '.svg', '.webmanifest']);

function* archivos(dir) {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) yield* archivos(p);
    else yield p;
  }
}

/** Devuelve los archivos de texto de `dir` que contienen la marca FIXTURE. */
export function buscarFixtures(dir) {
  const hallados = [];
  for (const f of archivos(dir)) {
    if (!TEXTO.has(extname(f))) continue;
    if (readFileSync(f, 'utf8').includes('FIXTURE')) hallados.push(relative(dir, f));
  }
  return hallados;
}

// Páginas que se precargan para que la app abra sin conexión desde la primera visita.
const PRECARGA_PAGINAS = ['index.html', '311.html', 'empleo.html', 'captura.html', 'sin-conexion.html', '404.html'];

export default function palante({ permitirFixtures = false, rutas = false } = {}) {
  let site;
  return {
    name: 'palante',
    hooks: {
      'astro:config:setup': ({ injectRoute }) => {
        // /rutas solo existe con PUBLIC_RUTAS=true (SPEC.md, sección 8).
        if (rutas) injectRoute({ pattern: '/rutas', entrypoint: './src/rutas/rutas.astro' });
      },
      'astro:config:done': ({ config }) => {
        site = config.site;
      },
      'astro:build:done': async ({ dir, pages, logger }) => {
        const salida = fileURLToPath(dir);

        const fixtures = buscarFixtures(salida);
        if (fixtures.length && !permitirFixtures) {
          throw new Error(
            `Hay datos de prueba (marca FIXTURE) en la salida del build:\n  ${fixtures.join('\n  ')}\n` +
              'Los datos de prueba nunca se publican. Quítalos de web/public/ antes de construir.',
          );
        }
        if (fixtures.length) logger.warn(`Build de prueba con ${fixtures.length} archivos FIXTURE. No publicar.`);

        const excluir = /^(404|sin-conexion|og\/|captura)/;
        const urls = pages
          .map((p) => p.pathname.replace(/\/$/, ''))
          .filter((p) => !excluir.test(p))
          .map((p) => new URL(`/${p}`, site).href)
          .sort();
        writeFileSync(
          join(salida, 'sitemap.xml'),
          '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
            urls.map((u) => `  <url><loc>${u}</loc></url>`).join('\n') +
            '\n</urlset>\n',
        );

        // Leaflet y protomaps solo se descargan al abrir el mapa de calles: no van en la precarga.
        const astroDir = join(salida, '_astro');
        const soloMapa = new Set();
        for (const f of readdirSync(astroDir).filter((n) => n.startsWith('MapaCalles.'))) {
          const codigo = readFileSync(join(astroDir, f), 'utf8');
          for (const m of codigo.matchAll(/import\(\s*["'`]\.\/([^"'`]+\.js)["'`]\s*\)/g)) soloMapa.add(`_astro/${m[1]}`);
          for (const m of codigo.matchAll(/["'`]\/?(_astro\/[^"'`]+\.css)["'`]/g)) soloMapa.add(m[1]);
        }

        const fuente = join(salida, 'sw-fuente.js');
        await build({
          entryPoints: [fileURLToPath(new URL('../sw/sw.js', import.meta.url))],
          bundle: true,
          minify: true,
          format: 'iife',
          target: 'es2019',
          outfile: fuente,
          define: { 'process.env.NODE_ENV': '"production"' },
          logLevel: 'warning',
        });
        const { count, size, warnings } = await injectManifest({
          swSrc: fuente,
          swDest: join(salida, 'sw.js'),
          globDirectory: salida,
          globPatterns: [
            ...PRECARGA_PAGINAS,
            ...(rutas ? ['rutas.html'] : []),
            '_astro/*.{js,css}',
            'fonts/*.woff2',
            'favicon.svg',
            'icons/icono-192.png',
            'img/*.svg',
            'manifest.webmanifest',
          ],
          globIgnores: [...soloMapa],
          maximumFileSizeToCacheInBytes: 300 * 1024,
        });
        rmSync(fuente);
        for (const w of warnings) logger.warn(w);
        logger.info(`Service worker: ${count} archivos precargados (${(size / 1024).toFixed(1)} KB)`);
      },
    },
  };
}
