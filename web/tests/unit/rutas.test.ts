import { describe, expect, it } from 'vitest';
import { archivo, codigoValido, isoLocal, leerTarifa, minutos, nombreArchivo, proyectar, punto, type Captura } from '../../src/lib/captura';
import { color, COLORES, nombreParada, porSector, tarifa, type PropsRuta } from '../../src/lib/rutas';

const base: Captura = {
  id: '1', estado: 'terminada', version: 1, voluntario: 'UTP-07', ruta: 'Los Pueblos  ', operador: 'Coop', tarifa_usd: 0.5,
  sentido: 'ida', permiso: 'si', inicio: '2028-01-10T07:02:11-05:00', fin: '2028-01-10T07:41:30-05:00',
  puntos: [], paradas: [{ t: '2028-01-10T07:05:02-05:00', lat: 9, lon: -79.5, nombre: '  Frente al súper ' }],
};

describe('captura', () => {
  it('escribe fechas con la zona horaria local', () => {
    expect(isoLocal(new Date(2028, 0, 10, 7, 2, 11))).toMatch(/^2028-01-10T07:02:11[+-]\d{2}:\d{2}$/);
  });
  it('convierte una posición del GPS en punto', () => {
    const p = punto({ coords: { latitude: 9.0123456789, longitude: -79.5, accuracy: 7.25 }, timestamp: Date.UTC(2028, 0, 10) });
    expect(p.lat).toBe(9.012346);
    expect(p.precision_m).toBe(7.3);
  });
  it('valida el código de voluntario y la tarifa', () => {
    expect(codigoValido('UTP-07')).toBe(true);
    expect(codigoValido('a')).toBe(false);
    expect(codigoValido('con espacio')).toBe(false);
    expect(leerTarifa('0,50')).toBe(0.5);
    expect(leerTarifa('')).toBeNull();
    expect(leerTarifa('mucho')).toBe('invalida');
  });
  it('el archivo sigue el formato del SPEC, sin datos internos', () => {
    const a = archivo(base) as unknown as Record<string, unknown>;
    expect(a.id).toBeUndefined();
    expect(a.estado).toBeUndefined();
    expect(Object.keys(a).sort()).toEqual(
      ['fin', 'inicio', 'operador', 'paradas', 'permiso', 'puntos', 'ruta', 'sentido', 'tarifa_usd', 'version', 'voluntario'],
    );
    expect((a.paradas as { nombre: string }[])[0].nombre).toBe('Frente al súper');
    expect(nombreArchivo({ ...base, ruta: 'Pacora–Tocumen Ñ' })).toBe('palante-ruta-pacora-tocumen-n-ida-2028-01-10.json');
    expect(minutos(base.inicio, base.fin)).toBe(39);
  });
  it('proyecta la traza dentro del cuadro', () => {
    const pts = [{ lat: 9, lon: -79.5 }, { lat: 9.01, lon: -79.49 }];
    const { a } = proyectar(pts, 320, 240);
    for (const p of pts) {
      const [x, y] = a(p);
      expect(x).toBeGreaterThanOrEqual(0); expect(x).toBeLessThanOrEqual(320);
      expect(y).toBeGreaterThanOrEqual(0); expect(y).toBeLessThanOrEqual(240);
    }
    expect(a(pts[0])[1]).toBeGreaterThan(a(pts[1])[1]); // el norte queda arriba
  });
});

describe('rutas', () => {
  const r = (ruta: string, sector: string): PropsRuta => ({
    id: ruta, ruta, sentido: 'ida', operador: '', tarifa_usd: null, sector, paradas: [], ultima_captura: '2026-09-14',
  });
  it('agrupa por sector con Sin sector al final y conserva el número', () => {
    const g = porSector([r('A', 'Sin sector'), r('B', 'Oeste'), r('C', 'Este')]);
    expect(g.map((x) => x.sector)).toEqual(['Este', 'Oeste', 'Sin sector']);
    expect(g[2].rutas[0].n).toBe(1);
  });
  it('formatea tarifa y nombres', () => {
    expect(tarifa(0.5)).toBe('0,50 dólares');
    expect(tarifa(null)).toBe('sin dato');
    expect(nombreParada(undefined, 'P001')).toBe('Parada P001 (sin nombre)');
    expect(color(COLORES.length)).toBe(COLORES[0]);
  });
});
