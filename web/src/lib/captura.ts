// Lógica de la app de captura de rutas: formato del archivo (SPEC.md, sección 8) y guardado en IndexedDB.

export const INTERVALO_MS = 5000;
export const PRECISION_MAX_M = 50;

export type Sentido = 'ida' | 'vuelta';
export type Permiso = 'si' | 'no' | 'no-se';

export interface Punto { t: string; lat: number; lon: number; precision_m: number }
export interface Parada { t: string; lat: number; lon: number; nombre: string }

/** Archivo de captura, tal como lo lee el pipeline. */
export interface ArchivoCaptura {
  version: 1;
  voluntario: string;
  ruta: string;
  operador: string;
  tarifa_usd: number | null;
  sentido: Sentido;
  permiso: Permiso;
  inicio: string;
  fin: string;
  puntos: Punto[];
  paradas: Parada[];
}

/** Captura guardada en el teléfono: el archivo más su estado. */
export interface Captura extends ArchivoCaptura {
  id: string;
  estado: 'grabando' | 'terminada' | 'enviada';
}

/** Fecha ISO con la zona horaria local: 2028-01-10T07:02:11-05:00. */
export function isoLocal(d: Date): string {
  const z = -d.getTimezoneOffset();
  const s = z >= 0 ? '+' : '-';
  const p = (n: number) => String(Math.floor(Math.abs(n))).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}${s}${p(z / 60)}:${p(z % 60)}`;
}

const redondear = (n: number, d = 6) => Math.round(n * 10 ** d) / 10 ** d;

export function punto(pos: { coords: { latitude: number; longitude: number; accuracy: number }; timestamp: number }): Punto {
  return {
    t: isoLocal(new Date(pos.timestamp)),
    lat: redondear(pos.coords.latitude),
    lon: redondear(pos.coords.longitude),
    precision_m: Math.round(pos.coords.accuracy * 10) / 10,
  };
}

/** Código de voluntario: letras, números y guion, de 2 a 20 caracteres (por ejemplo UTP-07). */
export function codigoValido(c: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9-]{1,19}$/.test(c.trim());
}

/** Tarifa escrita con coma o punto: "0,50" -> 0.5. Vacía -> null. */
export function leerTarifa(t: string): number | null | 'invalida' {
  const s = t.trim().replace(',', '.');
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 && n <= 20 ? Math.round(n * 100) / 100 : 'invalida';
}

/** Archivo para enviar: sin el id ni el estado internos. */
export function archivo(c: Captura): ArchivoCaptura {
  const { id: _id, estado: _estado, ...resto } = c;
  return { ...resto, paradas: resto.paradas.map((p) => ({ ...p, nombre: p.nombre.trim() })) };
}

export function nombreArchivo(c: Captura): string {
  const slug = c.ruta.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `palante-ruta-${slug || 'sin-nombre'}-${c.sentido}-${c.inicio.slice(0, 10)}.json`;
}

/** Minutos enteros entre dos fechas ISO. */
export function minutos(inicio: string, fin: string): number {
  return Math.max(0, Math.floor((Date.parse(fin) - Date.parse(inicio)) / 60000));
}

/** Puntos de la traza proyectados a un cuadro de ancho x alto, para el SVG de revisión. */
export function proyectar(puntos: { lat: number; lon: number }[], ancho: number, alto: number, margen = 12) {
  if (!puntos.length) return { a: (_p: { lat: number; lon: number }) => [0, 0] as [number, number] };
  const lats = puntos.map((p) => p.lat);
  const lons = puntos.map((p) => p.lon);
  const k = Math.cos((((Math.min(...lats) + Math.max(...lats)) / 2) * Math.PI) / 180);
  const x0 = Math.min(...lons) * k, x1 = Math.max(...lons) * k;
  const y0 = Math.min(...lats), y1 = Math.max(...lats);
  const escala = Math.min((ancho - 2 * margen) / (x1 - x0 || 1e-9), (alto - 2 * margen) / (y1 - y0 || 1e-9));
  const dx = (ancho - (x1 - x0) * escala) / 2, dy = (alto - (y1 - y0) * escala) / 2;
  return {
    a: (p: { lat: number; lon: number }): [number, number] => [
      Math.round((dx + (p.lon * k - x0) * escala) * 10) / 10,
      Math.round((alto - dy - (p.lat - y0) * escala) * 10) / 10,
    ],
  };
}

// ---- IndexedDB: una tienda de capturas y una de ajustes ----

const BD = 'palante-captura';
const CAPTURAS = 'capturas';
const AJUSTES = 'ajustes';

function abrir(): Promise<IDBDatabase> {
  return new Promise((ok, mal) => {
    const r = indexedDB.open(BD, 1);
    r.onupgradeneeded = () => {
      r.result.createObjectStore(CAPTURAS, { keyPath: 'id' });
      r.result.createObjectStore(AJUSTES);
    };
    r.onsuccess = () => ok(r.result);
    r.onerror = () => mal(r.error);
  });
}

async function tx<T>(tienda: string, modo: IDBTransactionMode, f: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  const db = await abrir();
  return new Promise<T>((ok, mal) => {
    const t = db.transaction(tienda, modo);
    const r = f(t.objectStore(tienda));
    t.oncomplete = () => { db.close(); ok(r.result as T); };
    t.onerror = () => { db.close(); mal(t.error); };
  });
}

export const guardar = (c: Captura) => tx<IDBValidKey>(CAPTURAS, 'readwrite', (s) => s.put(c));
export const borrar = (id: string) => tx<undefined>(CAPTURAS, 'readwrite', (s) => s.delete(id));
export const todas = async () =>
  (await tx<Captura[]>(CAPTURAS, 'readonly', (s) => s.getAll())).sort((a, b) => b.inicio.localeCompare(a.inicio));
export const leerAjuste = (k: string) => tx<string | undefined>(AJUSTES, 'readonly', (s) => s.get(k));
export const guardarAjuste = (k: string, v: string) => tx<IDBValidKey>(AJUSTES, 'readwrite', (s) => s.put(v, k));
