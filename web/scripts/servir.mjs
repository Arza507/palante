// Servidor estático para pruebas locales que imita a Cloudflare Pages:
// /acerca sirve acerca.html, comprime con gzip y responde 404.html con estado 404.
// Uso: node scripts/servir.mjs [carpeta=dist] [puerto=4321]
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';

const raiz = resolve(process.argv[2] ?? 'dist');
const puerto = Number(process.argv[3] ?? process.env.PORT ?? 4321);
const TIPOS = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2',
  '.webmanifest': 'application/manifest+json', '.xml': 'application/xml', '.txt': 'text/plain; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8', '.geojson': 'application/geo+json', '.zip': 'application/zip', '.pmtiles': 'application/octet-stream',
};
const COMPRIMIBLE = new Set(['.html', '.js', '.css', '.json', '.svg', '.webmanifest', '.xml', '.txt', '.csv', '.geojson']);

async function existe(p) {
  try { return (await stat(p)).isFile(); } catch { return false; }
}

async function resolver(ruta) {
  const limpia = normalize(decodeURIComponent(ruta)).replace(/^([/\\])+/, '');
  const base = join(raiz, limpia);
  if (!base.startsWith(raiz)) return null;
  for (const c of [base, `${base}.html`, join(base, 'index.html')]) if (await existe(c)) return c;
  return null;
}

createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  let archivo = await resolver(url.pathname === '/' ? '/index.html' : url.pathname);
  let estado = 200;
  if (!archivo) { archivo = join(raiz, '404.html'); estado = 404; }
  const ext = extname(archivo);
  let cuerpo = await readFile(archivo);
  const cabeceras = { 'Content-Type': TIPOS[ext] ?? 'application/octet-stream', 'Cache-Control': 'no-cache' };
  if (COMPRIMIBLE.has(ext) && /gzip/.test(req.headers['accept-encoding'] ?? '')) {
    cuerpo = gzipSync(cuerpo);
    cabeceras['Content-Encoding'] = 'gzip';
  }
  res.writeHead(estado, cabeceras);
  res.end(req.method === 'HEAD' ? undefined : cuerpo);
}).listen(puerto, () => console.log(`Sirviendo ${raiz} en http://localhost:${puerto}`));
