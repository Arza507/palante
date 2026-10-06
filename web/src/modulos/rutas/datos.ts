import { leerDatos } from '../../lib/datos';
import { fecha } from '../../lib/formato';
import type { MetaRutas, ParadasGeo, RutasGeo } from '../../lib/rutas';

export interface DatosRutas {
  rutas: RutasGeo;
  paradas: ParadasGeo;
  meta: MetaRutas;
  fecha: string;
  hayGtfs: boolean;
}

/** Salidas del pipeline de rutas, o null si no hay ninguna ruta publicada. */
export function datosRutas(): DatosRutas | null {
  const rutas = leerDatos<RutasGeo>('rutas/rutas.geojson');
  const paradas = leerDatos<ParadasGeo>('rutas/paradas.geojson');
  const meta = leerDatos<MetaRutas>('rutas/meta.json');
  if (!rutas || !paradas || !meta || rutas.features.length === 0) return null;
  return { rutas, paradas, meta, fecha: fecha(meta.fecha_proceso), hayGtfs: meta.rutas.some((r) => r.en_gtfs) };
}
