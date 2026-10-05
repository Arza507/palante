import type { Topology } from 'topojson-specification';
import { leerDatos } from '../../lib/datos';
import { fecha } from '../../lib/formato';
import type { Meta311, Resumen311 } from '../../lib/m311';

export interface Datos311 {
  resumen: Resumen311;
  meta: Meta311;
  topo: Topology;
  /** "del 1 de abril al 30 de junio de 2026" */
  periodo: string;
  inicio: string;
  fin: string;
}

let cache: Datos311 | null | undefined;

/** Salidas del pipeline del 311, o null si todavía no existen. */
export function datos311(): Datos311 | null {
  if (cache !== undefined) return cache;
  const resumen = leerDatos<Resumen311>('311/resumen.json');
  const meta = leerDatos<Meta311>('311/meta.json');
  const topo = leerDatos<Topology>('311/corregimientos.topo.json');
  if (!resumen || !meta || !topo) return (cache = null);
  const inicio = fecha(meta.periodo_inicio);
  const fin = fecha(meta.periodo_fin);
  const mismoAnio = meta.periodo_inicio.slice(0, 4) === meta.periodo_fin.slice(0, 4);
  const inicioCorto = mismoAnio ? inicio.replace(/ de \d{4}$/, '') : inicio;
  cache = { resumen, meta, topo, periodo: `del ${inicioCorto} al ${fin}`, inicio: inicioCorto, fin };
  return cache;
}
