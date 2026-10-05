// Fechas de cada fuente, leídas de los meta.json que escribe el pipeline. Sin meta, no hay fecha.
interface Meta {
  fuentes?: { id: string; fecha_texto: string }[];
}

export async function fechasFuentes(): Promise<Record<string, string>> {
  const fechas: Record<string, string> = {};
  const metas = import.meta.glob<{ default: Meta }>('../../public/data/*/meta.json', { eager: true });
  for (const m of Object.values(metas)) {
    for (const f of m.default.fuentes ?? []) fechas[f.id] ??= f.fecha_texto;
  }
  return fechas;
}
