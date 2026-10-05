// Descargas públicas de cada módulo. Cada módulo añade las suyas cuando tiene datos reales.
export interface Descarga {
  titulo: string;
  url: string;
  formato: string;
  tamano: string;
  descripcion: string;
  licencia: string;
  fecha: string;
  jsonLd: Record<string, unknown>;
}

export async function descargas(): Promise<Descarga[]> {
  const mods = import.meta.glob<{ descargasModulo: () => Promise<Descarga[]> }>('./*/descargas.ts', { eager: true });
  const listas = await Promise.all(Object.values(mods).map((m) => m.descargasModulo()));
  return listas.flat();
}
