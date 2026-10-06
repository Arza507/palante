import { test, expect } from '@playwright/test';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { sinErroresAxe } from './ayuda';

const dist = process.env.DIST ?? 'dist';
const publico = dist === 'dist-fixtures' ? 'public-fixtures' : 'public';
const carpeta = `${publico}/data/empleo`;
const leer = (f: string) => JSON.parse(readFileSync(`${carpeta}/${f}`, 'utf8'));
const resumen = existsSync(`${carpeta}/resumen.json`) ? leer('resumen.json') : null;
const hay = !!resumen && !resumen.total.insuficiente;
const fmt = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const sectoresPublicados = hay ? resumen.sectores.filter((s: { celda: { insuficiente: boolean } }) => !s.celda.insuficiente) : [];

test('las páginas de empleo cargan y son accesibles', async ({ page }) => {
  for (const ruta of ['/empleo', '/empleo/informe', '/empleo/metodologia']) {
    const r = await page.goto(ruta);
    expect(r?.status()).toBe(200);
    await expect(page.locator('h1')).toHaveCount(1);
    await sinErroresAxe(page);
  }
});

test.describe('observatorio sin datos', () => {
  test.skip(hay, 'Hay datos publicables');
  test('dice próximamente y no muestra números', async ({ page }) => {
    await page.goto('/empleo');
    await expect(page.getByText('Próximamente')).toBeVisible();
    await expect(page.locator('.cifra')).toHaveCount(0);
  });
});

test.describe('observatorio con datos', () => {
  test.skip(!hay, 'Sin datos de empleo publicables');

  test('el aviso de la muestra y los totales coinciden con el pipeline', async ({ page }) => {
    await page.goto('/empleo');
    const aviso = page.locator('.aviso-muestra');
    await expect(aviso).toContainText(`Muestra de ${fmt(resumen.total.ofertas)} ofertas`);
    await expect(aviso).toContainText('No representa todo el empleo de Panamá');
    await expect(page.locator('.cifra').first()).toContainText(fmt(resumen.total.ofertas));
    // Cada gráfico dice su base.
    for (const g of await page.locator('figure.grafico').all()) await expect(g).toContainText('Base:');
  });

  test('cada sector publicado tiene su página y los insuficientes no', async ({ page }) => {
    for (const s of sectoresPublicados) {
      const r = await page.goto(`/empleo/${s.id}`);
      expect(r?.status()).toBe(200);
      await expect(page.locator('h1')).toHaveText(s.nombre);
      await expect(page.locator('.cifra').first()).toContainText(fmt(s.celda.ofertas));
      await sinErroresAxe(page);
    }
    const insuf = resumen.sectores.find((s: { celda: { insuficiente: boolean } }) => s.celda.insuficiente);
    if (insuf) expect((await page.goto(`/empleo/${insuf.id}`))?.status()).toBe(404);
  });

  test('ningún archivo publicado trae celdas con menos de 10 ofertas', () => {
    const archivos = ['resumen.json', ...readdirSync(`${carpeta}/sectores`).map((f) => `sectores/${f}`)];
    const revisar = (x: unknown): void => {
      if (Array.isArray(x)) return x.forEach(revisar);
      if (x && typeof x === 'object') {
        const o = x as Record<string, unknown>;
        if ('insuficiente' in o) {
          if (o.insuficiente) expect(o.ofertas ?? null).toBeNull();
          else expect(o.ofertas as number).toBeGreaterThanOrEqual(10);
        }
        Object.values(o).forEach(revisar);
      }
    };
    for (const a of archivos) revisar(leer(a));
  });

  test('el informe se imprime en A4 sin cortar gráficos', async ({ page, browserName }) => {
    await page.goto('/empleo/informe');
    await page.emulateMedia({ media: 'print' });
    const graficos = page.locator('figure.grafico');
    expect(await graficos.count()).toBeGreaterThan(0);
    // Altura útil de A4 con márgenes de 16 mm: unos 999 px a 96 ppp.
    const util = ((297 - 32) / 25.4) * 96;
    for (const g of await graficos.all()) {
      await expect(g).toHaveCSS('break-inside', 'avoid');
      expect((await g.boundingBox())!.height).toBeLessThan(util);
    }
    await expect(page.locator('.nav-movil')).toBeHidden();
    if (browserName === 'chromium') {
      const pdf = await page.pdf({ format: 'A4' });
      expect(pdf.byteLength).toBeGreaterThan(1000);
    }
  });
});
