// Lógica del mapa del 311, compartida entre el build (Astro) y el cliente (isla de Preact).
import { numero, porcentaje } from './formato';

export interface Resumen311 {
  version: number;
  categorias: { id: string; nombre: string }[];
  estados: { id: string; nombre: string; resuelto: boolean }[];
  trimestres: { id: string; nombre: string }[];
  corregimientos: { slug: string; nombre: string; poblacion: number | null }[];
  conteos: [number, number, number, number, number][];
  total: number;
  dias_cierre_distrito: { mediana: number | null; n: number };
  dias_cierre: Record<string, { mediana: number | null; n: number }>;
  minimo_casos_mediana: number;
}

export interface Meta311 {
  fuente: string;
  url: string;
  licencia: string;
  fecha_datos: string;
  fecha_datos_texto: string;
  periodo_inicio: string;
  periodo_fin: string;
  fecha_proceso: string;
  filas_leidas: number;
  filas_validas: number;
  filas_descartadas: { motivo: string; filas: number; detalle: string[] }[];
  servicios_sin_categoria: string[];
  poblacion_disponible: boolean;
  poblacion_nota: string;
  conjuntos: { titulo: string; url: string }[];
  filas_por_periodo: { archivo: string; mes: string; leidas: number; validas: number }[];
  fuentes: { id: string; nombre: string; url: string; licencia: string; fecha_texto: string }[];
}

export interface Filtros {
  categoria: string;
  estado: string;
  trimestre: string;
}

export const SIN_FILTRO: Filtros = { categoria: '', estado: '', trimestre: '' };

/** Lee los filtros de la URL y descarta valores que no existen en los datos. */
export function leerFiltros(busqueda: string, r: Resumen311): Filtros {
  const q = new URLSearchParams(busqueda);
  const valido = (v: string | null, lista: { id: string }[]) => (v && lista.some((x) => x.id === v) ? v : '');
  return {
    categoria: valido(q.get('categoria'), r.categorias),
    estado: valido(q.get('estado'), r.estados),
    trimestre: valido(q.get('trimestre'), r.trimestres),
  };
}

export function escribirFiltros(f: Filtros): string {
  const q = new URLSearchParams();
  if (f.categoria) q.set('categoria', f.categoria);
  if (f.estado) q.set('estado', f.estado);
  if (f.trimestre) q.set('trimestre', f.trimestre);
  const s = q.toString();
  return s ? `?${s}` : '';
}

export interface Fila {
  slug: string;
  nombre: string;
  total: number;
  resueltos: number;
  porCategoria: number[];
  poblacion: number | null;
  /** Valor del mapa: reportes por cada 10.000 habitantes si hay población; si no, reportes. */
  valor: number;
}

/** Suma los conteos que cumplen los filtros, por corregimiento. */
export function agregar(r: Resumen311, f: Filtros): Fila[] {
  const ic = f.categoria ? r.categorias.findIndex((c) => c.id === f.categoria) : -1;
  const ie = f.estado ? r.estados.findIndex((e) => e.id === f.estado) : -1;
  const it = f.trimestre ? r.trimestres.findIndex((t) => t.id === f.trimestre) : -1;
  const conPoblacion = usaTasa(r);
  const filas: Fila[] = r.corregimientos.map((c) => ({
    slug: c.slug, nombre: c.nombre, total: 0, resueltos: 0,
    porCategoria: r.categorias.map(() => 0), poblacion: c.poblacion, valor: 0,
  }));
  for (const [c, k, t, e, n] of r.conteos) {
    if ((ic >= 0 && k !== ic) || (ie >= 0 && e !== ie) || (it >= 0 && t !== it)) continue;
    const fila = filas[c];
    fila.total += n;
    fila.porCategoria[k] += n;
    if (r.estados[e].resuelto) fila.resueltos += n;
  }
  for (const fila of filas) {
    fila.valor = conPoblacion && fila.poblacion ? (fila.total / fila.poblacion) * 10000 : fila.total;
  }
  return filas;
}

export function usaTasa(r: Resumen311): boolean {
  return r.corregimientos.length > 0 && r.corregimientos.every((c) => c.poblacion && c.poblacion > 0);
}

/** Cortes de hasta cinco clases sobre los valores mayores que cero (cuantiles redondeados). */
export function cortes(valores: number[], decimales = 0): number[] {
  const pos = valores.filter((v) => v > 0).sort((a, b) => a - b);
  if (pos.length === 0) return [];
  const f = 10 ** decimales;
  const redondea = (v: number) => Math.round(v * f) / f;
  const res: number[] = [];
  for (const q of [0.2, 0.4, 0.6, 0.8]) {
    const v = redondea(pos[Math.min(pos.length - 1, Math.floor(q * pos.length))]);
    if (v < redondea(pos[pos.length - 1]) && (res.length === 0 || v > res[res.length - 1])) res.push(v);
  }
  res.push(redondea(pos[pos.length - 1]));
  return res;
}

/** Clase de un valor: 0 sin reportes, 1 a 5 según los cortes (límite superior incluido). */
export function clase(valor: number, c: number[]): number {
  if (valor <= 0 || c.length === 0) return 0;
  for (let i = 0; i < c.length; i++) if (valor <= c[i]) return claseEscalada(i, c.length);
  return claseEscalada(c.length - 1, c.length);
}

/** Reparte n clases sobre la escala de 5 colores para que la más alta siempre sea la más oscura. */
function claseEscalada(i: number, n: number): number {
  if (n === 1) return 5;
  return 1 + Math.round((i * 4) / (n - 1));
}

