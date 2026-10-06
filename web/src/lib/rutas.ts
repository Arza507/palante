// Tipos y ayudas de la página de rutas. Los datos salen de web/public/data/rutas/ (pipeline).
import { numero } from './formato';

export interface PropsRuta {
  id: string;
  ruta: string;
  sentido: 'ida' | 'vuelta';
  operador: string;
  tarifa_usd: number | null;
  sector: string;
  paradas: string[];
  ultima_captura: string;
}
export interface PropsParada { id: string; nombre: string; rutas: string[] }

export interface Coleccion<P, G> {
  type: 'FeatureCollection';
  features: { type: 'Feature'; id: string; properties: P; geometry: G }[];
}
export type RutasGeo = Coleccion<PropsRuta, { type: 'LineString'; coordinates: [number, number][] }>;
export type ParadasGeo = Coleccion<PropsParada, { type: 'Point'; coordinates: [number, number] }>;

export interface MetaRutas {
  fecha_proceso: string;
  licencia: string;
  rutas: { id: string; en_gtfs: boolean }[];
  validacion_gtfs: string[];
}

// Colores de las líneas: tokens del tema; cada ruta lleva además su número, para no depender del color.
export const COLORES = ['var(--terracota)', 'var(--azulejo)', 'var(--persiana)', 'var(--buganvilla)', 'var(--terracota-oscuro)', 'var(--hierro-suave)'];

export function color(i: number): string {
  return COLORES[i % COLORES.length];
}

/** "0,50 dólares"; sin tarifa, "sin dato". */
export function tarifa(t: number | null): string {
  return t === null ? 'sin dato' : `${numero(t, 2)} dólares`;
}

/** Rutas agrupadas por sector, en orden alfabético, conservando el número de cada ruta. */
export function porSector(rutas: PropsRuta[]): { sector: string; rutas: (PropsRuta & { n: number })[] }[] {
  const grupos = new Map<string, (PropsRuta & { n: number })[]>();
  rutas.forEach((r, i) => grupos.set(r.sector, [...(grupos.get(r.sector) ?? []), { ...r, n: i + 1 }]));
  return [...grupos.entries()]
    .sort(([a], [b]) => (a === 'Sin sector' ? 1 : b === 'Sin sector' ? -1 : a.localeCompare(b, 'es')))
    .map(([sector, rs]) => ({ sector, rutas: rs }));
}

/** Nombre visible de una parada. */
export function nombreParada(p: PropsParada | undefined, id: string): string {
  return p?.nombre || `Parada ${id} (sin nombre)`;
}
