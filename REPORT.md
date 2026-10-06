# REPORT de Palante

Informe del agente. Se completa al final de cada hito.

## M1, mapa del 311

### Corregimientos sin polígono

Estos nombres del 311 no son corregimientos del distrito de Panamá (son de San Miguelito).
Sus casos se dejan fuera del mapa y se cuentan como descartados en `meta.json`:

- JOSÉ DOMINGO ESPINAR (1 caso)
- AMELIA DENIS DE ICAZA (1 caso)

### Ajustes al M1 (6 de octubre de 2026)

#### 1. Otros conjuntos del 311

Busqué en el Portal de Datos Abiertos, con su API, todos los conjuntos del 311 de la Alcaldía de Panamá
(organización `municipio-de-panama`, 131 conjuntos) y también los del 311 de otras instituciones.

**Solo hay un conjunto con el detalle de cada caso:** «Detalle de Casos Reportados al 311 - 2026»,
con un solo archivo (abril a junio de 2026). No hay otros trimestres ni otros años con detalle por caso.
El pipeline ahora busca estos conjuntos por su nombre en cualquier año y los suma solo: cuando la Alcaldía
publique otro trimestre o 2027, entra en la próxima corrida (`uv run python -m palante_pipeline 311 --descargar`).

Filas por periodo (mes de creación del caso) en el archivo
`311-junio-mayo-abril-2026-detalles-de-casos.xlsx`:

| Periodo | Filas leídas | Filas válidas |
| --- | --- | --- |
| Abril de 2026 | 113 | 113 |
| Mayo de 2026 | 204 | 202 |
| Junio de 2026 | 213 | 213 |
| **Total, abril a junio de 2026 (2026-T2)** | **530** | **528** |

Las 2 filas descartadas de mayo son los casos de San Miguelito de la lista de arriba.

Otros conjuntos del 311 que encontré y **no sumé**, con el motivo:

| Conjunto | Periodo | Qué trae | Motivo |
| --- | --- | --- | --- |
| Alcaldía: Reportes 311 por Corregimiento - 2026 | abril a junio 2026 | Conteos por mes y corregimiento: 113, 204 y 213 | Son los mismos 530 casos del detalle (coinciden mes a mes); sumarlos los contaría dos veces |
| Alcaldía: Reportes 311 por Tipo, Estado, Ingresados por Dirección y Otras Direcciones - 2026 | abril a junio 2026 | Conteos por mes | Mismos casos del detalle |
| Alcaldía: Reportes 311 - Gestión Ambiental, Obras y Construcciones, Permisos y Cumplimiento - 2026 | abril a agosto 2026 | Conteos por mes y tipo de reporte; julio: 25, 15 y 55; agosto: 22, 12 y 68 | Julio y agosto no tienen detalle por caso ni corregimiento, y solo cubren tres direcciones: no se pueden poner en el mapa |
| Alcaldía: Centro de llamadas (2019 a 2022 y 2026) | varios | Número de llamadas | No son casos |
| AIG: 311 y Centro de Atención Ciudadana (2016 a 2024) | mensual | Casos de todo el país | Otra institución, licencia CC BY, sin corregimiento |

**Decisión para Iker:** si quieres mostrar julio y agosto de 2026 como conteos del distrito (sin mapa),
o pedir a la Alcaldía que publique el detalle de esos meses, dímelo. Pedírselo es contactar a una
institución (sección 12), así que no lo hice.

#### 2. Muestras pequeñas

- Con menos de 10 casos, un corregimiento o una categoría no lleva porcentaje ni posición en el orden de
  principales: se ve el número de casos y «muestra insuficiente». Aplica en la lista, la hoja inferior,
  la ficha y la imagen para compartir (que ya no nombra «el principal» si no llega a 10).
- Cada porcentaje lleva su base: «62 % (31 de 50 casos)».
- Con los datos actuales, 9 de los 26 corregimientos tienen entre 1 y 9 casos.
- La regla está explicada en `/311/metodologia`.

#### 3. Enlaces que funcionan antes de hidratar

- Cada corregimiento del mapa (los dos SVG) y de la lista es un `<a href="/311/...">` en el HTML.
- La isla solo cambia el toque en el mapa por la hoja inferior cuando ya está hidratada.
- Pruebas nuevas en `web/tests/e2e/m311.spec.ts`: el HTML trae los enlaces; con JavaScript desactivado,
  tocar el mapa y la lista lleva a la ficha; con el código de la isla bloqueado (teléfono lento), tocar
  el mapa lleva a la ficha; con la isla hidratada, se abre la hoja y la URL no cambia.

#### Verificación

ruff y pytest (25 pruebas), `npm run lint`, Vitest (26), build y build con datos de prueba con
presupuestos cumplidos, Playwright con axe en los cinco perfiles sobre los dos builds (154 pasan,
6 omitidas: la prueba sin conexión solo corre en Chromium) y Lighthouse CI en los dos builds.

