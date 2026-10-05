// Registro de imágenes para compartir. Cada página del sitio tiene una entrada aquí.
import type { DatosOg } from './render';

export const PAGINAS_COMUNES: DatosOg[] = [
  { slug: 'inicio', titulo: 'Datos públicos de Panamá en mapas y paneles claros' },
  { slug: 'acerca', titulo: 'Acerca de Palante' },
  { slug: 'fuentes', titulo: 'Fuentes de datos y licencias' },
  { slug: 'privacidad', titulo: 'Privacidad: sin cuentas, sin cookies' },
  { slug: 'datos', titulo: 'Descarga los datos limpios' },
  { slug: 'sin-conexion', titulo: 'Palante sin conexión' },
  { slug: '404', titulo: 'Esta página no existe' },
];

/** Todas las imágenes del sitio. Los módulos añaden las suyas en sus propios registros. */
export async function paginasOg(): Promise<DatosOg[]> {
  const modulos = await Promise.all(
    Object.values(import.meta.glob<{ paginasOgModulo: () => Promise<DatosOg[]> }>('../modulos/*/og.ts', { eager: true }))
      .map((m) => m.paginasOgModulo()),
  );
  return [...PAGINAS_COMUNES, ...modulos.flat()];
}
