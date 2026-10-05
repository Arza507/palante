import { RUTAS_ACTIVAS } from './sitio';

export interface EntradaNav {
  href: string;
  texto: string;
  icono: 'inicio' | '311' | 'empleo' | 'rutas';
}

export function entradasNav(rutasActivas = RUTAS_ACTIVAS): EntradaNav[] {
  const e: EntradaNav[] = [
    { href: '/', texto: 'Inicio', icono: 'inicio' },
    { href: '/311', texto: '311', icono: '311' },
    { href: '/empleo', texto: 'Empleo', icono: 'empleo' },
  ];
  if (rutasActivas) e.push({ href: '/rutas', texto: 'Rutas', icono: 'rutas' });
  return e;
}

/** Marca como activa la sección que contiene la ruta actual. */
export function esActiva(href: string, ruta: string): boolean {
  const limpia = ruta.replace(/\.html$/, '').replace(/\/$/, '') || '/';
  if (href === '/') return limpia === '/';
  return limpia === href || limpia.startsWith(`${href}/`);
}
