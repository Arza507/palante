import { test, expect } from '@playwright/test';
import { existsSync, readFileSync } from 'node:fs';
import { sinErroresAxe } from './ayuda';

const dist = process.env.DIST ?? 'dist';
const publico = dist === 'dist-fixtures' ? 'public-fixtures' : 'public';
const conRutas = existsSync(`${dist}/rutas.html`);
const geo = existsSync(`${publico}/data/rutas/rutas.geojson`)
  ? JSON.parse(readFileSync(`${publico}/data/rutas/rutas.geojson`, 'utf8'))
  : null;

test('sin la bandera, /rutas no existe', async ({ page }) => {
  test.skip(conRutas, 'Build con PUBLIC_RUTAS=true');
  expect((await page.goto('/rutas'))?.status()).toBe(404);
  expect(await (await page.request.get('/sitemap.xml')).text()).not.toContain('/rutas');
});

test('el build de producción no trae rutas de prueba', () => {
  test.skip(dist !== 'dist', 'Solo aplica al build de producción');
  for (const f of ['rutas.geojson', 'paradas.geojson', 'meta.json']) {
    const p = `dist/data/rutas/${f}`;
    if (existsSync(p)) expect(readFileSync(p, 'utf8')).not.toContain('FIXTURE');
  }
});

test.describe('página de rutas', () => {
  test.skip(!conRutas || !geo, 'Build sin rutas');

  test('muestra cada ruta en el mapa y en la lista, con sus datos', async ({ page }) => {
    await page.goto('/rutas');
    const n = geo.features.length;
    await expect(page.locator('.mapa-rutas a')).toHaveCount(n);
    await expect(page.locator('.ficha-ruta')).toHaveCount(n);
    const primera = geo.features[0].properties;
    const ficha = page.locator(`#ruta-${primera.id}`);
    await expect(ficha).toContainText(primera.ruta);
    await expect(ficha).toContainText('Tarifa');
    await expect(ficha).toContainText('Última captura');
    await sinErroresAxe(page);
  });

  test('tocar una ruta del mapa lleva a su ficha', async ({ page }) => {
    await page.goto('/rutas');
    const id = geo.features[0].properties.id;
    await page.locator(`.mapa-rutas a[href="#ruta-${id}"]`).dispatchEvent('click');
    await expect(page).toHaveURL(new RegExp(`#ruta-${id}$`));
  });

  test('ofrece el GTFS y no publica rutas sin permiso', async ({ page, request }) => {
    await page.goto('/rutas');
    const gtfs = page.getByRole('link', { name: /GTFS/ });
    await expect(gtfs).toHaveAttribute('href', '/data/rutas/gtfs.zip');
    expect((await request.get('/data/rutas/gtfs.zip')).status()).toBe(200);
    // En los datos de prueba, la ruta "Dos" no tiene permiso.
    await expect(page.getByText('FIXTURE Dos')).toHaveCount(0);
  });

  test('con ahorro de datos no se cargan teselas y se ve la lista', async ({ browser }) => {
    const ctx = await browser.newContext({ extraHTTPHeaders: { 'Save-Data': 'on' } });
    await ctx.addInitScript(() => {
      Object.defineProperty(navigator, 'connection', { value: { saveData: true }, configurable: true });
    });
    const page = await ctx.newPage();
    const teselas: string[] = [];
    page.on('request', (r) => { if (/\.pmtiles|tile/.test(r.url())) teselas.push(r.url()); });
    await page.goto('/rutas');
    await expect(page.locator('.ficha-ruta').first()).toBeVisible();
    await expect(page.locator('.mapa-leaflet')).toHaveCount(0);
    expect(teselas).toEqual([]);
    await ctx.close();
  });
});
