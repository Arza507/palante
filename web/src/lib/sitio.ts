// Configuración general del sitio. Los valores que dependen de Iker vienen de variables de entorno.
export const SITIO = {
  nombre: 'Palante',
  lema: 'Datos para echar palante',
  descripcion:
    'Mapas y paneles claros con datos públicos de Panamá, hechos para verse bien en cualquier teléfono.',
  repositorio: 'https://github.com/Arza507/palante',
  contacto: (import.meta.env.PUBLIC_CONTACTO_EMAIL as string | undefined) || '',
  balizaAnalitica: (import.meta.env.PUBLIC_CF_BEACON_TOKEN as string | undefined) || '',
  idioma: 'es-PA',
} as const;

/** La página de rutas solo existe cuando la bandera PUBLIC_RUTAS vale "true". */
export const RUTAS_ACTIVAS = import.meta.env.PUBLIC_RUTAS === 'true';