#### Pendiente

- Nada bloqueado. La población por corregimiento del INEC sigue pendiente, como en el M1.

## M2, observatorio de empleo

### Hecho

- Pipeline `uv run python -m palante_pipeline empleo [--probar | --extraer]`: valida `ofertas.csv` con pydantic,
  rechaza filas sin texto, quita duplicados, extrae con `claude-haiku-4-5` (temperatura 0, salida validada),
  guarda cada respuesta en caché, normaliza con `config/sinonimos_habilidades.csv` y ESCO, y agrega por sector,
  provincia y mes. Ninguna celda con menos de 10 ofertas lleva números.
- `--probar` estima el costo sin llamar a la API. Con los textos de prueba: unos 1.090 tokens de entrada por
  oferta, **unos 2,84 USD por cada 1.000 ofertas** (máximo 6,21 USD si cada respuesta llegara al tope).
  Ofertas reales más largas costarán algo más; `--probar` lo calcula con tus filas.
- `--extraer` exige `ANTHROPIC_API_KEY` y `MAX_USD_EMPLEO` en `.env` y se detiene antes de pasarse del tope.
  **No se llamó a la API**: no hay clave.
- Plantilla `pipeline/data/raw/empleo/ofertas-plantilla.csv`, guía `docs/como-recoger-ofertas.md`,
  `config/sectores.csv` y `config/provincias.csv`.
- Páginas `/empleo`, `/empleo/[sector]`, `/empleo/informe` (A4, probado: 10 páginas sin gráficos cortados)
  y `/empleo/metodologia`. Sin datos reales dicen «Próximamente». Aviso fijo con tamaño y fechas de la muestra.
- Pruebas: 20 ofertas de prueba con su extracción esperada (`fixtures/empleo/`), estimación, caché, tope,
  plantilla vacía, celdas menores de 10 y una prueba que falla si aparece un scraper o un portal privado.

### Verificación

ruff y pytest (41), `npm run lint`, Vitest (31), build y build con datos de prueba con presupuestos cumplidos,
Playwright con axe en los cinco perfiles sobre los dos builds (164 y 179 pasan; las omitidas dependen de si hay
datos) y Lighthouse CI en los dos builds (también `/empleo/tecnologia` y `/empleo/informe` con datos de prueba).

### Pendiente (depende de Iker)

- **Clave de API de Anthropic** en `.env`, con límite de gasto en la consola. Luego: `--probar`, revisar el costo
  y `--extraer`.
