import type { DatosOg } from '../../og/render';
import { numero } from '../../lib/formato';
import { agregar, detalle, SIN_FILTRO } from '../../lib/m311';
import { datos311 } from './datos';

export async function paginasOgModulo(): Promise<DatosOg[]> {
  const d = datos311();
  if (!d) return [{ slug: '311', titulo: 'Mapa del 311: próximamente' }];
  const fecha = `Casos creados ${d.periodo}`;
  const paginas: DatosOg[] = [
    { slug: '311', titulo: 'Reportes al 311 por corregimiento, distrito de Panamá', dato: numero(d.resumen.total), detalle: 'reportes', fecha },
    { slug: '311/metodologia', titulo: 'Cómo hacemos el mapa del 311' },
  ];
  for (const f of agregar(d.resumen, SIN_FILTRO)) {
    const det = detalle(d.resumen, f);
    paginas.push({
      slug: `311/${f.slug}`,
      titulo: `${f.nombre}: reportes al 311`,
      dato: numero(det.total),
      detalle: det.principales[0] ? `reportes; el principal: ${det.principales[0].nombre.toLowerCase()}` : 'reportes',
      fecha,
    });
  }
  return paginas;
}
