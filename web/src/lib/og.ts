/** Nombre del archivo de la imagen para compartir de una ruta: "/" -> "inicio", "/311/x" -> "311/x". */
export function slugOg(ruta: string): string {
  const limpia = ruta.replace(/\.html$/, '').replace(/^\/+|\/+$/g, '');
  if (limpia === '' || limpia === 'index') return 'inicio';
  return limpia;
}
