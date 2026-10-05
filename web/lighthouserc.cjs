// Lighthouse CI con los presupuestos de SPEC.md, sección 3.
// Perfil móvil por defecto de Lighthouse: Slow 4G simulado y CPU 4 veces más lenta.
// LHCI_DIST permite apuntar a dist-fixtures en pruebas locales.
const dist = process.env.LHCI_DIST || './dist';
const paginas = (process.env.LHCI_PAGINAS || '/,/311,/empleo,/fuentes').split(',');
const puerto = process.env.LHCI_PUERTO || '4500';

module.exports = {
  ci: {
    collect: {
      // Mismo servidor que las pruebas e2e: imita a Cloudflare Pages (rutas limpias y gzip).
      startServerCommand: `node scripts/servir.mjs ${dist} ${puerto}`,
      startServerReadyPattern: 'Sirviendo',
      url: paginas.map((p) => `http://localhost:${puerto}${p}`),
      numberOfRuns: 3,
      settings: {
        formFactor: 'mobile',
        throttlingMethod: 'simulate',
        chromeFlags: '--no-sandbox --headless=new',
      },
    },
    assert: {
      assertions: {
        'categories:performance': ['error', { minScore: 0.9 }],
        'categories:accessibility': ['error', { minScore: 0.95 }],
        'categories:best-practices': ['error', { minScore: 0.95 }],
        'categories:seo': ['error', { minScore: 0.95 }],
        'largest-contentful-paint': ['error', { maxNumericValue: 2500 }],
        'cumulative-layout-shift': ['error', { maxNumericValue: 0.1 }],
        // INP no se mide en laboratorio; el bloqueo total es su mejor aproximación.
        'total-blocking-time': ['error', { maxNumericValue: 200 }],
        'total-byte-weight': ['error', { maxNumericValue: 300 * 1024 }],
      },
    },
    upload: { target: 'filesystem', outputDir: './.lighthouseci' },
  },
};
