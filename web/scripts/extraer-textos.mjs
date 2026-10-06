// Escribe docs/textos-para-revisar.md con cada texto visible de Palante, página por página, para que Iker
// lo revise antes de publicar (SPEC.md, sección 11, M4).
// Lee el build con datos de prueba (tiene todas las páginas, también /rutas) y los textos de las islas,
// que solo aparecen al usarlas. Las páginas repetidas (fichas del 311, sectores) van con un solo ejemplo.
// Uso: npm run build:fixtures && node scripts/extraer-textos.mjs
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, posix } from 'node:path';
import { fileURLToPath } from 'node:url';

const web = fileURLToPath(new URL('..', import.meta.url));
const dist = join(web, process.argv[2] ?? 'dist-fixtures');
const destino = join(web, '..', 'docs', 'textos-para-revisar.md');

const ENTIDADES = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&#x27;': "'", '&nbsp;': ' ' };
const decodificar = (t) => t.replace(/&(amp|lt|gt|quot|#39|#x27|nbsp);/g, (m) => ENTIDADES[m]).replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));

function* htmls(dir) {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) yield* htmls(p);
    else if (n.endsWith('.html')) yield p;
  }
}

/** Textos visibles de una página, en orden, sin repetir líneas seguidas. */
export function textosDePagina(html) {
  const titulo = decodificar(/<title>([^<]*)<\/title>/.exec(html)?.[1] ?? '');
  const descripcion = decodificar(/<meta name="description" content="([^"]*)"/.exec(html)?.[1] ?? '');
  let cuerpo = /<body[^>]*>([\s\S]*)<\/body>/.exec(html)?.[1] ?? '';
  const etiquetas = [...cuerpo.matchAll(/aria-label="([^"]+)"/g)].map((m) => decodificar(m[1]));
  cuerpo = cuerpo
    .replace(/<script[\s\S]*?<\/script>/g, '')
    .replace(/<style[\s\S]*?<\/style>/g, '')
    .replace(/<template[\s\S]*?<\/template>/g, '')
    .replace(/<svg[^>]*aria-hidden="true"[\s\S]*?<\/svg>/g, '')
    .replace(/<(br|\/p|\/h[1-6]|\/li|\/dt|\/dd|\/th|\/td|\/tr|\/figcaption|\/summary|\/button|\/label|\/legend|\/a|\/div|\/section|\/header|\/footer|\/nav|\/option|\/text)[^>]*>/g, '\n')
    .replace(/<[^>]+>/g, ' ');
  const lineas = [];
  for (const l of decodificar(cuerpo).split('\n').map((x) => x.replace(/\s+/g, ' ').trim())) {
    if (l && l !== lineas.at(-1)) lineas.push(l);
  }
  return { titulo, descripcion, lineas, etiquetas: [...new Set(etiquetas)] };
}

/** Literales de cadena del código, respetando escapes ('...', "..." y `...`). */
function* literales(codigo) {
  for (let i = 0; i < codigo.length; i++) {
    const q = codigo[i];
    if (q !== "'" && q !== '"' && q !== '`') continue;
    let j = i + 1;
    let s = '';
    while (j < codigo.length && codigo[j] !== q) {
      if (codigo[j] === '\\') { s += codigo[j + 1]; j += 2; continue; }
      if (codigo[j] === '\n' && q !== '`') break;
      s += codigo[j++];
    }
    if (codigo[j] === q) { yield s; i = j; }
  }
}

const CODIGO = /&&|\|\||===|=>|\breturn\b|[;=]|^[).(]|^M\d|navigator\.|solo-js|^(boton|aviso|campo|mapa|numero|filtros)[ -]/;

/** Cadenas en español de las islas: texto JSX y literales con letras. */
export function textosDeIsla(codigo) {
  const sinComentarios = codigo.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const t = new Set();
  const limpiar = (s) => s.replace(/\s+/g, ' ').replace(/\{([^{}]*)\}/g, (_, e) => `{${e.trim()}}`).trim();
  // Texto JSX entre etiquetas, con sus expresiones entre llaves.
  for (const m of sinComentarios.matchAll(/>((?:[^<>{}]|\{[^{}]*\})*[A-Za-zÁÉÍÓÚáéíóúñÑ](?:[^<>{}]|\{[^{}]*\})*)</g)) {
    const s = limpiar(m[1]);
    if (s && !CODIGO.test(s) && /[A-Za-zÁÉÍÓÚáéíóú]{2}/.test(s.replace(/\{[^}]*\}/g, ''))) t.add(s);
  }
  for (const lit of literales(sinComentarios)) {
    const s = lit.trim();
    if (s.length >= 12 && /\s/.test(s) && /[a-záéíóúñ]/.test(s) && !CODIGO.test(s) && !/[<{};]|https?:/.test(s.replace(/\$\{[^}]*\}/g, ''))) {
      t.add(s.replace(/\$\{([^}]*)\}/g, '{$1}'));
    }
  }
  return [...t];
}

// Páginas que se generan de una plantilla: un ejemplo basta.
const PLANTILLAS = [
  [/^311\/(?!metodologia).+\.html$/, '311/[corregimiento]'],
  [/^empleo\/(?!informe|metodologia).+\.html$/, 'empleo/[sector]'],
];

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const vistas = new Set();
  const secciones = [];
  for (const f of [...htmls(dist)].sort()) {
    const rel = posix.join(...relative(dist, f).split(/[\\/]/));
    const plantilla = PLANTILLAS.find(([re]) => re.test(rel))?.[1];
    if (plantilla && vistas.has(plantilla)) continue;
    if (plantilla) vistas.add(plantilla);
    const ruta = '/' + rel.replace(/\.html$/, '').replace(/^index$/, '');
    const t = textosDePagina(readFileSync(f, 'utf8'));
    secciones.push(
      `## ${ruta}${plantilla ? ` (ejemplo de ${'/' + plantilla}; las demás usan la misma plantilla)` : ''}\n\n` +
        `- **Título:** ${t.titulo}\n- **Descripción:** ${t.descripcion}\n\n` +
        t.lineas.map((l) => `- ${l}`).join('\n') +
        (t.etiquetas.length ? `\n\nEtiquetas para lectores de pantalla:\n\n${t.etiquetas.map((l) => `- ${l}`).join('\n')}` : ''),
    );
  }
  const islas = readdirSync(join(web, 'src', 'islands')).filter((n) => n.endsWith('.tsx')).sort();
  for (const n of islas) {
    const t = textosDeIsla(readFileSync(join(web, 'src', 'islands', n), 'utf8'));
    secciones.push(`## Isla ${n} (textos que aparecen al usarla)\n\nLo que va entre llaves se rellena con datos.\n\n${t.map((l) => `- ${l}`).join('\n')}`);
  }
  const cabecera = `# Textos para revisar

Cada texto visible de Palante, página por página, para revisar antes de publicar.
Generado con \`node scripts/extraer-textos.mjs\` sobre el build con datos de prueba: los números y nombres
con la marca FIXTURE son inventados y solo muestran dónde va cada dato. Las páginas que salen de una plantilla
(fichas del 311 y sectores de empleo) aparecen con un solo ejemplo.

Para cambiar un texto, búscalo en \`web/src/\`. Reglas: español de Panamá, de tú, frases cortas, sin emojis,
sin exclamaciones en títulos y sin frases de marketing.
`;
  writeFileSync(destino, `${cabecera}\n${secciones.join('\n\n')}\n`);
  console.log(`Textos escritos en docs/textos-para-revisar.md: ${secciones.length} secciones.`);
}
