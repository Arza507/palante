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
type Page = import('@playwright/test').Page;

/** Primer enlace del mapa ampliado que recibe el toque en su centro (sin otro corregimiento encima). */
async function enlaceTocable(page: Page) {
  const enlaces = page.locator('#mapa-311 figure:nth-of-type(2) a');
  const n = await enlaces.count();
  for (let i = 0; i < n; i++) {
    const a = enlaces.nth(i);
    try {
      await a.locator('path').click({ trial: true, timeout: 500 });
      return { enlace: a, href: (await a.getAttribute('href')) ?? '' };
    } catch { /* otro corregimiento tapa el centro: probamos el siguiente */ }
  }
  throw new Error('Ningún corregimiento del mapa recibe el toque');
}

/** Casos por corregimiento sin filtros, desde el resumen del pipeline. */
const casosPorSlug = (): Map<string, number> => {
  const m = new Map<string, number>(resumen.corregimientos.map((c: { slug: string }) => [c.slug, 0]));
  for (const x of resumen.conteos) {
    const slug = resumen.corregimientos[x[0]].slug;
    m.set(slug, (m.get(slug) ?? 0) + x[4]);
  }
  return m;
};

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

  test('con la isla hidratada, tocar un corregimiento abre la hoja con enlace a la ficha', async ({ page }) => {
    await page.goto('/311');
    await hidratada(page);
    const { enlace, href } = await enlaceTocable(page);
    await enlace.locator('path').click();
    const hoja = page.getByRole('dialog');
    await expect(hoja).toBeVisible();
    await expect(page).toHaveURL(/\/311$/);
    await expect(hoja.getByRole('link', { name: /Ver la ficha/ })).toHaveAttribute('href', href);
    await page.keyboard.press('Escape');
    await expect(hoja).toBeHidden();
  });

  test('cada corregimiento del mapa y de la lista es un enlace a su ficha en el HTML', async ({ request }) => {
    const html = await (await request.get('/311')).text();
    for (const c of resumen.corregimientos) {
      // Distrito completo y lista; los del centro salen también en el mapa ampliado.
      const veces = html.split(`href="/311/${c.slug}"`).length - 1;
      expect(veces, c.slug).toBeGreaterThanOrEqual(2);
    }
  });

  test('sin JavaScript, tocar el mapa o la lista lleva a la ficha', async ({ browser, page: conJs }) => {
    // WebKit no comprueba qué elemento recibe el toque si la página no tiene JavaScript:
    // buscamos el corregimiento con JavaScript y tocamos el mismo punto sin él.
    await conJs.goto('/311');
    const { href } = await enlaceTocable(conJs);
    const ctx = await browser.newContext({ javaScriptEnabled: false });
    const page = await ctx.newPage();
    await page.goto('/311');
    await expect(page.locator('form.filtros')).toBeHidden();
    await page.locator(`#mapa-311 figure:nth-of-type(2) a[href="${href}"] path`).click({ force: true });
    await expect(page).toHaveURL(new RegExp(`${href}$`));
    await expect(page.locator('h1')).toBeVisible();
    await page.goto('/311');
    const fila = page.locator('tbody th a').first();
    const hrefLista = (await fila.getAttribute('href')) ?? '';
    await fila.click();
    await expect(page).toHaveURL(new RegExp(`${hrefLista}$`));
    await ctx.close();
  });

  test('un toque antes de hidratar la isla lleva a la ficha', async ({ page }) => {
    // Simula un teléfono lento: el código de la isla no llega.
    await page.route(/\/_astro\/.*\.js$/, (r) => r.abort());
    await page.goto('/311');
    const { enlace, href } = await enlaceTocable(page);
    await enlace.locator('path').click();
    await expect(page).toHaveURL(new RegExp(`${href}$`));
  });

  test('con menos de 10 casos no hay porcentaje: casos y muestra insuficiente', async ({ page }) => {
    await page.goto('/311');
    const casos = casosPorSlug();
    for (const fila of await page.locator('tbody tr').all()) {
      const href = (await fila.locator('th a').getAttribute('href')) ?? '';
      const n = casos.get(href.split('/').pop() ?? '') ?? 0;
      const resueltos = (await fila.locator('td').nth(1).textContent()) ?? '';
      if (n === 0) expect(resueltos).toBe('–');
      else if (n < 10) expect(resueltos).toBe('Muestra insuficiente');
      else expect(resueltos).toMatch(new RegExp(`^\\d+ % \\(\\d+ de ${fmt(n)} casos\\)$`));
      await expect(fila.locator('td').first()).toHaveText(fmt(n));
    }
    const pequeno = [...casos].find(([, n]) => n > 0 && n < 10);
    test.skip(!pequeno, 'Ningún corregimiento tiene entre 1 y 9 casos');
    await page.goto(`/311/${pequeno![0]}`);
    await expect(page.locator('main')).toContainText('Muestra insuficiente');
    await expect(page.locator('main')).toContainText(`${fmt(pequeno![1])} ${pequeno![1] === 1 ? 'caso' : 'casos'}`);
    await expect(page.locator('main')).not.toContainText('%');
  });

  test('en la ficha cada porcentaje lleva su número de casos', async ({ page }) => {
    const [slug] = [...casosPorSlug()].sort((a, b) => b[1] - a[1])[0];
    await page.goto(`/311/${slug}`);
    const textos = await page.locator('.cifras, .principales').allInnerTexts();
    const conPorcentaje = textos.join('\n').split('\n').filter((l) => l.includes('%'));
    expect(conPorcentaje.length).toBeGreaterThan(0);
    // Cada cifra con porcentaje y cada problema principal muestran "de N casos".
    for (const li of await page.locator('.cifras li, .principales li').all()) {
      const t = await li.innerText();
      if (t.includes('%')) expect(t, t).toMatch(/de [\d.]+ casos/);
    }
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
