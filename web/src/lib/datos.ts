// Lectura de las salidas del pipeline en el build. Con PALANTE_FIXTURES=1 lee public-fixtures/.
import { existsSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

const carpeta = () => resolve(process.cwd(), process.env.PALANTE_FIXTURES === '1' ? 'public-fixtures' : 'public', 'data');

export function leerDatos<T>(ruta: string): T | null {
  const p = resolve(carpeta(), ruta);
  if (!existsSync(p)) return null;
  return JSON.parse(readFileSync(p, 'utf8')) as T;
}

export function leerTexto(ruta: string): string | null {
  const p = resolve(carpeta(), ruta);
  return existsSync(p) ? readFileSync(p, 'utf8') : null;
}

export function tamanoArchivo(ruta: string): string {
  const p = resolve(carpeta(), ruta);
  if (!existsSync(p)) return '';
  const kb = statSync(p).size / 1024;
  return kb < 1024 ? `${Math.max(1, Math.round(kb))} KB` : `${(kb / 1024).toFixed(1).replace('.', ',')} MB`;
}
