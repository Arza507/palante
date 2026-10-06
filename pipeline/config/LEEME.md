# Configuración del pipeline (para revisar)

- `categorias_311.csv`: a qué categoría va cada servicio del 311. Si aparece un servicio nuevo, el pipeline lo
  manda a "Otros" y lo anota en `meta.json` y en REPORT.md para que lo agregues aquí.
- `servicios_genericos.csv`: servicios que no describen el problema. Cuando un caso tiene varios servicios,
  se usa el primero que no esté en esta lista.
- `estados_311.csv`: cómo se agrupan los estados del 311 y cuáles cuentan como resueltos.
- `alias_corregimientos.csv`: nombres del 311 que no coinciden con OpenStreetMap. Tildes, mayúsculas
  y signos ya se ignoran solos.

## Empleo

- `sectores.csv`: lista cerrada de sectores. La columna `sector` de las ofertas usa el `id`.
- `provincias.csv`: provincias y comarcas que acepta la columna `provincia`.
- `sinonimos_habilidades.csv`: correcciones manuales. Lo que la extracción escribe en `texto` pasa a
  llamarse `habilidad` ("Excel avanzado" pasa a "Microsoft Excel"). Tildes y mayúsculas ya se ignoran.

## Rutas

- `rutas.csv`: datos de cada ruta que la captura no trae: sector (para la lista), días con servicio (siete
  cifras de lunes a domingo, `1111110` = lunes a sábado), primera y última salida (`05:30`, `21:00`) y cada
  cuántos minutos pasa. Una ruta sin fila aquí se muestra en el mapa pero no entra al GTFS.
