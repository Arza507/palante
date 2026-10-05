// Falla si alguna combinación de texto de la paleta baja de 4,5:1 (WCAG AA).
// Lee src/styles/tokens.css y evalúa los temas claro y oscuro.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const css = readFileSync(fileURLToPath(new URL('../src/styles/tokens.css', import.meta.url)), 'utf8');

export function leerBloque(texto, selector) {
  const i = texto.indexOf(selector);
  if (i < 0) throw new Error(`No encuentro el bloque ${selector}`);
  const ini = texto.indexOf('{', i);
  const fin = texto.indexOf('}', ini);
  const vars = {};
  for (const m of texto.slice(ini + 1, fin).matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})/g)) vars[m[1]] = m[2];
  return vars;
}

export function luminancia(hex) {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((x) => (x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

export function contraste(a, b) {
  const [l1, l2] = [luminancia(a), luminancia(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

// [texto, fondo]: todas las combinaciones de texto que usa la interfaz.
export const PARES = [
  ...['hierro', 'hierro-suave', 'terracota', 'persiana', 'azulejo', 'buganvilla', 'terracota-oscuro']
    .flatMap((t) => [[t, 'cal'], [t, 'superficie']]),
  ['sobre-acento', 'terracota'],
  ['sobre-acento', 'persiana'],
  ['sobre-acento', 'azulejo'],
  ['sobre-ocre', 'ocre'],
];

const claro = leerBloque(css, ':root {');
const mediaOscuro = leerBloque(css, ':root:not([data-theme="claro"])');
const oscuro = leerBloque(css, ':root[data-theme="oscuro"]');

let fallos = 0;
for (const k of new Set([...Object.keys(mediaOscuro), ...Object.keys(oscuro)])) {
  if (mediaOscuro[k] !== oscuro[k]) {
    console.error(`El token --${k} difiere entre el modo oscuro del sistema y el manual`);
    fallos++;
  }
}
for (const k of Object.keys(claro)) {
  if (!(k in oscuro)) { console.error(`El token --${k} no está definido en el modo oscuro`); fallos++; }
}

for (const [nombre, tema] of [['claro', claro], ['oscuro', oscuro]]) {
  for (const [t, f] of PARES) {
    const r = contraste(tema[t], tema[f]);
    const ok = r >= 4.5;
    if (!ok) fallos++;
    console.log(`${ok ? 'ok   ' : 'FALLA'} ${nombre.padEnd(6)} --${t} sobre --${f}: ${r.toFixed(2)}:1`);
  }
}
if (fallos) { console.error(`\n${fallos} problemas de contraste`); process.exit(1); }
console.log('\nContraste AA correcto en todas las combinaciones.');
