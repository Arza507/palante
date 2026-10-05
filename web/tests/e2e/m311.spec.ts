import { test, expect } from '@playwright/test';
import { readFileSync, existsSync } from 'node:fs';
import { sinErroresAxe } from './ayuda';

const dist = process.env.DIST ?? 'dist';
const publico = dist === 'dist-fixtures' ? 'public-fixtures' : 'public';
const rutaResumen = `${publico}/data/311/resumen.json`;
const hay = existsSync(rutaResumen);
const resumen = hay ? JSON.parse(readFileSync(rutaResumen, 'utf8')) : null;
/** La isla está hidratada cuando aparecen los filtros. */
const hidratada = (page: import('@playwright/test').Page) =>
  expect(page.locator('form.filtros')).toHaveCSS('visibility', 'visible');
const fmt = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

test.describe('mapa del 311', () => {
  test.skip(!hay, 'Sin datos del 311');

  test('el total de la interfaz coincide con el del pipeline', async ({ page }) => {
    await page.goto('/311');
    await expect(page.locator('.estado-filtro')).toContainText(`${fmt(resumen.total)} reportes`);
    // Suma de la columna de la lista = total.
    const valores = await page.locator('tbody td.num:first-of-type').allTextContents();
    const suma = valores.reduce((a, v) => a + Number(v.replace(/\./g, '').replace(',', '.')), 0);
    expect(suma).toBe(resumen.total);
    await sinErroresAxe(page);
  });

  test('los filtros cambian la vista y viven en la URL', async ({ page }) => {
    await page.goto('/311');
    await hidratada(page);
    const cat = resumen.categorias.find((c: { id: string }) =>
      resumen.conteos.some((x: number[]) => resumen.categorias[x[1]].id === c.id));
    await page.getByLabel('Categoría').selectOption(cat.id);
    await expect(page).toHaveURL(new RegExp(`categoria=${cat.id}`));
    const idx = resumen.categorias.findIndex((c: { id: string }) => c.id === cat.id);
    const esperado = resumen.conteos.filter((x: number[]) => x[1] === idx).reduce((a: number, x: number[]) => a + x[4], 0);
    await expect(page.locator('.estado-filtro')).toContainText(`${fmt(esperado)} ${esperado === 1 ? 'reporte' : 'reportes'}`);
    // Abrir la URL con el filtro reproduce la misma vista.
    await page.goto(`/311?categoria=${cat.id}`);
    await expect(page.getByLabel('Categoría')).toHaveValue(cat.id);
    await expect(page.locator('.estado-filtro')).toContainText(fmt(esperado));
    await page.getByRole('button', { name: 'Quitar filtros' }).click();
    await expect(page).toHaveURL(/\/311$/);
  });

  test('tocar un corregimiento abre la hoja con enlace a la ficha', async ({ page }) => {
    await page.goto('/311');
    await hidratada(page);
    const slug = resumen.corregimientos[0].slug;
    await page.locator(`.mapa311 [data-slug="${slug}"]`).first().dispatchEvent('click');
    const hoja = page.getByRole('dialog');
    await expect(hoja).toBeVisible();
    await expect(hoja.getByRole('link', { name: /Ver la ficha/ })).toHaveAttribute('href', `/311/${slug}`);
    await page.keyboard.press('Escape');
    await expect(hoja).toBeHidden();
  });

  test('la lista se ordena', async ({ page }) => {
    await page.goto('/311');
    await hidratada(page);
    await page.getByRole('button', { name: 'Corregimiento' }).click();
    await expect(page.locator('th[aria-sort="ascending"]')).toContainText('Corregimiento');
    const nombres = await page.locator('tbody th a').allTextContents();
    expect(nombres).toEqual([...nombres].sort((a, b) => a.localeCompare(b, 'es')));
  });

  test('sin JavaScript se ve la vista por defecto', async ({ browser }) => {
    const ctx = await browser.newContext({ javaScriptEnabled: false });
    const page = await ctx.newPage();
    await page.goto('/311?categoria=ruido');
    await expect(page.locator('.estado-filtro')).toContainText(`${fmt(resumen.total)} reportes`);
    await expect(page.locator('form.filtros')).toBeHidden();
    await expect(page.locator('tbody tr')).toHaveCount(resumen.corregimientos.length);
    await ctx.close();
  });

  test('con ahorro de datos se muestra la lista y no el mapa', async ({ browser }) => {
    const ctx = await browser.newContext({ extraHTTPHeaders: { 'Save-Data': 'on' } });
    await ctx.addInitScript(() => {
      Object.defineProperty(navigator, 'connection', { value: { saveData: true }, configurable: true });
    });
    const page = await ctx.newPage();
    await page.goto('/311');
    await expect(page.locator('#mapa-311')).toBeHidden();
    await expect(page.locator('tbody tr').first()).toBeVisible();
    await ctx.close();
  });

  test('cada ficha tiene URL estable, imagen para compartir y botón de compartir', async ({ page, request }) => {
    for (const c of resumen.corregimientos.slice(0, 5)) {
      const r = await page.goto(`/311/${c.slug}`);
      expect(r?.status()).toBe(200);
      await expect(page.locator('h1')).toHaveText(c.nombre);
      const og = await page.locator('meta[property="og:image"]').getAttribute('content');
      const ruta = new URL(og ?? '').pathname;
      const img = await request.get(ruta);
      expect(img.status()).toBe(200);
      expect((await img.body()).length).toBeLessThanOrEqual(100 * 1024);
    }
    await sinErroresAxe(page);
  });

  test('compartir abre WhatsApp con texto real si no hay Web Share', async ({ page }) => {
    const c = resumen.corregimientos.find((x: { slug: string }) =>
      resumen.conteos.some((k: number[]) => resumen.corregimientos[k[0]].slug === x.slug));
    await page.goto(`/311/${c.slug}`);
    const enlace = page.getByRole('link', { name: 'Compartir' });
    const href = decodeURIComponent((await enlace.getAttribute('href')) ?? '');
    expect(href).toContain('https://wa.me/?text=');
    expect(href).toContain(`En ${c.nombre} hubo`);
    expect(href).toContain('Míralo en Palante.');
    expect(href).toContain(`/311/${c.slug}`);
  });

  test('la metodología advierte sobre el sesgo de reporte', async ({ page }) => {
    await page.goto('/311/metodologia');
    await expect(page.getByRole('heading', { name: 'Más reportes no siempre significa más problemas' })).toBeVisible();
    await sinErroresAxe(page);
  });

  test('ninguna descarga pública trae nombres ni descripciones', async ({ request }) => {
    const csv = await (await request.get('/data/311/311-limpio.csv')).text();
    const cabecera = csv.split('\n')[0].toLowerCase();
    expect(cabecera).not.toContain('nombre');
    expect(cabecera).not.toContain('detalle');
  });
});

test('sin conexión, el mapa del 311 abre con los datos guardados y su fecha', async ({ page, context, browserName }) => {
  test.skip(!hay || browserName !== 'chromium', 'Solo Chromium y con datos');
  const meta = JSON.parse(readFileSync(`${publico}/data/311/meta.json`, 'utf8'));
  await page.goto('/311');
  await page.evaluate(async () => {
    await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await context.setOffline(true);
  await page.goto('/311');
  await expect(page.locator('#aviso-sin-conexion')).toHaveText(`Sin conexión. Datos guardados del ${meta.fecha_datos_texto}.`);
  await expect(page.locator('tbody tr').first()).toBeVisible();
  await page.goto('/sin-conexion');
  await expect(page.locator('#guardados')).toContainText(`Mapa del 311: datos guardados del ${meta.fecha_datos_texto}`);
  await context.setOffline(false);
});
