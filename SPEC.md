# Palante: plan maestro de construcción

Palante es una web instalable que convierte datos públicos de Panamá en mapas y paneles que cualquiera entiende desde un teléfono Android barato. Este documento es la especificación completa para que un agente de código construya los módulos 1 a 3 de una sola vez.

## 1. Cómo usar este documento

Esta sección es para Iker; desde la sección 2 el documento le habla al agente. El agente trabaja en Claude Code, en la computadora de Iker, porque ahí puede crear archivos, instalar paquetes, descargar datos y probar durante horas.

### Archivos y cuentas

- [ ] Excel del 311 de la Alcaldía (todos los trimestres publicados) en `pipeline/data/raw/311/`, desde [datos abiertos](https://www.datosabiertos.gob.pa/en_AU/dataset/alcaldia-de-panama-detalle-de-casos-reportados-al-311-2026/resource/87a1b571-0461-465d-ac69-e1f736491859). Si falta, lo descarga el agente.
- [ ] Población por corregimiento del censo del INEC, si la consigue Iker; si no, la busca el agente.
- [ ] Cuenta de GitHub y el repositorio `palante`.
- [ ] Cuenta de Cloudflare, solo para publicar al final.
- [ ] Clave de API de Anthropic con límite de gasto mensual, solo para el módulo 2, guardada en `.env`.
- [ ] Comprobar que `palante` está libre como dominio y como marca en la DIGERPI.

## 2. Instrucciones permanentes para el agente

Están en `CLAUDE.md`, en la raíz del repositorio. El agente las sigue en cada sesión.

## 3. Requisitos no negociables

Palante tiene que cargar rápido en un Android barato con datos prepago; si un elemento de diseño rompe eso, se quita. Ningún hito se cierra sin cumplir esta sección.

### Rendimiento

| Métrica | Límite |
| --- | --- |
| JavaScript inicial en páginas sin mapa de calles | 50 KB gzip como máximo |
| JavaScript en páginas con mapa de calles | 150 KB gzip como máximo, sin contar las teselas |
| Peso total de la primera carga del inicio | 300 KB como máximo |
| Fuentes web | Un solo archivo, 40 KB como máximo |
| LCP en móvil (Slow 4G, CPU 4x más lenta) | 2,5 s como máximo |
| CLS | Menos de 0,1 |
| INP | 200 ms como máximo |
| Lighthouse móvil | Rendimiento 90+, Accesibilidad 95+, Buenas prácticas 95+, SEO 95+ |

### Compatibilidad

- **Prioridad:** Chrome para Android en teléfonos de 2 a 3 GB de RAM con Android 10 o superior.
- **También:** Samsung Internet, Safari en iOS 15.4 o superior, y Chrome, Firefox y Safari de escritorio.
- **Instalable:** PWA con manifest e iconos, instalable desde Chrome para Android y con "Añadir a pantalla de inicio" en iOS. Sin tiendas de apps en esta fase.
- **Sin conexión:** después de la primera visita, la app abre y muestra los últimos datos guardados.
- **Ahorro de datos:** si el navegador indica ahorro de datos (`Save-Data` o `navigator.connection.saveData`), no se cargan teselas de mapa y se muestran listas.
- **Sin WebGL obligatorio:** todo funciona en teléfonos sin WebGL.

### Accesibilidad

- WCAG 2.2 nivel AA.
- Texto base de 16 px como mínimo y zonas táctiles de 44 × 44 px.
- El color nunca es la única señal: los mapas llevan etiquetas o leyenda con valores.
- Todo se puede usar con teclado y lector de pantalla.

### Privacidad

- Sin cuentas de usuario, sin cookies y sin rastreadores de terceros.
- Analítica solo con Cloudflare Web Analytics, que no usa cookies.
- Cumplimiento de la Ley 81 de 2019 de protección de datos de Panamá: no se recogen datos personales.

### Textos

Las reglas de textos de `CLAUDE.md` aplican a cada palabra visible. Los textos los revisa Iker antes de publicar.

## 4. Identidad visual: Palante, estilo Casco Antiguo

Palante se ve como una calle del Casco Antiguo: fachadas de colores cálidos, persianas verdes, balcones de hierro y buganvillas, sobre un fondo de cal limpio. La identidad vive en colores, líneas y pequeños SVG; nunca en imágenes pesadas.

Nombre: **Palante**, de "pa'lante". Lema propuesto: "Datos para echar palante".

### Paleta (modo claro)

Los valores son el punto de partida. El agente los ajusta en luminosidad, sin cambiar el tono, hasta que cada combinación de texto pase AA (4,5:1) y lo comprueba con una prueba automatizada.

| Token | Hex | Inspiración | Uso |
| --- | --- | --- | --- |
| `--cal` | #FBF6EE | Pared encalada | Fondo |
| `--hierro` | #2A2623 | Balcón de hierro forjado | Texto principal |
| `--hierro-suave` | #5E5650 | Hierro envejecido | Texto secundario |
| `--terracota` | #B5452F | Tejas y fachadas | Acento principal, botones |
| `--persiana` | #2E6B62 | Persianas de madera verde | Enlaces, acento secundario |
| `--azulejo` | #2F5E8E | Azulejos y cielo | Información, gráficos |
| `--buganvilla` | #A3245C | Buganvillas en los balcones | Alertas |
| `--ocre` | #E8B04B | Fachadas amarillas | Resaltados, solo con texto oscuro encima |
| `--rosa-fachada` | #E7A598 | Fachadas rosadas | Solo decoración |

**Escala del mapa de calor:** de `--cal` a `--ocre`, `--terracota` y un terracota oscuro (#7A2E1F), en cinco pasos con leyenda de valores.

**Modo oscuro:** fondo #1C1A18, texto #F3ECE2, terracota #E07A5F, persiana #6FB3A8, azulejo #7FA7D6, ocre igual. Se activa con la preferencia del sistema y tiene un interruptor manual.

### Tipografía

- **Títulos y logo:** Fraunces (licencia OFL), un solo archivo WOFF2 variable recortado a caracteres latinos y españoles, pesos 500 a 700, 40 KB como máximo. Si no cabe en 40 KB, se usa una serif del sistema y se anota en `docs/decisiones.md`.
- **Texto y números:** fuentes del sistema (cero bytes), con cifras tabulares en tablas y mapas.

### Motivos

- **Fila de fachadas:** la firma visual. Una franja SVG de fachadas de colores con balcones, de 4 KB como máximo, decorativa (`aria-hidden`), en la cabecera del inicio y de cada ficha.
- **Azulejo:** un patrón de 24 × 24 inspirado en las baldosas de cemento, de 1,5 KB como máximo, solo en bandas y estados vacíos.
- **Baranda:** una línea de balcón de hierro como separador de secciones, de 1 KB como máximo.
- **Categorías:** cada categoría del 311 tiene un color de fachada y un icono lineal propio.

### Logo

- Un arco chato (el arco plano que hizo famoso al Casco) con una flecha hacia la derecha debajo, junto a la palabra "Palante" en Fraunces.
- Legible a 32 px como favicon y en versión de un solo color.
- El agente entrega tres variantes en SVG en `design/logo/`; Iker elige una.

### Lo que no se usa

- **Molas ni patrones guna:** la Ley 20 de 2000 protege los conocimientos y diseños tradicionales de los pueblos indígenas como propiedad colectiva.
- **Escudo, bandera como logo o nada que parezca una web del Gobierno:** Palante es independiente y tiene que verse así.
- **Fotos de fondo, degradados, sombras pesadas y animaciones decorativas.**

## 5. Stack técnico y estructura del repositorio

La web es estática: los datos se procesan en Python antes de publicar y el teléfono solo descarga HTML, poco JavaScript y archivos JSON pequeños. Sin servidor propio y sin base de datos en esta fase.

| Pieza | Herramienta | Por qué |
| --- | --- | --- |
| Web | Astro con salida estática, islas de Preact y TypeScript | Cero JavaScript por defecto; solo lo interactivo carga código |
| Estilos | CSS propio con variables de diseño, sin framework | Control total de la identidad y peso mínimo |
| PWA | @vite-pwa/astro (Workbox) | Instalable y uso sin conexión |
| Mapa del 311 | SVG generado en el build desde TopoJSON con d3-geo; en el teléfono solo se recolorea | Ninguna librería de mapas en el cliente; funciona en cualquier teléfono |
| Mapa de calles (rutas) | Leaflet + protomaps-leaflet con un archivo PMTiles de Panamá en Cloudflare R2 | Sin WebGL, sin claves de terceros y con costo casi cero |
| Gráficos | SVG generado en el build con componentes de Astro | Sin librería de gráficos |
| Pipeline de datos | Python 3.12 con uv, pandas, geopandas, topojson, pydantic y pytest | Lo que Iker ya domina |
| Extracción de habilidades (módulo 2) | API de Anthropic con el modelo Haiku vigente, salida JSON validada con pydantic | Barato y con límite de gasto |
| GTFS (módulo 3) | Generador propio en Python y validador GTFS de MobilityData en CI | Estándar abierto que leen Google Maps y OpenStreetMap |
| Imágenes para compartir | satori + resvg-js en el build | Vista previa en WhatsApp sin servidor |
| Pruebas | Vitest, Playwright, axe-core, Lighthouse CI y pytest | Ver sección 10 |
| CI y publicación | GitHub Actions y Cloudflare Pages | Gratis y automático |
| Analítica | Cloudflare Web Analytics | Sin cookies |

Mientras no exista el bucket de R2 para las teselas, la página de rutas dibuja las trazas sobre un fondo liso y muestra la lista de paradas.

### Estructura

```text
palante/
├── CLAUDE.md
├── SPEC.md
├── REPORT.md
├── docs/decisiones.md
├── design/logo/
├── fixtures/                  datos de prueba, marcados FIXTURE
├── pipeline/
│   ├── pyproject.toml
│   ├── config/categorias_311.csv
│   ├── data/raw/311/  empleo/  rutas/  geo/  poblacion/
│   ├── palante_pipeline/comun/  m311/  empleo/  rutas/
│   └── tests/
├── web/
│   ├── astro.config.mjs
│   ├── public/data/311/  empleo/  rutas/   salida del pipeline
│   ├── src/layouts/  components/  islands/  pages/  styles/
│   └── tests/unit/  e2e/
└── .github/workflows/ci.yml  datos.yml  deploy.yml
```

## 6. Módulo 1: Mapa del 311

El módulo 1 muestra cuántos problemas reporta la gente al 311 en cada corregimiento del distrito de Panamá, de qué tipo y cuántos se resuelven. Es el módulo prioritario: se publica primero.

### Entradas

- **Casos del 311:** Excel de la Alcaldía en `pipeline/data/raw/311/`, con licencia CC0 ([fuente](https://www.datosabiertos.gob.pa/en_AU/dataset/alcaldia-de-panama-detalle-de-casos-reportados-al-311-2026/resource/87a1b571-0461-465d-ac69-e1f736491859)). Si falta, el agente lo descarga de esa página y de los trimestres publicados en el mismo conjunto de datos.
- **Límites de corregimientos:** de OpenStreetMap (límites administrativos; el agente verifica el nivel correcto) o del INEC. Se guarda en `pipeline/data/raw/geo/` y se cita con su licencia (ODbL en el caso de OSM).
- **Población por corregimiento:** del censo más reciente del INEC. Si no se consigue, el mapa muestra conteos absolutos con una nota visible.

### Procesamiento

1. Leer todos los Excel y escribir `docs/datos-311.md` con las columnas reales, tipos y ejemplos.
2. Normalizar los nombres de corregimiento (tildes, mayúsculas, alias) y unirlos con los polígonos. Los que no coincidan se listan en REPORT.md.
3. Agrupar el campo de servicio en categorías con `config/categorias_311.csv`. Categorías iniciales: Agua y alcantarillado, Calles y aceras, Basura y limpieza, Alumbrado, Drenajes e inundaciones, Árboles y áreas verdes, Ruido y convivencia, Otros. Iker revisa ese CSV.
4. Eliminar la descripción del caso antes de guardar nada fuera de `raw/`.
5. Si existen fechas de apertura y cierre, calcular la mediana de días hasta el cierre.
6. Agregar por corregimiento, categoría, trimestre y estado.
7. Validar con pydantic y probar que la suma de los agregados es igual a las filas válidas.

### Salidas en `web/public/data/311/`

- `corregimientos.topo.json`: polígonos simplificados.
- `resumen.json`: los agregados.
- `meta.json`: fuente, URL, licencia, fecha de los datos, fecha de proceso, filas leídas y filas descartadas con su motivo.
- `311-limpio.csv`: descarga pública, sin descripciones.

### Páginas

| Ruta | Contenido |
| --- | --- |
| `/311` | Mapa coloreado por reportes por cada 10.000 habitantes, filtros (categoría, estado, trimestre), leyenda con valores y ranking |
| `/311/[corregimiento]` | Ficha: total, tres problemas principales, porcentaje resuelto, mediana de días hasta el cierre si existe, comparación con el distrito y botón de compartir |
| `/311/metodologia` | Fuente, licencia, cómo se agrupan las categorías, límites de los datos y fecha |

### Interacción

- Al tocar un corregimiento se abre una hoja inferior con su resumen y un enlace a la ficha.
- El mapa tiene una vista de lista equivalente, ordenable, para accesibilidad y ahorro de datos.
- Los filtros viven en la URL (por ejemplo `/311?categoria=agua`) para poder compartir una vista exacta.
- Sin JavaScript se ve la vista por defecto; con JavaScript funcionan los filtros.
- La metodología advierte que más reportes no siempre significa más problemas: los barrios que conocen el 311 reportan más.

### Criterios de aceptación

- [ ] Los totales de la interfaz coinciden con los del pipeline (prueba automatizada).
- [ ] Cada corregimiento de los datos tiene polígono o aparece en REPORT.md.
- [ ] Ninguna descripción libre llega a `public/`.
- [ ] Cada ficha tiene URL estable e imagen para compartir.
- [ ] Se cumplen los presupuestos de la sección 3.

## 7. Módulo 2: Observatorio de empleo

El módulo 2 muestra, por sector, qué piden las empresas en Panamá: habilidades, herramientas, idiomas y salarios. Funciona con una muestra de ofertas recogidas a mano hasta que exista un acuerdo de datos; el agente deja todo listo para que Iker solo añada filas.

### Entradas

- **Ofertas:** `pipeline/data/raw/empleo/ofertas.csv`. El agente crea `ofertas-plantilla.csv` y una guía corta, `docs/como-recoger-ofertas.md`.
- **Mercado laboral:** tablas públicas de la Encuesta de Mercado Laboral del INEC, descargadas y citadas por el agente.
- **Taxonomía de habilidades:** etiquetas en español de ESCO. El agente verifica su licencia y su atribución.

| Columna | Ejemplo | Obligatoria |
| --- | --- | --- |
| `id` | 2026-0001 | Sí |
| `fecha_publicacion` | 2026-09-20 | Sí |
| `fuente` | Empleo 2.0 | Sí |
| `url` | Enlace a la oferta | No |
| `titulo` | Analista de datos | Sí |
| `empresa` | Nombre o vacío | No |
| `provincia` | Panamá | Sí |
| `sector` | De una lista cerrada en `config/sectores.csv` | Sí |
| `salario_min`, `salario_max` | 1200, 1500 | No |
| `texto` | Texto completo de la oferta | Sí |
| `fecha_recoleccion` | 2026-10-05 | Sí |

### Procesamiento

1. Validar el CSV con pydantic y rechazar filas sin texto.
2. Eliminar duplicados (título y empresa normalizados con fechas a menos de 7 días).
3. Extraer de cada oferta, con la API de Anthropic y temperatura 0, un JSON con: habilidades, herramientas, idiomas con nivel, años de experiencia, nivel educativo, modalidad (presencial, híbrido o remoto) y salario si aparece en el texto.
4. Guardar cada respuesta en caché por el hash del texto, para no pagar dos veces.
5. Un modo de prueba estima el costo antes de llamar a la API. La variable `MAX_USD_EMPLEO` detiene el proceso al llegar al límite.
6. Normalizar habilidades contra ESCO, con `config/sinonimos_habilidades.csv` para correcciones manuales ("Excel avanzado" pasa a "Microsoft Excel").
7. Agregar por sector, provincia y mes: las 15 habilidades y herramientas más pedidas, porcentaje de ofertas que exigen inglés, salario mediano y número de ofertas.
8. No publicar ninguna celda con menos de 10 ofertas; se muestra como "muestra insuficiente".
9. Pruebas con 20 ofertas de prueba y su extracción esperada.

### Salidas en `web/public/data/empleo/`

`resumen.json`, un JSON por sector en `sectores/` y `meta.json` con el tamaño y el origen de la muestra.

### Páginas

| Ruta | Contenido |
| --- | --- |
| `/empleo` | Panel por sector: habilidades más pedidas en barras horizontales, porcentaje que pide inglés y ofertas por provincia |
| `/empleo/[sector]` | Detalle de un sector |
| `/empleo/informe` | "Qué piden las empresas en Panamá, edición 1", con estilos de impresión para guardar como PDF en A4 |
| `/empleo/metodologia` | Fuentes, cómo se extraen las habilidades, sesgos y fecha |

En cada gráfico se ve el tamaño de la muestra. Un aviso fijo dice cuántas ofertas hay, entre qué fechas y que la muestra no representa todo el empleo de Panamá, donde casi la mitad es informal.

### Criterios de aceptación

- [ ] El pipeline corre sin errores con la plantilla vacía y con los datos de prueba.
- [ ] El modo de prueba estima el costo antes de usar la API.
- [ ] Ninguna celda con menos de 10 ofertas llega a `public/`.
- [ ] El informe se imprime en A4 sin cortes en mitad de un gráfico.
- [ ] No hay ningún scraper en el repositorio.

## 8. Módulo 3: Rutas de transporte

El módulo 3 tiene dos partes: una app de captura para voluntarios y un mapa público de rutas. El mapa público queda oculto hasta que exista al menos una ruta real validada; nunca se publica con datos de prueba.

**Alcance legal:** solo rutas internas con permiso. El formulario pregunta si la ruta tiene permiso de la ATTT (sí, no, no sé) y solo se publican las de "sí".

### App de captura (`/captura`)

Está dentro de la misma PWA, fuera del menú público. No hay cuentas ni servidor: un código de voluntario (por ejemplo UTP-07) solo etiqueta las capturas.

1. **Inicio:** instrucciones en cinco pasos, el código de voluntario y un aviso de seguridad (en pareja, de día, con el teléfono guardado entre paradas).
2. **Nueva captura:** nombre de la ruta como la llama la gente, operador o cooperativa, tarifa en dólares, sentido (ida o vuelta) y permiso.
3. **Grabando:** posición GPS cada 5 segundos en alta precisión; un botón grande "Parada aquí" de 64 px o más; "Fin de ruta"; contador de paradas y minutos. La pantalla se mantiene encendida (Screen Wake Lock) y la app avisa si la precisión pasa de 50 m.
4. **Revisar:** la traza en un SVG simple, sin mapa base, y la lista de paradas para nombrarlas o borrarlas.
5. **Enviar:** "Enviar por WhatsApp" comparte el archivo con la Web Share API; la alternativa es descargarlo. Todo se guarda en IndexedDB hasta enviarlo y funciona sin conexión.

En iOS, Safari detiene el GPS con la pantalla apagada o la app en segundo plano. La app lo advierte y la guía de voluntarios recomienda Android.

### Formato del archivo de captura

```json
{
  "version": 1,
  "voluntario": "UTP-07",
  "ruta": "Nombre popular de la ruta",
  "operador": "Cooperativa",
  "tarifa_usd": 0.5,
  "sentido": "ida",
  "permiso": "si",
  "inicio": "2028-01-10T07:02:11-05:00",
  "fin": "2028-01-10T07:41:30-05:00",
  "puntos": [{ "t": "2028-01-10T07:02:16-05:00", "lat": 0, "lon": 0, "precision_m": 8 }],
  "paradas": [{ "t": "2028-01-10T07:05:02-05:00", "lat": 0, "lon": 0, "nombre": "" }]
}
```

### Procesamiento

1. Leer las capturas de `pipeline/data/raw/rutas/` y validar el esquema.
2. Descartar puntos con precisión peor que 50 m y saltos imposibles (más de 120 km/h).
3. Simplificar las trazas con Ramer-Douglas-Peucker a 10 m.
4. Fusionar en una sola las paradas de distintas capturas a menos de 30 m.
5. Agrupar capturas por ruta y sentido, y quedarse con la traza más completa.
6. Generar el GTFS: agency, routes (tipo 3, bus), stops, trips, shapes, frequencies, calendar y feed_info.
7. Validar con el validador de MobilityData: cero errores para publicar.
8. Publicar solo rutas con permiso "sí".

### Salidas y página pública

- Salidas en `web/public/data/rutas/`: `rutas.geojson`, `paradas.geojson`, `gtfs.zip` y `meta.json`.
- `/rutas`: mapa de calles con las rutas en colores. Al tocar una ruta se ven tarifa, operador, paradas y la fecha de la última captura. Tiene vista de lista por sector y descarga del GTFS.
- La página está detrás de la bandera `PUBLIC_RUTAS`, apagada por defecto.
- Datos de rutas propios con licencia CC BY 4.0. Subirlos a OpenStreetMap lo decide Iker después.

### Criterios de aceptación

- [ ] Una captura de 30 minutos en Android sin conexión se guarda y se envía por WhatsApp (prueba manual documentada en REPORT.md).
- [ ] El GTFS generado con datos de prueba pasa el validador sin errores.
- [ ] Ninguna ruta sin permiso llega a `public/`.
- [ ] `/rutas` no se publica mientras solo haya datos de prueba.

## 9. Páginas comunes, compartir y uso sin conexión

En Panamá casi todo se comparte por WhatsApp, así que cada página y cada ficha tiene su imagen de vista previa y un botón de compartir. Las páginas comunes son pocas y cortas.

### Páginas

| Ruta | Contenido |
| --- | --- |
| `/` | Qué es Palante en una frase, tarjetas de los módulos activos con su dato principal y su fecha, y la fila de fachadas |
| `/acerca` | Quién lo hace, por qué, código abierto y un correo de contacto |
| `/fuentes` | Cada fuente con licencia y fecha: 311 (CC0), OpenStreetMap (ODbL, atribución obligatoria), INEC, ESCO y Protomaps |
| `/privacidad` | Sin cuentas, sin cookies, analítica sin cookies y la Ley 81 de 2019 |
| `/datos` | Descarga de todos los datos limpios |
| `/sin-conexion` | Lo que se ve sin internet: los últimos datos guardados y su fecha |
| `404` | La fila de fachadas y enlaces útiles |

### Navegación

- En móvil, una barra inferior con Inicio, 311, Empleo y Rutas. Rutas solo aparece cuando su bandera está activa.
- En escritorio, una cabecera simple con las mismas entradas.

### Compartir

- El botón usa la Web Share API; si no existe, abre un enlace de WhatsApp con texto y URL.
- Una imagen de 1200 × 630 por página y por ficha, de 100 KB como máximo, con el dato principal, la fecha y la marca.
- El texto para compartir sigue esta plantilla, siempre con datos reales: "En {corregimiento} hubo {n} reportes de {categoría} al 311 entre {inicio} y {fin}. Míralo en Palante."

### Instalación y sin conexión

- Manifest con nombre "Palante", color de tema terracota, fondo cal e iconos de 192 y 512 px, también en versión adaptable (maskable).
- El service worker guarda la estructura de la app y los datos de cada módulo visitado. Los datos se actualizan en segundo plano.
- Sin conexión aparece un aviso: "Datos guardados del {fecha}".

### SEO

- HTML estático por ficha, con título y descripción únicos.
- `sitemap.xml`, `robots.txt`, URL canónicas y `lang="es-PA"`.
- Datos estructurados de schema.org tipo Dataset en `/datos` y en cada módulo.

## 10. Pruebas y calidad

Cada pull request pasa pruebas automáticas que bloquean la publicación si se rompen los presupuestos de la sección 3, la accesibilidad, los datos o las reglas de textos. Antes del lanzamiento hay una prueba en un Android barato real.

### Dispositivos

| Perfil | Cómo se prueba | Qué se mira |
| --- | --- | --- |
| Android de gama baja (2 a 3 GB de RAM, Android 10, Chrome) | Lighthouse CI móvil con Slow 4G y CPU 4x; Playwright con perfil Pixel 5 | Presupuestos de la sección 3 |
| iPhone (Safari iOS 15.4 o superior) | Playwright con WebKit y perfil iPhone SE | Diseño, compartir, añadir a inicio |
| Escritorio (Chrome, Firefox, Safari) | Playwright a 1280 px | Diseño y navegación |
| Sin conexión | Playwright con la red cortada tras la primera visita | La app abre con datos guardados |
| Ahorro de datos | Playwright con la cabecera `Save-Data` | Sin teselas y con listas |
| Samsung Internet | Prueba manual en un teléfono real | Carga, instalación y compartir |

### Herramientas

- **pytest:** esquemas, totales y archivos de referencia del pipeline.
- **Vitest:** lógica del cliente, como filtros y formato de números.
- **Playwright:** flujos clave (abrir el mapa, filtrar, abrir una ficha, compartir; capturar una ruta con GPS simulado).
- **axe-core:** dentro de Playwright, en cada página; cero errores serios.
- **Lighthouse CI:** con los presupuestos de la sección 3.
- **Validador GTFS de MobilityData:** cero errores.
- **Contraste:** un script que falla si alguna combinación de texto de la paleta baja de 4,5:1.
- **Textos:** un script que falla si encuentra emojis o frases prohibidas de `CLAUDE.md` en `src/`.
- **Datos de prueba:** el build de producción falla si encuentra la marca FIXTURE en `public/`.

### Prueba real antes de lanzar

- [ ] Abrir Palante en un Android barato con datos móviles, en Panamá.
- [ ] Instalarla en la pantalla de inicio y abrirla sin conexión.
- [ ] Compartir una ficha por WhatsApp y comprobar la vista previa.
- [ ] Pedir a tres personas que encuentren su corregimiento y digan qué entendieron.

## 11. Hitos y definición de terminado

El agente construye en cinco hitos y no empieza uno sin cerrar el anterior con sus pruebas en verde y un commit.

1. **M0, base.**
    - Estructura del repositorio, Astro con Preact y TypeScript, pipeline de Python con uv y flujos de CI.
    - Tokens de color (claro y oscuro), fuente recortada, fila de fachadas, azulejo, baranda y tres variantes del logo.
    - Plantilla general, navegación, inicio y páginas comunes. Donde aún no hay datos dice "Próximamente", nunca un número inventado.
    - Manifest, service worker y Lighthouse CI configurado.
    - Se cierra cuando el inicio cumple los presupuestos y pasan los scripts de contraste y de textos.
2. **M1, mapa del 311.** Todo lo de la sección 6 con sus criterios de aceptación.
3. **M2, observatorio de empleo.** Todo lo de la sección 7, con datos de prueba si aún no hay ofertas reales.
4. **M3, rutas.** Todo lo de la sección 8, con `/rutas` oculta.
5. **M4, cierre.**
    - Todas las pruebas de la sección 10.
    - `docs/textos-para-revisar.md` con cada texto visible, para que Iker lo revise.
    - Configuración de Cloudflare Pages lista, sin publicar en producción.
    - `README.md` en español y `REPORT.md`.

### Definición de terminado

- [ ] Se cumplen los criterios de aceptación de las secciones 6, 7 y 8.
- [ ] Los presupuestos de la sección 3 están en verde en CI.
- [ ] `README.md` explica en español cómo correr el pipeline y la web en local, con los comandos exactos.
- [ ] `REPORT.md` lista lo hecho, lo pendiente, las decisiones tomadas y las tareas de Iker.
- [ ] No hay ninguna clave ni dato personal en el repositorio.

## 12. Lo que el agente no puede hacer sin permiso

El agente se detiene y pregunta a Iker antes de cualquiera de estas acciones. Si Iker no responde, anota la tarea en REPORT.md y sigue con el resto.

- Crear cuentas o iniciar sesión en cualquier servicio.
- Gastar dinero: dominios, planes de pago, almacenamiento o llamadas a la API por encima de `MAX_USD_EMPLEO`.
- Publicar en producción o cambiar el dominio.
- Usar una clave de API que no esté en `.env`.
- Escribir cualquier programa que extraiga datos de sitios web de terceros, salvo descargar los archivos de datos abiertos citados en este documento.
- Contactar a personas, instituciones o empresas.
- Publicar cualquier dato que pueda contener información personal.
- Elegir el logo definitivo o cambiar el nombre, los colores base o el lema.
- Subir datos a OpenStreetMap o a cualquier repositorio externo.
