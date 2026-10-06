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
