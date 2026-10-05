# Datos de prueba (FIXTURE)

Todo lo que hay en esta carpeta es inventado y sirve solo para pruebas automáticas.
Cada archivo lleva la marca FIXTURE. El build de producción falla si la marca llega a la salida.

- `web/`: se copia encima de `web/public/` en `web/public-fixtures/` con `npm run build:fixtures`.
- El resto lo usan las pruebas de `pipeline/tests/`.
