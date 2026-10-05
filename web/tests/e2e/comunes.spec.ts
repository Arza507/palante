import { test, expect } from '@playwright/test';
import { sinErroresAxe } from './ayuda';

const PAGINAS_COMUNES = ['/', '/acerca', '/fuentes', '/privacidad', '/datos', '/sin-conexion', '/311', '/empleo'];

for (const ruta of PAGINAS_COMUNES) {
  test(`${ruta} carga, es accesible y tiene metadatos`, async ({ page }) => {
    const r = await page.goto(ruta);
    expect(r?.status()).toBe(200);
    await expect(page.locator('html')).toHaveAttribute('lang', 'es-PA');
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /^https?:\/\//);
    await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /.{20,}/);
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', /\/og\/.+\.png$/);
    await sinErroresAxe(page);
  });
}

test('los títulos y descripciones son únicos', async ({ page }) => {
  const titulos = new Set<string>();
  const descripciones = new Set<string>();
  for (const ruta of PAGINAS_COMUNES) {
    await page.goto(ruta);
    titulos.add(await page.title());
    descripciones.add((await page.locator('meta[name="description"]').getAttribute('content')) ?? '');
  }
  expect(titulos.size).toBe(PAGINAS_COMUNES.length);
  expect(descripciones.size).toBe(PAGINAS_COMUNES.length);
});

test('una ruta inexistente responde 404 con enlaces útiles', async ({ page }) => {
  const r = await page.goto('/no-existe');
  expect(r?.status()).toBe(404);
  await expect(page.getByRole('link', { name: 'Ir al inicio' })).toBeVisible();
  await sinErroresAxe(page);
});

test('la navegación lleva a cada sección y no muestra Rutas', async ({ page, isMobile }) => {
  await page.goto('/');
  const nav = page.getByRole('navigation', { name: isMobile ? 'Principal en móvil' : 'Principal', exact: true });
  await expect(nav.getByRole('link', { name: 'Rutas' })).toHaveCount(0);
  await nav.getByRole('link', { name: '311' }).click();
  await expect(page).toHaveURL(/\/311$/);
  await expect(nav.getByRole('link', { name: '311' })).toHaveAttribute('aria-current', 'page');
});

test('el interruptor de tema cambia y recuerda el modo oscuro', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/');
  const boton = page.getByRole('button', { name: 'Modo oscuro' });
  await expect(boton).toHaveAttribute('aria-pressed', 'false');
  await boton.click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'oscuro');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'oscuro');
  await expect(page.getByRole('button', { name: 'Modo oscuro' })).toHaveAttribute('aria-pressed', 'true');
  await sinErroresAxe(page);
});

test('las zonas táctiles de la navegación miden al menos 44 px', async ({ page }) => {
  await page.goto('/');
  for (const el of await page.locator('nav:visible a, button:visible').all()) {
    const caja = await el.boundingBox();
    expect(caja?.height ?? 0).toBeGreaterThanOrEqual(44);
    expect(caja?.width ?? 0).toBeGreaterThanOrEqual(44);
  }
});

test('el manifest permite instalar la app', async ({ request }) => {
  const m = await (await request.get('/manifest.webmanifest')).json();
  expect(m.name).toBe('Palante');
  expect(m.display).toBe('standalone');
  expect(m.theme_color).toBe('#B5452F');
  expect(m.background_color).toBe('#FBF6EE');
  const tam = m.icons.map((i: { sizes: string; purpose: string }) => `${i.sizes}-${i.purpose}`);
  expect(tam).toEqual(expect.arrayContaining(['192x192-any', '512x512-any', '192x192-maskable', '512x512-maskable']));
});

test('robots.txt y sitemap.xml existen', async ({ request }) => {
  expect(await (await request.get('/robots.txt')).text()).toContain('Sitemap:');
  expect(await (await request.get('/sitemap.xml')).text()).toContain('<urlset');
});

test('sin conexión, la app abre tras la primera visita', async ({ page, context, browserName }) => {
  test.skip(browserName !== 'chromium', 'El modo sin red de Playwright con service worker solo es fiable en Chromium');
  await page.goto('/');
  await page.evaluate(async () => {
    await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await context.setOffline(true);
  await page.goto('/');
  await expect(page.locator('h1')).toBeVisible();
  await expect(page.locator('#aviso-sin-conexion')).toBeVisible();
  await page.goto('/una-pagina-nunca-vista');
  await expect(page.locator('h1')).toHaveText('Estás sin conexión');
  await context.setOffline(false);
});
