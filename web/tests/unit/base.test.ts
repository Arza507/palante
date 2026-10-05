import { describe, expect, it } from 'vitest';
import { readFileSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { numero, porcentaje, fecha } from '../../src/lib/formato';
import { entradasNav, esActiva } from '../../src/lib/nav';
import { slugOg } from '../../src/lib/og';
import { enlaceWhatsApp } from '../../src/lib/compartir';
import { revisarTexto } from '../../scripts/check-textos.mjs';
import { contraste } from '../../scripts/check-contraste.mjs';
import { buscarFixtures } from '../../integraciones/palante.mjs';

describe('formato de números', () => {
  it('usa punto de miles y coma decimal', () => {
    expect(numero(10000)).toBe('10.000');
    expect(numero(1000)).toBe('1.000');
    expect(numero(999)).toBe('999');
    expect(numero(2.5, 1)).toBe('2,5');
    expect(numero(1234567.891, 2)).toBe('1.234.567,89');
    expect(numero(-1500)).toBe('-1.500');
    expect(numero(Number.NaN)).toBe('–');
  });
  it('formatea porcentajes', () => {
    expect(porcentaje(0.425, 1)).toBe('42,5 %');
    expect(porcentaje(1)).toBe('100 %');
  });
  it('escribe fechas en español sin desfase de zona horaria', () => {
    expect(fecha('2026-10-05')).toBe('5 de octubre de 2026');
    expect(fecha('2026-01-01T00:00:00Z')).toBe('1 de enero de 2026');
  });
});

describe('navegación', () => {
  it('oculta Rutas mientras la bandera está apagada', () => {
    expect(entradasNav(false).map((e) => e.texto)).toEqual(['Inicio', '311', 'Empleo']);
    expect(entradasNav(true).map((e) => e.texto)).toContain('Rutas');
  });
  it('marca la sección activa', () => {
    expect(esActiva('/', '/')).toBe(true);
    expect(esActiva('/', '/311')).toBe(false);
    expect(esActiva('/311', '/311/bella-vista')).toBe(true);
    expect(esActiva('/311', '/311.html')).toBe(true);
  });
});

describe('compartir e imágenes', () => {
  it('genera el nombre de la imagen para compartir', () => {
    expect(slugOg('/')).toBe('inicio');
    expect(slugOg('/index')).toBe('inicio');
    expect(slugOg('/311/bella-vista')).toBe('311/bella-vista');
    expect(slugOg('/acerca.html')).toBe('acerca');
  });
  it('arma el enlace de WhatsApp', () => {
    expect(enlaceWhatsApp('Hola Panamá', 'https://x.pa/311')).toBe(
      'https://wa.me/?text=Hola%20Panam%C3%A1%20https%3A%2F%2Fx.pa%2F311',
    );
  });
});

describe('reglas de textos', () => {
  it('acepta un texto correcto', () => {
    expect(revisarTexto('<h1>Mapa del 311</h1>\n<p>Reportes por corregimiento.</p>')).toEqual([]);
  });
  it('detecta emojis, frases prohibidas y exclamaciones en títulos', () => {
    const motivos = (t: string) => revisarTexto(t).map((p: { motivo: string }) => p.motivo).join(' | ');
    expect(motivos('<p>Hola 🚌</p>')).toContain('emoji');
    expect(motivos('<p>Descubre tu barrio</p>')).toContain('frase prohibida');
    expect(motivos('<p>Datos de vanguardia</p>')).toContain('frase prohibida');
    expect(motivos('<h2>Listo!</h2>')).toContain('título');
    expect(motivos('<p>¡Hola</p>')).toContain('¡');
    expect(motivos("titulo: 'Nuevo!'")).toContain('título');
  });
  it('no confunde operadores de código con exclamaciones', () => {
    expect(revisarTexto("const titulo = a !== b ? 'x' : 'y';")).toEqual([]);
  });
});

describe('contraste y motivos', () => {
  it('calcula el contraste WCAG', () => {
    expect(contraste('#000000', '#FFFFFF')).toBeCloseTo(21, 0);
    expect(contraste('#777777', '#777777')).toBeCloseTo(1, 5);
  });
  it('respeta los pesos máximos de los motivos SVG', () => {
    const tam = (p: string) => readFileSync(new URL(p, import.meta.url)).length;
    expect(tam('../../src/assets/fachadas.svg')).toBeLessThanOrEqual(4096);
    expect(tam('../../public/img/azulejo.svg')).toBeLessThanOrEqual(1536);
    expect(tam('../../public/img/baranda.svg')).toBeLessThanOrEqual(1024);
  });
  it('la fila de fachadas es decorativa', () => {
    const svg = readFileSync(new URL('../../src/assets/fachadas.svg', import.meta.url), 'utf8');
    expect(svg).toContain('aria-hidden="true"');
  });
});

describe('guardia de datos de prueba', () => {
  it('encuentra la marca FIXTURE en la salida', () => {
    const dir = mkdtempSync(join(tmpdir(), 'palante-'));
    writeFileSync(join(dir, 'ok.json'), '{"a":1}');
    writeFileSync(join(dir, 'malo.json'), '{"_marca":"FIXTURE"}');
    expect(buscarFixtures(dir)).toEqual(['malo.json']);
  });
});
