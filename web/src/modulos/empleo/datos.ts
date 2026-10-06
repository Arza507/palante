import { leerDatos } from '../../lib/datos';
import { fecha } from '../../lib/formato';
import { suficiente, type CeldaLlena, type MetaEmpleo, type ResumenEmpleo, type SectorEmpleo } from '../../lib/empleo';

export interface DatosEmpleo {
  resumen: ResumenEmpleo & { total: CeldaLlena };
  meta: MetaEmpleo;
  sectores: SectorEmpleo[];
  /** "del 2 de agosto al 29 de septiembre de 2026" */
  periodo: string;
  inicio: string;
  fin: string;
}

let cache: DatosEmpleo | null | undefined;

/** Salidas del pipeline de empleo, o null si no existen o no llegan a la muestra mínima. */
export function datosEmpleo(): DatosEmpleo | null {
  if (cache !== undefined) return cache;
  const resumen = leerDatos<ResumenEmpleo>('empleo/resumen.json');
  const meta = leerDatos<MetaEmpleo>('empleo/meta.json');
  if (!resumen || !meta || !suficiente(resumen.total) || !meta.fecha_inicio || !meta.fecha_fin) return (cache = null);
  const sectores = resumen.sectores
    .filter((s) => suficiente(s.celda))
    .map((s) => leerDatos<SectorEmpleo>(`empleo/sectores/${s.id}.json`))
    .filter((s): s is SectorEmpleo => s !== null);
  const inicio = fecha(meta.fecha_inicio);
  const fin = fecha(meta.fecha_fin);
  const mismoAnio = meta.fecha_inicio.slice(0, 4) === meta.fecha_fin.slice(0, 4);
  const inicioCorto = mismoAnio ? inicio.replace(/ de \d{4}$/, '') : inicio;
  cache = {
    resumen: resumen as DatosEmpleo['resumen'],
    meta,
    sectores,
    periodo: `del ${inicioCorto} al ${fin}`,
    inicio: inicioCorto,
    fin,
  };
  return cache;
}