export interface PasoLeyenda {
  clase: number;
  texto: string;
}

export function leyenda(c: number[], decimales = 0): PasoLeyenda[] {
  const pasos: PasoLeyenda[] = [{ clase: 0, texto: 'Sin reportes' }];
  const paso = 1 / 10 ** decimales;
  c.forEach((max, i) => {
    const min = i === 0 ? (decimales ? paso : 1) : c[i - 1] + paso;
    const texto = min >= max ? numero(max, decimales) : `${numero(min, decimales)} a ${numero(max, decimales)}`;
    pasos.push({ clase: claseEscalada(i, c.length), texto });
  });
  return pasos;
}

export const COLOR_CLASE = ['var(--calor-sin-dato)', 'var(--calor-1)', 'var(--calor-2)', 'var(--calor-3)', 'var(--calor-4)', 'var(--calor-5)'];

/** Por debajo de este número de casos no se dan porcentajes ni posiciones de ranking. */
export const MINIMO_MUESTRA = 10;
export const MUESTRA_INSUFICIENTE = 'muestra insuficiente';

export const muestraSuficiente = (casos: number) => casos >= MINIMO_MUESTRA;

/** "1 caso" o "12 casos". */
export const casos = (n: number) => `${numero(n)} ${n === 1 ? 'caso' : 'casos'}`;

/** Porcentaje con su número de casos: "62 % (31 de 50 casos)". Null si la base tiene menos de 10 casos. */
export function proporcion(parte: number, base: number, decimales = 0): string | null {
  if (!muestraSuficiente(base)) return null;
  return `${porcentaje(parte / base, decimales)} (${numero(parte)} de ${casos(base)})`;
}

export interface CategoriaFila { id: string; nombre: string; n: number }

export interface Detalle {
  total: number;
  /** El corregimiento tiene 10 casos o más. */
  suficiente: boolean;
  /** Hasta tres categorías con 10 casos o más, en orden. Vacío si el total no llega a 10. */
  principales: CategoriaFila[];
  /** Categorías con casos que no entran en el orden por tener menos de 10. */
  pocas: CategoriaFila[];
  resueltos: number;
  /** Null si no hay casos o la muestra es insuficiente. */
  porcentajeResuelto: number | null;
}

/** Total, tres problemas principales y porcentaje resuelto de una fila, sin porcentajes ni orden en muestras pequeñas. */
export function detalle(r: Resumen311, fila: Fila): Detalle {
  const suficiente = muestraSuficiente(fila.total);
  const conCasos = r.categorias
    .map((c, i) => ({ id: c.id, nombre: c.nombre, n: fila.porCategoria[i] }))
    .filter((c) => c.n > 0)
    .sort((a, b) => b.n - a.n || a.nombre.localeCompare(b.nombre, 'es'));
  const principales = suficiente ? conCasos.filter((c) => muestraSuficiente(c.n)).slice(0, 3) : [];
  return {
    total: fila.total,
    suficiente,
    principales,
    pocas: conCasos.filter((c) => !muestraSuficiente(c.n)),
    resueltos: fila.resueltos,
    porcentajeResuelto: suficiente ? fila.resueltos / fila.total : null,
  };
}

/** Totales del distrito con los mismos filtros. */
export function totalDistrito(filas: Fila[]): Fila {
  const base = filas[0]?.porCategoria.map(() => 0) ?? [];
  return filas.reduce<Fila>(
    (a, f) => ({
      ...a,
      total: a.total + f.total,
      resueltos: a.resueltos + f.resueltos,
      porCategoria: a.porCategoria.map((v, i) => v + f.porCategoria[i]),
    }),
    { slug: 'distrito', nombre: 'Distrito de Panamá', total: 0, resueltos: 0, porCategoria: base, poblacion: null, valor: 0 },
  );
}

/**
 * Texto para compartir, siempre con datos reales:
 * "En {corregimiento} hubo {n} reportes de {categoría} al 311 entre {inicio} y {fin}. Míralo en Palante."
 */
export function textoCompartir(nombre: string, d: Detalle, inicio: string, fin: string): string {
  const cat = d.principales.find((c) => c.id !== 'otros');
  if (cat) {
    return `En ${nombre} hubo ${numero(cat.n)} ${cat.n === 1 ? 'reporte' : 'reportes'} de ${cat.nombre.toLowerCase()} al 311 entre el ${inicio} y el ${fin}. Míralo en Palante.`;
  }
  return `En ${nombre} hubo ${numero(d.total)} ${d.total === 1 ? 'reporte' : 'reportes'} al 311 entre el ${inicio} y el ${fin}. Míralo en Palante.`;
}

/** Colores de fachada e iconos de cada categoría (texto oscuro encima). */
export const ESTILO_CATEGORIA: Record<string, { color: string; icono: string }> = {
  agua: { color: '#9FC1D6', icono: 'agua' },
  calles: { color: '#F2D7A7', icono: 'calles' },
  basura: { color: '#C9D9C4', icono: 'basura' },
  alumbrado: { color: '#E8B04B', icono: 'alumbrado' },
  drenajes: { color: '#A9D3CF', icono: 'drenajes' },
  arboles: { color: '#B8D69A', icono: 'arboles' },
  ruido: { color: '#E7A598', icono: 'ruido' },
  otros: { color: '#E3DCD2', icono: 'otros' },
};
