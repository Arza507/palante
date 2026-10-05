import type { Descarga } from '../descargas';
import { tamanoArchivo } from '../../lib/datos';
import { SITIO } from '../../lib/sitio';
import { datos311 } from './datos';

export async function descargasModulo(): Promise<Descarga[]> {
  const d = datos311();
  if (!d) return [];
  const base = {
    licencia: 'CC0 1.0',
    fecha: d.meta.fecha_datos_texto,
  };
  const dataset = (nombre: string, url: string, formato: string, descripcion: string) => ({
    '@context': 'https://schema.org',
    '@type': 'Dataset',
    name: nombre,
    description: descripcion,
    inLanguage: 'es',
    license: 'https://creativecommons.org/publicdomain/zero/1.0/',
    isBasedOn: d.meta.url,
    temporalCoverage: `${d.meta.periodo_inicio}/${d.meta.periodo_fin}`,
    spatialCoverage: 'Distrito de Panamá, Panamá',
    dateModified: d.meta.fecha_proceso,
    creator: { '@type': 'Organization', name: SITIO.nombre, url: SITIO.repositorio },
    distribution: [{ '@type': 'DataDownload', encodingFormat: formato, contentUrl: url }],
  });
  return [
    {
      ...base,
      titulo: 'Casos del 311 limpios',
      url: '/data/311/311-limpio.csv',
      formato: 'CSV',
      tamano: tamanoArchivo('311/311-limpio.csv'),
      descripcion: `Un caso por fila, ${d.periodo}, con categoría, estado y corregimiento. Sin nombres ni descripciones.`,
      jsonLd: dataset('Casos del 311 del distrito de Panamá, limpios', '/data/311/311-limpio.csv', 'text/csv',
        'Casos reportados al 311 de la Alcaldía de Panamá, sin datos personales ni texto libre, con categoría y corregimiento.'),
    },
    {
      ...base,
      titulo: 'Resumen del 311 por corregimiento',
      url: '/data/311/resumen.json',
      formato: 'JSON',
      tamano: tamanoArchivo('311/resumen.json'),
      descripcion: 'Conteos por corregimiento, categoría, trimestre y estado.',
      jsonLd: dataset('Resumen de reportes al 311 por corregimiento', '/data/311/resumen.json', 'application/json',
        'Conteos de reportes al 311 por corregimiento, categoría, trimestre y estado en el distrito de Panamá.'),
    },
    {
      titulo: 'Límites de corregimientos (TopoJSON)',
      url: '/data/311/corregimientos.topo.json',
      formato: 'TopoJSON',
      tamano: tamanoArchivo('311/corregimientos.topo.json'),
      descripcion: 'Polígonos simplificados del distrito de Panamá. © colaboradores de OpenStreetMap.',
      licencia: 'ODbL 1.0',
      fecha: d.meta.fuentes.find((f) => f.id === 'osm')?.fecha_texto ?? '',
      jsonLd: {
        '@context': 'https://schema.org', '@type': 'Dataset',
        name: 'Límites de corregimientos del distrito de Panamá',
        description: 'Polígonos simplificados de los corregimientos del distrito de Panamá, derivados de OpenStreetMap.',
        license: 'https://opendatacommons.org/licenses/odbl/1-0/',
        creator: { '@type': 'Organization', name: 'Colaboradores de OpenStreetMap' },
        distribution: [{ '@type': 'DataDownload', encodingFormat: 'application/json', contentUrl: '/data/311/corregimientos.topo.json' }],
      },
    },
  ];
}
