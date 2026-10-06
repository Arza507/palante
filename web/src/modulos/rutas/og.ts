import type { DatosOg } from '../../og/render';
import { numero } from '../../lib/formato';
import { RUTAS_ACTIVAS } from '../../lib/sitio';
import { datosRutas } from './datos';

export async function paginasOgModulo(): Promise<DatosOg[]> {
  const paginas: DatosOg[] = [{ slug: 'captura', titulo: 'Captura de rutas para voluntarios' }];
  const d = datosRutas();
  if (RUTAS_ACTIVAS && d) {
    paginas.push({ slug: 'rutas', titulo: 'Rutas internas de busitos y chivas', dato: numero(d.rutas.features.length), detalle: 'recorridos con sus paradas', fecha: `Datos del ${d.fecha}` });
  }
  return paginas;
}
