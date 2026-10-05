// Fuentes de datos de Palante con su licencia. Las fechas salen de los meta.json del pipeline.
export interface Fuente {
  id: string;
  nombre: string;
  quien: string;
  url: string;
  licencia: string;
  urlLicencia: string;
  uso: string;
  atribucion?: string;
}

export const FUENTES: Fuente[] = [
  {
    id: '311',
    nombre: 'Detalle de casos reportados al 311',
    quien: 'Alcaldía de Panamá, en el Portal de Datos Abiertos de Panamá',
    url: 'https://www.datosabiertos.gob.pa/en_AU/dataset/alcaldia-de-panama-detalle-de-casos-reportados-al-311-2026',
    licencia: 'CC0 1.0 (dominio público)',
    urlLicencia: 'https://creativecommons.org/publicdomain/zero/1.0/deed.es',
    uso: 'Reportes por corregimiento, categoría, trimestre y estado.',
  },
  {
    id: 'osm',
    nombre: 'OpenStreetMap',
    quien: 'Colaboradores de OpenStreetMap',
    url: 'https://www.openstreetmap.org/copyright',
    licencia: 'Open Database License (ODbL) 1.0',
    urlLicencia: 'https://opendatacommons.org/licenses/odbl/1-0/',
    uso: 'Límites de corregimientos y mapa de calles.',
    atribucion: '© colaboradores de OpenStreetMap',
  },
  {
    id: 'inec',
    nombre: 'Censos y encuestas del INEC',
    quien: 'Instituto Nacional de Estadística y Censo, Contraloría General de la República',
    url: 'https://www.inec.gob.pa/',
    licencia: 'Información pública, con cita de la fuente',
    urlLicencia: 'https://www.inec.gob.pa/',
    uso: 'Población por corregimiento y mercado laboral.',
  },
  {
    id: 'esco',
    nombre: 'ESCO: clasificación europea de capacidades y ocupaciones',
    quien: 'Comisión Europea',
    url: 'https://esco.ec.europa.eu/es',
    licencia: 'Reutilización libre con atribución (Decisión 2011/833/UE)',
    urlLicencia: 'https://esco.ec.europa.eu/es/about-esco/data-science-and-esco/esco-copyright-and-licence',
    uso: 'Nombres en español de habilidades para agrupar las ofertas de empleo.',
  },
  {
    id: 'protomaps',
    nombre: 'Protomaps',
    quien: 'Protomaps, con datos de OpenStreetMap',
    url: 'https://protomaps.com/',
    licencia: 'Software BSD-3; datos ODbL de OpenStreetMap',
    urlLicencia: 'https://github.com/protomaps/basemaps/blob/main/LICENSE.md',
    uso: 'Teselas del mapa de calles en la página de rutas.',
  },
];
