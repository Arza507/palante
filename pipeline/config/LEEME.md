# Configuración del pipeline (para revisar)

- `categorias_311.csv`: a qué categoría va cada servicio del 311. Si aparece un servicio nuevo, el pipeline lo
  manda a "Otros" y lo anota en `meta.json` y en REPORT.md para que lo agregues aquí.
- `servicios_genericos.csv`: servicios que no describen el problema. Cuando un caso tiene varios servicios,
  se usa el primero que no esté en esta lista.
- `estados_311.csv`: cómo se agrupan los estados del 311 y cuáles cuentan como resueltos.
- `alias_corregimientos.csv`: nombres del 311 que no coinciden con OpenStreetMap. Tildes, mayúsculas
  y signos ya se ignoran solos.
