import { describe, expect, it } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import {
  agregar, clase, cortes, detalle, escribirFiltros, leerFiltros, leyenda, proporcion, SIN_FILTRO,
  textoCompartir, totalDistrito, usaTasa, type Resumen311,
} from '../../src/lib/m311';

const mini: Resumen311 = {
  version: 1,
  categorias: [{ id: 'ruido', nombre: 'Ruido y convivencia' }, { id: 'otros', nombre: 'Otros' }],
  estados: [{ id: 'resuelto', nombre: 'Resuelto', resuelto: true }, { id: 'en-proceso', nombre: 'En proceso', resuelto: false }],
  trimestres: [{ id: '2026-T1', nombre: 'enero a marzo de 2026' }, { id: '2026-T2', nombre: 'abril a junio de 2026' }],
  corregimientos: [
    { slug: 'a', nombre: 'Alfa', poblacion: null },
    { slug: 'b', nombre: 'Beta', poblacion: null },
    { slug: 'c', nombre: 'Gamma', poblacion: null },
  ],
  conteos: [
    [0, 0, 1, 0, 5],
    [0, 1, 1, 1, 3],
    [1, 0, 0, 1, 2],
  ],
  total: 10,
  dias_cierre_distrito: { mediana: 3, n: 5 },
  dias_cierre: {},
  minimo_casos_mediana: 5,
};

describe('agregados del 311', () => {
  it('suma sin filtros igual al total', () => {
    const f = agregar(mini, SIN_FILTRO);
    expect(f.map((x) => x.total)).toEqual([8, 2, 0]);
    expect(totalDistrito(f).total).toBe(mini.total);
    expect(f[0].resueltos).toBe(5);
  });
  it('filtra por categoría, estado y trimestre', () => {
    expect(agregar(mini, { ...SIN_FILTRO, categoria: 'ruido' }).map((x) => x.total)).toEqual([5, 2, 0]);
    expect(agregar(mini, { ...SIN_FILTRO, estado: 'en-proceso' }).map((x) => x.total)).toEqual([3, 2, 0]);
    expect(agregar(mini, { ...SIN_FILTRO, trimestre: '2026-T1' }).map((x) => x.total)).toEqual([0, 2, 0]);
  });
  it('usa conteos sin población y tasa con población', () => {
    expect(usaTasa(mini)).toBe(false);
    const conPob = { ...mini, corregimientos: mini.corregimientos.map((c) => ({ ...c, poblacion: 20000 })) };
    expect(usaTasa(conPob)).toBe(true);
    expect(agregar(conPob, SIN_FILTRO)[0].valor).toBe(4);
  });
  it('con menos de 10 casos no da porcentajes ni orden de categorías', () => {
    const d = detalle(mini, agregar(mini, SIN_FILTRO)[0]);
    expect(d.total).toBe(8);
    expect(d.suficiente).toBe(false);
    expect(d.principales).toEqual([]);
    expect(d.pocas.map((p) => [p.id, p.n])).toEqual([['ruido', 5], ['otros', 3]]);
    expect(d.porcentajeResuelto).toBeNull();
    expect(textoCompartir('Alfa', d, '1 de abril', '30 de junio de 2026')).toBe(
      'En Alfa hubo 8 reportes al 311 entre el 1 de abril y el 30 de junio de 2026. Míralo en Palante.',
    );
  });
  it('con 10 casos o más ordena solo las categorías con 10 casos o más', () => {
    const grande: Resumen311 = { ...mini, conteos: [[0, 0, 1, 0, 12], [0, 1, 1, 1, 4]], total: 16 };
    const d = detalle(grande, agregar(grande, SIN_FILTRO)[0]);
    expect(d.suficiente).toBe(true);
    expect(d.principales.map((p) => p.id)).toEqual(['ruido']);
    expect(d.pocas.map((p) => p.id)).toEqual(['otros']);
    expect(d.porcentajeResuelto).toBeCloseTo(12 / 16);
    expect(textoCompartir('Alfa', d, '1 de abril', '30 de junio de 2026')).toBe(
      'En Alfa hubo 12 reportes de ruido y convivencia al 311 entre el 1 de abril y el 30 de junio de 2026. Míralo en Palante.',
    );
  });
  it('cada porcentaje lleva su número de casos', () => {
    expect(proporcion(31, 50)).toBe('62 % (31 de 50 casos)');
    expect(proporcion(1, 10)).toBe('10 % (1 de 10 casos)');
    expect(proporcion(3, 9)).toBeNull();
    expect(proporcion(10, 1528, 1)).toBe('0,7 % (10 de 1.528 casos)');
  });
});

describe('filtros en la URL', () => {
  it('lee solo valores válidos', () => {
    expect(leerFiltros('?categoria=ruido&estado=nada&trimestre=2026-T2', mini)).toEqual({
      categoria: 'ruido', estado: '', trimestre: '2026-T2',
    });
  });
  it('escribe y vuelve a leer', () => {
    const f = { categoria: 'otros', estado: 'resuelto', trimestre: '' };
    expect(escribirFiltros(f)).toBe('?categoria=otros&estado=resuelto');
    expect(leerFiltros(escribirFiltros(f), mini)).toEqual(f);
    expect(escribirFiltros(SIN_FILTRO)).toBe('');
  });
});

describe('clases y leyenda', () => {
  it('reparte en hasta cinco clases y cero va aparte', () => {
    const c = cortes([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 50]);
    expect(c.length).toBeLessThanOrEqual(5);
    expect(c[c.length - 1]).toBe(50);
    expect(clase(0, c)).toBe(0);
    expect(clase(50, c)).toBe(5);
    expect(clase(1, c)).toBe(1);
  });
  it('con un solo valor usa el tono más oscuro', () => {
    const c = cortes([0, 7, 7]);
    expect(c).toEqual([7]);
    expect(clase(7, c)).toBe(5);
    expect(leyenda(c).map((p) => p.texto)).toEqual(['Sin reportes', '1 a 7']);
  });
  it('la leyenda escribe rangos con formato local', () => {
    const l = leyenda([2, 10, 1500]);
    expect(l.map((p) => p.texto)).toEqual(['Sin reportes', '1 a 2', '3 a 10', '11 a 1.500']);
  });
});

const ruta = new URL('../../public/data/311/resumen.json', import.meta.url);
describe.runIf(existsSync(ruta))('datos publicados del 311', () => {
  it('los totales de la interfaz coinciden con los del pipeline', () => {
    const r = JSON.parse(readFileSync(ruta, 'utf8')) as Resumen311;
    const meta = JSON.parse(readFileSync(new URL('../../public/data/311/meta.json', import.meta.url), 'utf8'));
    const filas = agregar(r, SIN_FILTRO);
    expect(totalDistrito(filas).total).toBe(r.total);
    expect(r.total).toBe(meta.filas_validas);
    for (const cat of r.categorias) {
      const porCat = agregar(r, { ...SIN_FILTRO, categoria: cat.id }).reduce((a, f) => a + f.total, 0);
      const esperado = r.conteos.filter((c) => r.categorias[c[1]].id === cat.id).reduce((a, c) => a + c[4], 0);
      expect(porCat).toBe(esperado);
    }
  });
});
