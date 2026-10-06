import type { Descarga } from '../descargas';
import { tamanoArchivo } from '../../lib/datos';
import { fecha, numero } from '../../lib/formato';
import { SITIO } from '../../lib/sitio';
import { datosEmpleo } from './datos';

export async function descargasModulo(): Promise<Descarga[]> {
  const d = datosEmpleo();
  if (!d) return [];
  return [
    {
      titulo: 'Observatorio de empleo: resumen por sector, provincia y mes',
      url: '/data/empleo/resumen.json',
      formato: 'JSON',
      tamano: tamanoArchivo('empleo/resumen.json'),
      descripcion: `Habilidades y herramientas más pedidas, inglés y salario mediano de ${numero(d.resumen.total.ofertas)} ofertas publicadas ${d.periodo}. Solo grupos con 10 ofertas o más.`,
      licencia: 'CC BY 4.0',
      fecha: fecha(d.meta.fecha_proceso),
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': 'Dataset',
        name: 'Qué piden las empresas en Panamá: habilidades por sector',
        description: 'Agregados de una muestra de ofertas de empleo publicadas en Panamá, por sector, provincia y mes.',
        inLanguage: 'es',
        license: 'https://creativecommons.org/licenses/by/4.0/',
        temporalCoverage: `${d.meta.fecha_inicio}/${d.meta.fecha_fin}`,
        spatialCoverage: 'Panamá',
        dateModified: d.meta.fecha_proceso,
        creator: { '@type': 'Organization', name: SITIO.nombre, url: SITIO.repositorio },
        distribution: [{ '@type': 'DataDownload', encodingFormat: 'application/json', contentUrl: '/data/empleo/resumen.json' }],
      },
    },
  ];
}
