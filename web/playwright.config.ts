import { defineConfig, devices } from '@playwright/test';

// DIST=dist-fixtures prueba el build con datos de prueba; por defecto se prueba dist/.
const dist = process.env.DIST ?? 'dist';
const puerto = Number(process.env.PORT ?? 4321);

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: { baseURL: `http://localhost:${puerto}`, trace: 'retain-on-failure', locale: 'es-PA' },
  webServer: {
    command: `node scripts/servir.mjs ${dist} ${puerto}`,
    port: puerto,
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    { name: 'android', use: { ...devices['Pixel 5'] } },
    { name: 'iphone', use: { ...devices['iPhone SE'] } },
    { name: 'escritorio-chrome', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } } },
    { name: 'escritorio-firefox', use: { ...devices['Desktop Firefox'], viewport: { width: 1280, height: 800 } } },
    { name: 'escritorio-safari', use: { ...devices['Desktop Safari'], viewport: { width: 1280, height: 800 } } },
  ],
});
