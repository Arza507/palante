// Imagen de 1200 x 630 para compartir (WhatsApp y redes), generada en el build con satori y resvg.
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export type DatosOg = {
  slug: string;
  titulo: string;
  /** Dato principal, ya formateado. Solo datos reales del pipeline. */
  dato?: string;
  /** Contexto del dato principal. */
  detalle?: string;
  /** Fecha de los datos, ya formateada. */
  fecha?: string;
};

const raiz = process.cwd();
const fuente = readFileSync(resolve(raiz, 'src/og/fraunces-600.ttf'));
const fachadas = readFileSync(resolve(raiz, 'src/assets/fachadas.svg'), 'utf8')
  .replace('preserveAspectRatio="xMidYMax slice"', 'preserveAspectRatio="none"');
const fachadasUri = `data:image/svg+xml;base64,${Buffer.from(fachadas).toString('base64')}`;
const logoUri = `data:image/svg+xml;base64,${Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#B5452F"/><path d="M6 22Q32 12 58 22V31Q32 22 6 31Z" fill="#FBF6EE"/><path d="M14 46H46M38 38l9 8-9 8" fill="none" stroke="#FBF6EE" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
).toString('base64')}`;

type Nodo = { type: string; props: Record<string, unknown> };
const h = (type: string, style: Record<string, unknown>, ...children: unknown[]): Nodo => ({
  type,
  props: { style, children: children.length === 1 ? children[0] : children },
});

export async function renderOg(d: DatosOg): Promise<Buffer> {
  const hijos: unknown[] = [
    h('div', { display: 'flex', alignItems: 'center', gap: 20 },
      { type: 'img', props: { src: logoUri, width: 72, height: 72 } },
      h('div', { fontSize: 44, color: '#2A2623' }, 'Palante')),
    h('div', { fontSize: d.dato ? 50 : 64, color: '#2A2623', marginTop: 36, lineHeight: 1.15, maxWidth: 1040 }, d.titulo),
  ];
  if (d.dato) {
    hijos.push(h('div', { display: 'flex', alignItems: 'baseline', gap: 20, marginTop: 20 },
      h('div', { fontSize: 96, color: '#B5452F' }, d.dato),
      d.detalle ? h('div', { fontSize: 34, color: '#5E5650', maxWidth: 640 }, d.detalle) : ''));
  }
  if (d.fecha) hijos.push(h('div', { fontSize: 28, color: '#5E5650', marginTop: 16 }, d.fecha));
  const arbol = h('div', {
    width: 1200, height: 630, display: 'flex', flexDirection: 'column', background: '#FBF6EE',
    fontFamily: 'Fraunces', position: 'relative',
  },
  h('div', { display: 'flex', flexDirection: 'column', padding: '56px 72px 0' }, ...hijos),
  { type: 'img', props: { src: fachadasUri, width: 1200, height: 150, style: { position: 'absolute', bottom: 0, left: 0 } } });

  const svg = await satori(arbol as never, {
    width: 1200,
    height: 630,
    fonts: [{ name: 'Fraunces', data: fuente, weight: 600, style: 'normal' }],
  });
  return new Resvg(svg, { fitTo: { mode: 'width', value: 1200 } }).render().asPng();
}
