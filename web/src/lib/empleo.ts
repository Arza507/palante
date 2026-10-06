// Tipos y cálculos del observatorio de empleo. Los datos salen de web/public/data/empleo/ (pipeline).
import { numero, porcentaje } from './formato';

export const MINIMO_OFERTAS = 10;

export interface Conteo { nombre: string; n: number; esco: string | null }

/** Estadísticas de un grupo de ofertas. Con muestra insuficiente no trae números. */
export interface Celda {
  insuficiente: boolean;
  ofertas: number | null;
  habilidades: Conteo[];
  herramientas: Conteo[];
  pide_ingles: number | null;
  ofertas_con_salario: number | null;
  salario_mediano: number | null;
  modalidad: Record<string, number>;
}

export interface Grupo { id: string; nombre: string; celda: Celda }

export interface ResumenEmpleo {
  version: number;
  minimo_ofertas: number;
  total: Celda;
  sectores: Grupo[];
  provincias: Grupo[];
  meses: Grupo[];
}

export interface SectorEmpleo extends Grupo {
  version: number;
  minimo_ofertas: number;
  provincias: Grupo[];
  meses: Grupo[];
}

export interface MetaEmpleo {
  origen: string;
  fecha_proceso: string;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  filas_leidas: number;
  ofertas_validas: number;
  ofertas_con_extraccion: number;
  ofertas_sin_extraccion: number;
  filas_descartadas: { motivo: string; filas: number }[];
  fuentes_ofertas: string[];
  modelo_extraccion: string;
  esco_disponible: boolean;
  informalidad: { porcentaje: number; periodo: string; fuente: string; url: string } | null;
  fuentes: { id: string; nombre: string; url: string; licencia: string; fecha_texto: string }[];
}

/** Una celda con números publicables. */
export type CeldaLlena = Celda & { insuficiente: false; ofertas: number };

export function suficiente(c: Celda): c is CeldaLlena {
  return !c.insuficiente && c.ofertas !== null && c.ofertas >= MINIMO_OFERTAS;
}

/** "1 oferta", "25 ofertas". */
export function ofertas(n: number): string {
  return `${numero(n)} ${n === 1 ? 'oferta' : 'ofertas'}`;
}

/** Porcentaje con su base: "40 % (10 de 25 ofertas)". */
export function conBase(n: number, total: number): string {
  return `${porcentaje(n / total)} (${numero(n)} de ${ofertas(total)})`;
}

const MODALIDADES: Record<string, string> = {
  presencial: 'Presencial',
  hibrido: 'Híbrido',
  remoto: 'Remoto',
  'no indicado': 'No lo dice',
};

/** Modalidades ordenadas de más a menos ofertas, con nombre legible. */
export function modalidades(c: CeldaLlena): { nombre: string; n: number }[] {
  return Object.entries(c.modalidad)
    .map(([k, n]) => ({ nombre: MODALIDADES[k] ?? k, n }))
    .sort((a, b) => b.n - a.n || a.nombre.localeCompare(b.nombre, 'es'));
}

/** Dólares sin decimales: "1.250 dólares". */
export function dolares(n: number): string {
  return `${numero(Math.round(n))} dólares`;
}

/** Grupos publicados y nombres de los que tienen muestra insuficiente. */
export function separar(grupos: Grupo[]): { publicados: (Grupo & { celda: CeldaLlena })[]; insuficientes: string[] } {
  const publicados = grupos.filter((g): g is Grupo & { celda: CeldaLlena } => suficiente(g.celda));
  const insuficientes = grupos.filter((g) => !suficiente(g.celda)).map((g) => g.nombre);
  return { publicados, insuficientes };
}

/** Texto para compartir, siempre con datos reales. */
export function textoCompartirEmpleo(sector: string | null, c: CeldaLlena, inicio: string, fin: string): string {
  const donde = sector ? `En ${sector.toLowerCase()}` : 'En Panamá';
  const h = c.habilidades[0];
  if (!h) return `${donde} analizamos ${ofertas(c.ofertas)} publicadas entre ${inicio} y ${fin}. Míralo en Palante.`;
  return `${donde}, el ${porcentaje(h.n / c.ofertas)} de las ${ofertas(c.ofertas)} publicadas entre ${inicio} y ${fin} pedía ${h.nombre.toLowerCase()}. Míralo en Palante.`;
}
