import type { DatosOg } from '../../og/render';
import { numero } from '../../lib/formato';
import { datosEmpleo } from './datos';

export async function paginasOgModulo(): Promise<DatosOg[]> {
  const d = datosEmpleo();
  const metodologia = { slug: 'empleo/metodologia', titulo: 'Cómo hacemos el observatorio de empleo' };
  if (!d) {
    return [
      { slug: 'empleo', titulo: 'Observatorio de empleo: próximamente' },
      { slug: 'empleo/informe', titulo: 'Qué piden las empresas en Panamá: próximamente' },
      metodologia,
    ];
  }
  const fecha = `Ofertas publicadas ${d.periodo}`;
  const total = d.resumen.total;
  const principal = (h?: { nombre: string }) => (h ? `ofertas; lo más pedido: ${h.nombre.toLowerCase()}` : 'ofertas');
  return [
    { slug: 'empleo', titulo: 'Qué piden las empresas en Panamá, por sector', dato: numero(total.ofertas), detalle: principal(total.habilidades[0]), fecha },
    { slug: 'empleo/informe', titulo: 'Qué piden las empresas en Panamá, edición 1', dato: numero(total.ofertas), detalle: 'ofertas analizadas', fecha },
    metodologia,
    ...d.sectores.map((s) => ({
      slug: `empleo/${s.id}`,
      titulo: `${s.nombre}: qué piden las empresas`,
      dato: numero(s.celda.ofertas ?? 0),
      detalle: principal(s.celda.habilidades[0]),
      fecha,
    })),
  ];
}
