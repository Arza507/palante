// Genera favicon e iconos de la PWA a partir de la variante provisional del logo.
// Uso: node scripts/generar-iconos.mjs [a|b|c]   (por defecto "a"; el logo definitivo lo elige Iker)
import { Resvg } from '@resvg/resvg-js';
import { readFileSync, writeFileSync } from 'node:fs';

const v = process.argv[2] ?? 'a';
const icono = readFileSync(new URL(`../../design/logo/palante-${v}-icono.svg`, import.meta.url), 'utf8');
const interior = icono.replace(/^<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '').replace(/<title>.*?<\/title>/, '');

// Icono normal: el SVG tal cual, sobre fondo transparente o su propio fondo.
const normal = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">${interior}</svg>`;
// Maskable: fondo terracota a sangre y el dibujo dentro de la zona segura (80 % central).
const dibujo = interior.replace(/<rect[^>]*\/>/, '');
const maskable = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="#B5452F"/><g transform="translate(12.8 12.8) scale(.6)">${dibujo.replaceAll('#B5452F', '#FBF6EE').replaceAll('#2A2623', '#FBF6EE').replaceAll('#2E6B62', '#FBF6EE')}</g></svg>`;

const png = (svg, size) => new Resvg(svg, { fitTo: { mode: 'width', value: size } }).render().asPng();
writeFileSync(new URL('../public/favicon.svg', import.meta.url), normal);
for (const s of [192, 512]) writeFileSync(new URL(`../public/icons/icono-${s}.png`, import.meta.url), png(normal, s));
for (const s of [192, 512]) writeFileSync(new URL(`../public/icons/icono-maskable-${s}.png`, import.meta.url), png(maskable, s));
writeFileSync(new URL('../public/icons/apple-touch-icon.png', import.meta.url), png(maskable, 180));
console.log(`Iconos generados con la variante ${v.toUpperCase()}`);
