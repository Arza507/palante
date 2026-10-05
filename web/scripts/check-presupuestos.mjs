// Comprueba los presupuestos de rendimiento de SPEC.md, sección 3, sobre la salida del build.
// Uso: node scripts/check-presupuestos.mjs [dist]
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, dirname, posix } from 'node:path';
import { gzipSync } from 'node:zlib';

export const LIMITES = {
  jsSinMapa: 50 * 1024,
  jsConMapa: 150 * 1024,
  primeraCargaInicio: 300 * 1024,
  fuente: 40 * 1024,
  fachadas: 4 * 1024,
  azulejo: 1.5 * 1024,
  baranda: 1024,
  imagenCompartir: 100 * 1024,
};

const gz = (buf) => gzipSync(buf, { level: 9 }).length;

function* archivos(dir) {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) yield* archivos(p);
    else yield p;
  }
}

/** Sigue los imports estáticos de un módulo JS y devuelve todos los archivos que carga al inicio. */
function grafoJs(dist, archivo, vistos = new Set()) {
  if (vistos.has(archivo) || !existsSync(archivo)) return vistos;
  vistos.add(archivo);
  const codigo = readFileSync(archivo, 'utf8');
  // Solo imports estáticos: `import ... from "x"` e `import "x"`. Los import() dinámicos no cuentan como carga inicial.
  for (const m of codigo.matchAll(/(?:^|[;\s}])(?:import|export)\s*(?:[\w*{}\s,$]+from\s*)?["']([^"']+\.js)["']/g)) {
    const destino = m[1].startsWith('/') ? join(dist, m[1]) : join(dirname(archivo), m[1]);
    grafoJs(dist, destino, vistos);
  }
  return vistos;
}

/** Analiza una página HTML: JS inicial (externo e inline) y peso total de la primera carga. */
export function analizarPagina(dist, html) {
  const texto = readFileSync(html, 'utf8');
  const conMapa = /<meta name="palante:mapa-calles"/.test(texto);
  const js = new Set();
  const islas = [...texto.matchAll(/component-url="([^"]+)"|renderer-url="([^"]+)"|<script[^>]+src="(\/[^"]+\.js)"|<link[^>]+rel="modulepreload"[^>]+href="([^"]+)"/g)];
  for (const m of islas) {
    const src = m[1] ?? m[2] ?? m[3] ?? m[4];
    if (src && src.startsWith('/')) grafoJs(dist, join(dist, src), js);
  }
  // Scripts de Astro con hoisting: <script type="module" src=...> ya cubiertos; los inline se suman al HTML.
  let jsInline = 0;
  for (const m of texto.matchAll(/<script(?![^>]*type="application\/ld\+json")[^>]*>([\s\S]*?)<\/script>/g)) {
    if (m[1].trim()) jsInline += gz(Buffer.from(m[1]));
  }
  let jsBytes = jsInline;
  for (const f of js) jsBytes += gz(readFileSync(f));

  // Primera carga: HTML + JS + CSS enlazado + fuente precargada + imágenes del HTML.
  let total = gz(readFileSync(html)) + jsBytes - jsInline;
  for (const m of texto.matchAll(/<link[^>]+rel="(?:stylesheet|preload)"[^>]+href="(\/[^"]+)"|<img[^>]+src="(\/[^"]+)"/g)) {
    const p = join(dist, m[1] ?? m[2]);
    if (existsSync(p)) total += /\.(woff2|png|jpg|webp)$/.test(p) ? statSync(p).size : gz(readFileSync(p));
  }
  for (const m of texto.matchAll(/url\(['"]?(\/[^'")]+)['"]?\)/g)) {
    const p = join(dist, m[1]);
    if (existsSync(p)) total += gz(readFileSync(p));
  }
  return { conMapa, jsBytes, total, archivosJs: [...js].map((f) => relative(dist, f)) };
}

function kb(n) { return `${(n / 1024).toFixed(1)} KB`; }

export function revisar(dist) {
  const fallos = [];
  const filas = [];
  const htmls = [...archivos(dist)].filter((f) => f.endsWith('.html'));
  for (const h of htmls) {
    const a = analizarPagina(dist, h);
    const limite = a.conMapa ? LIMITES.jsConMapa : LIMITES.jsSinMapa;
    const nombre = posix.join(...relative(dist, h).split(/[\\/]/));
    filas.push(`${nombre.padEnd(40)} JS ${kb(a.jsBytes).padStart(9)} / ${kb(limite)}   carga ${kb(a.total)}`);
    if (a.jsBytes > limite) fallos.push(`${nombre}: JavaScript inicial ${kb(a.jsBytes)} supera ${kb(limite)}`);
    if (nombre === 'index.html' && a.total > LIMITES.primeraCargaInicio) {
      fallos.push(`index.html: primera carga ${kb(a.total)} supera ${kb(LIMITES.primeraCargaInicio)}`);
    }
    // Cada página tiene su imagen para compartir y pesa 100 KB o menos.
    const og = /<meta property="og:image" content="https?:\/\/[^/]+(\/[^"]+)"/.exec(readFileSync(h, 'utf8'));
    if (!og) fallos.push(`${nombre}: sin og:image`);
    else {
      const p = join(dist, decodeURIComponent(og[1]));
      if (!existsSync(p)) fallos.push(`${nombre}: falta la imagen ${og[1]}`);
      else if (statSync(p).size > LIMITES.imagenCompartir) fallos.push(`${og[1]}: ${kb(statSync(p).size)} supera 100 KB`);
    }
  }
  const fuentes = existsSync(join(dist, 'fonts')) ? readdirSync(join(dist, 'fonts')).filter((f) => /\.(woff2?|ttf|otf)$/.test(f)) : [];
  if (fuentes.length > 1) fallos.push(`Hay ${fuentes.length} archivos de fuente; el límite es uno`);
  for (const f of fuentes) {
    const s = statSync(join(dist, 'fonts', f)).size;
    filas.push(`fuente ${f}: ${kb(s)}`);
    if (s > LIMITES.fuente) fallos.push(`Fuente ${f}: ${kb(s)} supera 40 KB`);
  }
  const motivos = [
    ['img/azulejo.svg', LIMITES.azulejo],
    ['img/baranda.svg', LIMITES.baranda],
  ];
  for (const [f, lim] of motivos) {
    const s = statSync(join(dist, f)).size;
    if (s > lim) fallos.push(`${f}: ${s} bytes supera ${lim}`);
  }
  return { fallos, filas };
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split(/[\\/]/).pop())) {
  const dist = process.argv[2] ?? 'dist';
  const { fallos, filas } = revisar(dist);
  console.log(filas.join('\n'));
  if (fallos.length) {
    console.error(`\nPresupuestos incumplidos:\n  ${fallos.join('\n  ')}`);
    process.exit(1);
  }
  console.log('\nPresupuestos de rendimiento cumplidos.');
}
