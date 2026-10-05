// Formato de números y fechas: coma decimal y punto de miles (2,5 y 10.000).

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

/** Escribe un número con punto de miles y coma decimal. Agrupa también los de cuatro cifras. */
export function numero(n: number, decimales = 0): string {
  if (!Number.isFinite(n)) return '–';
  const signo = n < 0 ? '-' : '';
  const fijo = Math.abs(n).toFixed(decimales);
  const [ent, dec] = fijo.split('.');
  const conMiles = ent.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return signo + conMiles + (dec ? `,${dec}` : '');
}

/** Porcentaje a partir de una proporción entre 0 y 1. */
export function porcentaje(p: number, decimales = 0): string {
  if (!Number.isFinite(p)) return '–';
  return `${numero(p * 100, decimales)} %`;
}

/** Fecha ISO (AAAA-MM-DD) a texto: "5 de octubre de 2026". Sin zona horaria para evitar desfases. */
export function fecha(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  return `${Number(m[3])} de ${MESES[Number(m[2]) - 1]} de ${m[1]}`;
}

/** Fecha corta: "oct. 2026". */
export function mesAnio(iso: string): string {
  const m = /^(\d{4})-(\d{2})/.exec(iso);
  if (!m) return iso;
  return `${MESES[Number(m[2]) - 1]} de ${m[1]}`;
}

