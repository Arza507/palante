# Decisiones técnicas

Cada decisión que no está en SPEC.md, con una línea de motivo.

## M0, base

- **Node 24 LTS portátil** en `%LOCALAPPDATA%\palante-tools\node`: la computadora no tenía Node y así no se toca el sistema.
- **Astro 7.3, Preact 10.29 y TypeScript 6**: versiones estables actuales; @astrojs/preact pide Preact 10 y @astrojs/check pide TypeScript 5 o 6.
- **Service worker con workbox-build (injectManifest) en una integración propia**, en lugar de @vite-pwa/astro: este solo admite Astro hasta la versión 5.
- **`compressHTML: true`**: Astro 7 cambió el valor por defecto a `'jsx'`, que borra espacios entre elementos en línea.
- **`build.format: 'file'` y `trailingSlash: 'never'`**: URL limpias sin barra final (`/acerca`), como las sirve Cloudflare Pages.
- **sitemap.xml propio** en la integración, en lugar de @astrojs/sitemap: el SPEC pide `sitemap.xml` y el plugin genera `sitemap-index.xml`.
- **Fraunces con `font-display: optional` y precarga**: evita saltos de diseño (CLS); en conexiones lentas la primera visita usa la serif del sistema.
- **Fraunces fijada en opsz 72, SOFT 0 y WONK 0**, con peso variable de 500 a 700: así cabe en 28,8 KB.
- **Instancia estática de Fraunces 600 en `web/src/og/`** solo para el build: satori no lee WOFF2 y no se sirve al teléfono.
- **Baranda como máscara CSS** y azulejo con fondo transparente: toman el color del tema en modo claro y oscuro.
- **Tokens de color con los nombres del SPEC también en modo oscuro**: `--cal` pasa a ser el fondo oscuro; una sola fuente de verdad para el script de contraste.
- **Tokens extra `--superficie`, `--linea`, `--sobre-acento`, `--sobre-ocre` y escala `--calor-1` a `--calor-5`**: tarjetas, bordes, texto sobre botones y mapa de calor; todos pasan AA.
- **Escala del mapa de calor en modo oscuro invertida** (de oscuro a claro): sobre fondo oscuro, más valor se ve más brillante.
- **Lint = `astro check` + script de textos + script de contraste** en la web y **ruff** en Python, sin ESLint: cubre tipos y reglas del proyecto sin otra dependencia.
- **INP se vigila con Total Blocking Time ≤ 200 ms en Lighthouse CI**: INP no se puede medir en laboratorio.
- **Servidor de pruebas propio (`scripts/servir.mjs`)** que imita a Cloudflare Pages (rutas limpias, gzip y 404): Playwright y Lighthouse CI miden lo mismo que verá el usuario.
- **Presupuestos de JS medidos en el build (`check-presupuestos.mjs`)** además de Lighthouse: cuenta gzip real por página y sigue los imports de cada isla.
- **Páginas con mapa de calles se marcan con `<meta name="palante:mapa-calles">`** para aplicarles el límite de 150 KB.
- **Registro del service worker 1,5 s después de `load`**: la precarga no compite con la primera pintura.
- **Builds con datos de prueba en `dist-fixtures/` desde `public-fixtures/`**: nunca se mezclan con `public/` y la guardia FIXTURE sigue activa en producción.
- **Datos crudos fuera de git**: se descargan de la fuente oficial con el pipeline; en git solo van las salidas limpias.
- **Contacto en /acerca por variable `PUBLIC_CONTACTO_EMAIL`**: no se inventa un correo; mientras falte, se enlaza a los temas de GitHub.
- **Analítica por variable `PUBLIC_CF_BEACON_TOKEN`**: sin token no se carga ningún script externo.
- **ruff con líneas de 110 caracteres**: los textos de ayuda en español son largos.
