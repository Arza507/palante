// Falla si encuentra emojis, frases prohibidas o signos de exclamación en títulos dentro de src/.
// Reglas de CLAUDE.md, sección Textos.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

export const FRASES_PROHIBIDAS = [
  /\bdescubr(e|a|an|ir|e tu|ela)\b/i,
  /\bsum[eé]rg(e|ete|ase|irse)\b/i,
  /\bpotenci(a|an|ar|amos)\b/i,
  /\brevoluci[oó]n(a|an|ar)\b/i,
  /\ben el coraz[oó]n de\b/i,
  /\bde vanguardia\b/i,
  /\bsin precedentes?\b/i,
];

// Pictogramas y símbolos de emoji; se permiten ©, ® y ™.
const EMOJI = /(?![©®™])[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}️]/u;
const TITULOS = [
  /<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/gi,
  /<title[^>]*>([\s\S]*?)<\/title>/gi,
  /\btitul[oa]\s*[:=]\s*(?:\{\s*)?(["'`])([\s\S]*?)\1/gi,
  /\btitle\s*[:=]\s*(?:\{\s*)?(["'`])([\s\S]*?)\1/gi,
];

export function revisarTexto(texto) {
  const problemas = [];
  const lineas = texto.split('\n');
  lineas.forEach((linea, i) => {
    if (EMOJI.test(linea)) problemas.push({ linea: i + 1, motivo: 'emoji' });
    for (const re of FRASES_PROHIBIDAS) {
      const m = linea.match(re);
      if (m) problemas.push({ linea: i + 1, motivo: `frase prohibida "${m[0]}"` });
    }
    if (linea.includes('¡')) problemas.push({ linea: i + 1, motivo: 'signo de exclamación ¡' });
  });
  for (const re of TITULOS) {
    for (const m of texto.matchAll(re)) {
      const contenido = m[m.length - 1];
      if (/[!¡]/.test(contenido.replace(/!==?|!\w/g, ''))) {
        const linea = texto.slice(0, m.index).split('\n').length;
        problemas.push({ linea, motivo: 'signo de exclamación en un título' });
      }
    }
  }
  return problemas;
}

function* archivos(dir) {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) yield* archivos(p);
    else if (/\.(astro|tsx?|jsx?|mjs|css|md|json|svg)$/.test(n)) yield p;
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const raiz = fileURLToPath(new URL('..', import.meta.url));
  const dirs = process.argv.slice(2).length ? process.argv.slice(2) : ['src'];
  let total = 0;
  for (const d of dirs) {
    for (const f of archivos(join(raiz, d))) {
      for (const p of revisarTexto(readFileSync(f, 'utf8'))) {
        console.error(`${relative(raiz, f)}:${p.linea}  ${p.motivo}`);
        total++;
      }
    }
  }
  if (total) { console.error(`\n${total} problemas de textos`); process.exit(1); }
  console.log('Textos correctos: sin emojis, frases prohibidas ni exclamaciones en títulos.');
}
