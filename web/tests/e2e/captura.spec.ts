import { test, expect, type BrowserContext, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { sinErroresAxe } from './ayuda';

// GPS simulado: un recorrido corto hacia el norte.
const recorrido = Array.from({ length: 14 }, (_, i) => ({ latitude: 8.98 + i * 0.0004, longitude: -79.56 + i * 0.0002 }));

async function preparar(context: BrowserContext, page: Page) {
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({ ...recorrido[0], accuracy: 8 });
  await page.clock.install();
}

async function avanzar(context: BrowserContext, page: Page, desde: number, hasta: number, accuracy = 8) {
  for (let i = desde; i < hasta; i++) {
    await context.setGeolocation({ ...recorrido[i], accuracy });
    await page.clock.runFor(5000);
  }
}

async function nuevaCaptura(page: Page) {
  await page.goto('/captura');
  await page.getByLabel('Código de voluntario').fill('UTP-07');
  await page.getByRole('button', { name: 'Nueva captura' }).click();
  await page.getByLabel('Nombre de la ruta, como la llama la gente').fill('Prueba Los Pueblos');
  await page.getByLabel('Operador o cooperativa').fill('Cooperativa de prueba');
  await page.getByLabel('Tarifa en dólares').fill('0,50');
  await page.getByLabel('Ida').check();
  await page.getByLabel('Sí', { exact: true }).check();
  await page.getByRole('button', { name: 'Empezar a grabar' }).click();
  await expect(page.getByRole('heading', { name: /Grabando/ })).toBeVisible();
}

test('la página de captura carga, es accesible y no aparece en el menú ni en el sitemap', async ({ page, request }) => {
  await page.goto('/captura');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex');
  await expect(page.getByRole('heading', { name: 'Cómo capturar una ruta' })).toBeVisible();
  await expect(page.getByText('Tu seguridad primero')).toBeVisible();
  await expect(page.locator('nav a[href="/captura"]')).toHaveCount(0);
  expect(await (await request.get('/sitemap.xml')).text()).not.toContain('/captura');
  await sinErroresAxe(page);
});

test('graba con GPS simulado, guarda sin conexión y descarga el archivo', async ({ context, page, browserName }) => {
  test.skip(browserName !== 'chromium', 'GPS simulado y reloj falso se prueban en Chromium');
  await page.addInitScript(() => {
    // Sin Web Share con archivos: se ofrece la descarga.
    Object.defineProperty(navigator, 'canShare', { value: undefined, configurable: true });
  });
  await preparar(context, page);
  await nuevaCaptura(page);
  await context.setOffline(true);

  await avanzar(context, page, 0, 4);
  const parada = page.getByRole('button', { name: 'Parada aquí' });
  expect((await parada.boundingBox())!.height).toBeGreaterThanOrEqual(64);
  await parada.click();
  await avanzar(context, page, 4, 8);
  await parada.click();

  // Precisión peor que 50 m: aviso visible.
  await avanzar(context, page, 8, 9, 80);
  await expect(page.getByText(/La precisión del GPS es de 80 m/)).toBeVisible();

  // Se recarga en mitad de la captura (por ejemplo, el navegador cerró la pestaña): sigue grabando.
  // La recarga sin red se prueba aparte con el service worker.
  await context.setOffline(false);
  await page.reload();
  await context.setOffline(true);
  await expect(page.getByRole('heading', { name: /Grabando/ })).toBeVisible();
  await expect(page.locator('.contadores')).toContainText('2 paradas');
  await avanzar(context, page, 9, 14);
  await parada.click();
  await page.getByRole('button', { name: 'Fin de ruta' }).click();

  // Revisar: traza en SVG, nombrar y borrar paradas.
  await expect(page.getByRole('heading', { name: 'Revisa la captura' })).toBeVisible();
  await expect(page.locator('svg.traza polyline')).toHaveCount(1);
  await page.getByLabel('Nombre de la parada 1').fill('Frente al súper');
  await page.getByLabel('Nombre de la parada 1').blur();
  await page.getByRole('button', { name: 'Borrar la parada 2' }).click();
  await expect(page.locator('.lista-paradas > li')).toHaveCount(2);
  await sinErroresAxe(page);

  await page.getByRole('button', { name: 'Listo, enviar' }).click();
  await expect(page.getByRole('button', { name: 'Enviar por WhatsApp' })).toHaveCount(0);
  const [descarga] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Descargar el archivo' }).click()]);
  expect(descarga.suggestedFilename()).toMatch(/^palante-ruta-prueba-los-pueblos-ida-\d{4}-\d{2}-\d{2}\.json$/);
  const datos = JSON.parse(readFileSync(await descarga.path(), 'utf8'));
  expect(datos).toMatchObject({
    version: 1, voluntario: 'UTP-07', ruta: 'Prueba Los Pueblos', operador: 'Cooperativa de prueba',
    tarifa_usd: 0.5, sentido: 'ida', permiso: 'si',
  });
  expect(datos.id).toBeUndefined();
  expect(datos.puntos.length).toBeGreaterThanOrEqual(10);
  expect(datos.paradas).toHaveLength(2);
  expect(datos.paradas[0].nombre).toBe('Frente al súper');
  for (const p of datos.puntos) expect(p.t).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/);

  // Sigue en el teléfono hasta confirmar el envío.
  await page.getByRole('button', { name: 'Ya lo envié, borrar del teléfono' }).click();
  await expect(page.getByText('Captura enviada y borrada del teléfono')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Capturas sin enviar' })).toHaveCount(0);
  await context.setOffline(false);
});

test('envía por WhatsApp con la Web Share API', async ({ context, page, browserName }) => {
  test.skip(browserName !== 'chromium', 'GPS simulado y reloj falso se prueban en Chromium');
  await page.addInitScript(() => {
    const w = window as unknown as { compartido?: string[] };
    Object.defineProperty(navigator, 'canShare', { value: () => true, configurable: true });
    Object.defineProperty(navigator, 'share', {
      value: async (d: { files: File[] }) => { w.compartido = d.files.map((f) => f.name); },
      configurable: true,
    });
  });
  await preparar(context, page);
  await nuevaCaptura(page);
  await avanzar(context, page, 0, 3);
  await page.getByRole('button', { name: 'Parada aquí' }).click();
  await avanzar(context, page, 3, 6);
  await page.getByRole('button', { name: 'Fin de ruta' }).click();
  await page.getByRole('button', { name: 'Listo, enviar' }).click();
  await page.getByRole('button', { name: 'Enviar por WhatsApp' }).click();
  await expect(page.getByText('Captura enviada y borrada del teléfono')).toBeVisible();
  const nombres = await page.evaluate(() => (window as unknown as { compartido?: string[] }).compartido);
  expect(nombres?.[0]).toMatch(/\.json$/);
});

test('la app de captura abre sin conexión después de la primera visita', async ({ context, page, browserName }) => {
  test.skip(browserName !== 'chromium', 'El modo sin red de Playwright con service worker solo es fiable en Chromium');
  await page.goto('/');
  await page.evaluate(async () => {
    await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await context.setOffline(true);
  await page.goto('/captura');
  await expect(page.getByRole('button', { name: 'Nueva captura' })).toBeVisible();
  await context.setOffline(false);
});
