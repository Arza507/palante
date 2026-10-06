// Tarjetas del inicio. Cada módulo aporta su dato principal cuando tiene datos reales del pipeline.
import { numero } from '../lib/formato';
import { datos311 } from './m311/datos';
import { datosRutas } from './rutas/datos';

export interface Tarjeta {
  href: string;
  titulo: string;
  resumen: string;
  color: string;
  dato?: string;
  detalle?: string;
  fuente?: string;
}

export async function tarjetasInicio(): Promise<Tarjeta[]> {
  const d311 = datos311();
  const dRutas = datosRutas();
  const extrasEmpleo = await import('./empleo/inicio').then((m) => m.tarjetaEmpleo()).catch(() => ({}));
  return [
    {
      href: '/311',
      titulo: 'Mapa del 311',
      resumen: 'Qué problemas reporta la gente al 311 en cada corregimiento del distrito de Panamá.',
      color: 'var(--terracota)',
      ...(d311 && {
        dato: numero(d311.resumen.total),
        detalle: `reportes al 311 ${d311.periodo}.`,
        fuente: 'Fuente: Alcaldía de Panamá, datos abiertos (CC0).',
      }),
    },
    {
      href: '/empleo',
      titulo: 'Observatorio de empleo',
      resumen: 'Qué habilidades, herramientas e idiomas piden las empresas en Panamá, por sector.',
      color: 'var(--azulejo)',
      ...extrasEmpleo,
    },
    {
      href: '/rutas',
      titulo: 'Rutas de transporte',
      resumen: 'Rutas internas de busitos y chivas con sus paradas y tarifas.',
      color: 'var(--persiana)',
      ...(dRutas && {
        dato: numero(dRutas.rutas.features.length),
        detalle: `recorridos grabados por voluntarios. Datos del ${dRutas.fecha}.`,
        fuente: 'Fuente: capturas de voluntarios de Palante (CC BY 4.0).',
      }),
    },
  ];
}