- **Ofertas reales** en `pipeline/data/raw/empleo/ofertas.csv`, según `docs/como-recoger-ofertas.md`.
- **ESCO**: la descarga oficial pide un correo (https://esco.ec.europa.eu/es/use-esco/download). Instrucciones en
  `pipeline/data/raw/empleo/esco/LEEME.md`. La página de licencia de ESCO que citaba `/fuentes` ya no existe
  (404); ahora enlaza la Decisión 2011/833/UE. Conviene confirmar los términos al descargar.
- **Encuesta de Mercado Laboral del INEC**: inec.gob.pa no respondió desde esta red y el portal de datos
  abiertos no tiene esas tablas. Sin ese dato el aviso no da la cifra de informalidad («casi la mitad» del SPEC
  no se escribe sin fuente). Formato para añadirla en `pipeline/data/raw/empleo/inec/LEEME.md`.

## M3, rutas

### Hecho

- App de captura en `/captura` (fuera del menú y del sitemap, `noindex`): instrucciones en cinco pasos, código
  de voluntario, aviso de seguridad, aviso para iPhone, formulario, grabación con GPS cada 5 s en alta
  precisión, botón «Parada aquí» de 96 px, contador de paradas y minutos, pantalla encendida (Wake Lock),
  aviso si la precisión pasa de 50 m, revisión con traza en SVG, nombrar y borrar paradas, envío con Web
  Share API o descarga. Todo queda en IndexedDB y funciona sin conexión; si se cierra la pestaña, sigue grabando.
- Pipeline `uv run python -m palante_pipeline rutas`: valida el esquema, descarta puntos con precisión peor
  que 50 m y saltos de más de 120 km/h, simplifica a 10 m, fusiona paradas a menos de 30 m, elige la traza más
  completa y genera `rutas.geojson`, `paradas.geojson`, `gtfs.zip` y `meta.json`. Solo rutas con permiso «si».
- `/rutas` detrás de `PUBLIC_RUTAS` (apagada): mapa SVG sobre fondo liso, con número en cada ruta, lista por
  sector con operador, tarifa, paradas y fecha de la última captura, y descarga del GTFS. Con
  `PUBLIC_PMTILES_URL`, mapa de calles con Leaflet y protomaps-leaflet (91 KB gzip; con ahorro de datos no
  se carga).
- Guía `docs/guia-voluntarios.md`. Horarios de cada ruta en `pipeline/config/rutas.csv` (vacío).

### Verificación

ruff y pytest (53), lint, Vitest (38), los dos builds con presupuestos cumplidos, Playwright con axe en los
cinco perfiles sobre los dos builds (184 y 210 pasan; la captura con GPS simulado y reloj falso corre en
Chromium) y Lighthouse CI en `/rutas` y `/captura`.
Una prueba de la captura fallaba a veces: cortaba la red antes de que la isla cargara tras recargar. Corregida
en M4 (20 repeticiones seguidas en verde).

### Pendiente

- **Validador GTFS oficial**: necesita Java, que no está en esta computadora. Lo añadí al CI (trabajo
  «Validador GTFS de MobilityData», versión 8.0.1). Localmente el feed pasa la validación interna con 0 errores.
- **Prueba manual en Android (Iker)**: grabar 30 minutos sin conexión en un Android real, enviar por WhatsApp
  y anotar aquí el resultado. No se puede hacer desde esta computadora.
- **Rutas reales**: no hay capturas. `/rutas` sigue oculta y `web/public/data/rutas/` vacío.
- **Bucket R2 con el PMTiles de Panamá** (Iker, cuenta de Cloudflare): sin él, el mapa usa el fondo liso.
- **Horarios y sectores** de cada ruta en `pipeline/config/rutas.csv`, confirmados con las cooperativas.

## M4, cierre

### Hecho

- Pruebas de la sección 10 en CI: pytest, Vitest, Playwright con axe-core en cinco perfiles (Pixel 5, iPhone SE
  con WebKit, Chrome, Firefox y Safari de escritorio a 1.280 px), sin conexión, ahorro de datos (`Save-Data`),
  Lighthouse CI móvil con los presupuestos, validador GTFS de MobilityData (0 errores, 0 avisos tras añadir
  `feed_contact_url`), contraste, reglas de textos y guardia FIXTURE.
- `docs/textos-para-revisar.md`: cada texto visible, página por página, más los textos de las islas. Se regenera
  con `npm run build:fixtures && node scripts/extraer-textos.mjs`.
- Cloudflare Pages listo sin publicar: `web/wrangler.toml`, `web/public/_headers` (también `noindex` en
  `/captura`), flujo manual `deploy.yml` (vista previa por defecto) y pasos en `docs/publicar.md`.
- `README.md` en español con los comandos exactos.
- Revisión: no hay claves ni datos personales en el repositorio (solo correos de ejemplo en datos de prueba).
- La tarjeta de Rutas del inicio muestra el número de rutas cuando hay datos reales.

### Verificación

ruff y pytest (53), lint, Vitest (38), los dos builds con presupuestos cumplidos, Playwright con axe en los dos
builds (185 y 210 pasan; las omitidas dependen del navegador o de si hay datos) y Lighthouse CI en 6 páginas del
build de producción y 8 del build con datos de prueba, todas en verde.

### Pendiente de Iker

**Decisiones**

- **311, julio y agosto de 2026**: la Alcaldía solo publicó conteos de tres direcciones para esos meses, sin
  corregimiento. ¿Mostrarlos como conteos del distrito (sin mapa), o pedir a la Alcaldía el detalle por caso?
  No añadí nada, como pediste. Pedírselo es contactar a una institución.
- **Logo**: elegir una de las tres variantes de `design/logo/`.
- **Licencia del código**: el repositorio no tiene archivo LICENSE y `/acerca` dice que es código abierto.
- **Textos**: revisar `docs/textos-para-revisar.md`.
- **Configuración**: revisar `pipeline/config/` (categorías del 311, estados resueltos, sectores, sinónimos).

**Cuentas, claves y datos**

- Clave de API de Anthropic con límite de gasto, en `.env`; luego `empleo --probar` y `empleo --extraer`.
- Ofertas reales en `pipeline/data/raw/empleo/ofertas.csv`.
- ESCO en español (la descarga pide un correo) y, si quieres la cifra de informalidad, el dato de la Encuesta
  de Mercado Laboral del INEC (inec.gob.pa no respondió desde esta red).
- Población por corregimiento del INEC (pendiente desde M1): sin ella el mapa del 311 usa conteos.
- Cuenta de Cloudflare, secretos de GitHub y, si quieres mapa de calles, el bucket R2 con el PMTiles de Panamá.
- Comprobar `palante` como dominio y marca en la DIGERPI.

**Pruebas en teléfonos reales**

- Captura de 30 minutos en un Android sin conexión y envío por WhatsApp (criterio de la sección 8).
- Samsung Internet: carga, instalación y compartir.
- Prueba antes de lanzar (sección 10): Android barato con datos móviles en Panamá, instalar, abrir sin
  conexión, compartir una ficha por WhatsApp y pedir a tres personas que encuentren su corregimiento.
