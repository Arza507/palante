# Palante

Palante convierte datos públicos de Panamá en mapas y paneles que se entienden desde cualquier teléfono.
Es una web instalable (PWA), estática, hecha para Android de gama baja con datos prepago.

- **Mapa del 311**: qué reporta la gente al 311 en cada corregimiento del distrito de Panamá.
- **Observatorio de empleo**: qué piden las empresas en sus ofertas, por sector.
- **Rutas de transporte**: rutas internas de busitos y chivas, con una app de captura para voluntarios.

La especificación completa está en `SPEC.md`; el estado del trabajo, en `REPORT.md`; las decisiones técnicas,
en `docs/decisiones.md`.

## Lo que necesitas

- Node 24 (LTS) y npm.
- Python 3.12 con [uv](https://docs.astral.sh/uv/).
- Para el validador GTFS en tu computadora: Java 17 o más reciente (en CI ya corre).

## Configuración

Copia `.env.example` como `.env` en la raíz y rellena lo que tengas. `.env` nunca se sube al repositorio.

| Variable | Para qué |
| --- | --- |
| `ANTHROPIC_API_KEY` | Extracción de habilidades del módulo de empleo |
| `MAX_USD_EMPLEO` | Tope de gasto en dólares de cada corrida de extracción |
| `PUBLIC_SITE_URL` | URL pública, para URL canónicas y el sitemap |
| `PUBLIC_CONTACTO_EMAIL` | Correo de contacto en `/acerca` |
| `PUBLIC_CF_BEACON_TOKEN` | Cloudflare Web Analytics (sin cookies) |
| `PUBLIC_RUTAS` | `true` muestra `/rutas`; solo con rutas reales validadas |
| `PUBLIC_PMTILES_URL` | Archivo PMTiles de Panamá para el mapa de calles |

## Pipeline de datos

Desde `pipeline/`:

```sh
uv sync --all-groups --all-extras

# Mapa del 311: descarga los datos abiertos de la Alcaldía y los límites de OpenStreetMap.
uv run python -m palante_pipeline 311 --descargar

# Empleo: lee pipeline/data/raw/empleo/ofertas.csv (guía en docs/como-recoger-ofertas.md).
uv run python -m palante_pipeline empleo --probar     # estima el costo, sin llamar a la API
uv run python -m palante_pipeline empleo --extraer    # llama a la API hasta MAX_USD_EMPLEO

# Rutas: lee las capturas de pipeline/data/raw/rutas/*.json (guía en docs/guia-voluntarios.md).
uv run python -m palante_pipeline rutas

# Todo junto
uv run python -m palante_pipeline todo --descargar

# Pruebas y estilo
uv run pytest
uv run ruff check .
uv run ruff format --check .
```

Las salidas van a `web/public/data/`. Los datos crudos (`pipeline/data/raw/`) y la caché de extracciones
(`pipeline/data/cache/`) no se suben al repositorio.

### Datos de prueba

Viven en `fixtures/`, llevan la marca FIXTURE y nunca llegan a `web/public/`. Para regenerarlos, desde
`pipeline/`:

```sh
uv run python ../fixtures/generar_fixtures_311.py
uv run python ../fixtures/generar_fixtures_empleo.py
uv run python ../fixtures/generar_fixtures_rutas.py
```

## Web

Desde `web/`:

```sh
npm ci
npm run dev                 # servidor de desarrollo en http://localhost:4321

npm run lint                # tipos, reglas de textos y contraste de colores
npm test                    # pruebas unitarias (Vitest)

npm run build               # build de producción en dist/; falla con datos FIXTURE o presupuestos rotos
npm run preview             # sirve dist/ como lo haría Cloudflare Pages

npm run build:fixtures      # build con datos de prueba en dist-fixtures/ (también activa /rutas)

npx playwright install --with-deps chromium webkit firefox   # una sola vez
npm run test:e2e                                             # Playwright y axe-core sobre dist/
DIST=dist-fixtures PORT=4322 npm run test:e2e                # sobre el build con datos de prueba

npm run lhci                                                 # Lighthouse CI sobre dist/
LHCI_DIST=./dist-fixtures LHCI_PUERTO=4501 npm run lhci      # sobre el build con datos de prueba

npm run build:fixtures && node scripts/extraer-textos.mjs    # actualiza docs/textos-para-revisar.md
```

En Windows con PowerShell, las variables se escriben antes del comando así:
`$env:DIST='dist-fixtures'; $env:PORT='4322'; npm run test:e2e`.

Lighthouse CI necesita Chrome. Puedes usar el de Playwright:
`CHROME_PATH="$(node -e "console.log(require('@playwright/test').chromium.executablePath())")" npm run lhci`.

## Calidad

Cada push a `main` corre en GitHub Actions (`.github/workflows/ci.yml`): ruff y pytest, el validador GTFS de
MobilityData, lint, Vitest, los dos builds con los presupuestos de rendimiento, Playwright con axe-core en
cinco perfiles (Android, iPhone, Chrome, Firefox y Safari de escritorio) y Lighthouse CI móvil.

## Publicar

Ver `docs/publicar.md`. La publicación es manual y por defecto va a una vista previa.

## Licencias

- Código: licencia por elegir (pendiente de Iker; ver REPORT.md).
- Datos del 311: Alcaldía de Panamá, CC0. Límites: © colaboradores de OpenStreetMap, ODbL.
- Datos propios de empleo y rutas: CC BY 4.0.
- Fuente Fraunces: SIL Open Font License (`web/public/fonts/OFL.txt`).
