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

## M1, mapa del 311

- **Límites con Overpass por caja y filtro espacial**: se toman los corregimientos (admin_level 8) cuyo punto interior cae en el distrito (relación 8415626); así no se depende de una lista de nombres. Varios servidores con reintentos porque Overpass suele estar ocupado.
- **Nombres de OpenStreetMap en la interfaz** ("Bethania"); los del 311 se unen con clave sin tildes y `config/alias_corregimientos.csv`.
- **Casos de corregimientos fuera del distrito se descartan** con su motivo en `meta.json` y se listan en REPORT.md.
- **Un caso, una categoría**: si tiene varios servicios se usa el primero que no sea genérico (`config/servicios_genericos.csv`), para que la suma de categorías sea igual al total.
- **Resueltos = Concluido o Finalizado** (`config/estados_311.csv`); Iker puede cambiarlo.
- **Días hasta el cierre con la fecha de "Último Cambio"** de los casos resueltos: el archivo no trae fecha de cierre.
- **Mediana solo con 5 casos resueltos o más**: con menos, el número engaña.
- **Casos repetidos entre archivos**: se queda la versión con el último cambio más reciente.
- **Sin población del INEC** (el sitio no respondió desde esta red): el mapa muestra conteos y una nota visible; el pipeline usa la población en cuanto exista `raw/poblacion/poblacion_corregimientos.csv`.
- **Cinco clases por cuantiles** de los corregimientos con reportes, con "sin reportes" aparte; si hay menos valores distintos, la clase más alta siempre es la más oscura.
- **Dos mapas: distrito completo y centro ampliado** (corregimientos de menos del 0,6 % del área): los urbanos no se ven a escala del distrito.
- **El mapa no recibe foco de teclado**; la lista ordenable es la vista equivalente y accesible, con enlace a cada ficha.
- **La isla recibe el resumen como props** (5 KB) en lugar de pedirlo con fetch: la vista por defecto sale en el HTML, funciona sin JavaScript y queda guardada sin conexión con la página.
- **Filtros con espacio reservado** antes de hidratar (CLS 0) y ocultos con `<noscript>` cuando no hay JavaScript.
- **Página sin conexión lee la fecha de las páginas guardadas** (atributo `data-fecha`), no de los JSON.
- **Fixtures del 311 en Excel versionado** (`fixtures/311/`), generado por `fixtures/generar_fixtures_311.py`.

## Ajustes al M1 (6 de octubre de 2026)

- **El pipeline busca en el portal todos los conjuntos «Detalle de Casos Reportados al 311» de la Alcaldía** (organización `municipio-de-panama`, cualquier año) con la API de CKAN: un conjunto nuevo de 2027 entra solo, sin tocar código.
- **No se suman los otros conjuntos del 311 de la Alcaldía** (por corregimiento, por tipo, por estado, por dirección, Gestión Ambiental, Obras, Permisos): son conteos mensuales de los mismos casos; sumarlos los contaría dos veces.
- **No se usan los conjuntos del 311 de la AIG** (2016 a 2024): son de otra institución, de todo el país, con licencia CC BY y sin corregimiento.
- **`meta.json` guarda las filas leídas y válidas por archivo y mes de creación**, y una prueba exige que sumen las filas totales.
- **Muestra mínima de 10 casos** (`MINIMO_MUESTRA` en `web/src/lib/m311.ts`) para porcentajes y posiciones en el orden de principales, igual que el umbral de 10 ofertas del módulo de empleo.
- **Cada porcentaje se escribe con su base**: «62 % (31 de 50 casos)».
- **Al ordenar la lista por resueltos, los corregimientos con muestra insuficiente van al final** en los dos sentidos: no tienen porcentaje que comparar.
- **Cada corregimiento del mapa es un `<a href>` a su ficha en el HTML**; la isla solo intercepta el clic principal sin teclas modificadoras para abrir la hoja.
- **Los SVG del mapa pasan de `role="img"` a `role="group"`** y cada enlace lleva `aria-label`: axe no admite enlaces dentro de una imagen y WebKit no toma el nombre del `<title>` del trazo.
- **Los enlaces del mapa siguen sin foco de teclado** (`tabindex="-1"`): la lista es la vista equivalente y evita más de 30 paradas de tabulador.
