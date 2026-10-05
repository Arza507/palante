// Fechas de cada fuente, leídas de los meta.json que escribe el pipeline. Sin meta, no hay fecha.
import { leerDatos } from '../lib/datos';

interface Meta {
  fuentes?: { id: string; fecha_texto: string }[];
}

const MODULOS = ['311', 'empleo', 'rutas'];

export async function fechasFuentes(): Promise<Record<string, string>> {
  const fechas: Record<string, string> = {};
  for (const m of MODULOS) {
    for (const f of leerDatos<Meta>(`${m}/meta.json`)?.fuentes ?? []) {
      fechas[f.id] = fechas[f.id] ? `${fechas[f.id]}; ${f.fecha_texto}` : f.fecha_texto;
    }
  }
  return fechas;
}
