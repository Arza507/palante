// Dato principal del observatorio de empleo para el inicio. Vacío mientras no haya datos publicables.
import { numero } from '../../lib/formato';
import { datosEmpleo } from './datos';

export async function tarjetaEmpleo(): Promise<Record<string, string>> {
  const d = datosEmpleo();
  if (!d) return {};
  return {
    dato: numero(d.resumen.total.ofertas),
    detalle: `ofertas de empleo analizadas, publicadas ${d.periodo}.`,
    fuente: 'Fuente: muestra de ofertas públicas recogida por Palante.',
  };
}
