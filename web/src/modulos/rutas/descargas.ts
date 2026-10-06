import type { Descarga } from '../descargas';
import { tamanoArchivo } from '../../lib/datos';
import { RUTAS_ACTIVAS, SITIO } from '../../lib/sitio';
import { datosRutas } from './datos';

export async function descargasModulo(): Promise<Descarga[]> {
  const d = datosRutas();
  if (!RUTAS_ACTIVAS || !d) return [];
  const ld = (name: string, url: string, formato: string) => ({
    '@context': 'https://schema.org', '@type': 'Dataset', name, inLanguage: 'es',
    description: 'Rutas internas de transporte con permiso de la ATTT capturadas por voluntarios de Palante.',
    license: 'https://creativecommons.org/licenses/by/4.0/', spatialCoverage: 'Panamá', dateModified: d.meta.fecha_proceso,
    creator: { '@type': 'Organization', name: SITIO.nombre, url: SITIO.repositorio },
    distribution: [{ '@type': 'DataDownload', encodingFormat: formato, contentUrl: url }],
  });
  const base = { licencia: 'CC BY 4.0', fecha: d.fecha };
  const lista: Descarga[] = [
    { ...base, titulo: 'Recorridos de las rutas (GeoJSON)', url: '/data/rutas/rutas.geojson', formato: 'GeoJSON', tamano: tamanoArchivo('rutas/rutas.geojson'),
      descripcion: 'Una línea por ruta y sentido, con operador, tarifa y paradas.', jsonLd: ld('Recorridos de rutas internas', '/data/rutas/rutas.geojson', 'application/geo+json') },
    { ...base, titulo: 'Paradas (GeoJSON)', url: '/data/rutas/paradas.geojson', formato: 'GeoJSON', tamano: tamanoArchivo('rutas/paradas.geojson'),
      descripcion: 'Un punto por parada, con las rutas que pasan.', jsonLd: ld('Paradas de rutas internas', '/data/rutas/paradas.geojson', 'application/geo+json') },
  ];
  if (d.hayGtfs) {
    lista.push({ ...base, titulo: 'Rutas en formato GTFS', url: '/data/rutas/gtfs.zip', formato: 'GTFS (zip)', tamano: tamanoArchivo('rutas/gtfs.zip'),
      descripcion: 'Formato abierto que leen Google Maps, OpenStreetMap y las apps de transporte.', jsonLd: ld('Rutas internas en GTFS', '/data/rutas/gtfs.zip', 'application/zip') });
  }
  return lista;
}
