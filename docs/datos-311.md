# Datos del 311: columnas reales

Generado por el pipeline (`uv run python -m palante_pipeline 311`). No editar a mano.

- Fuente: [Alcaldía de Panamá - Detalle de Casos Reportados al 311- 2026](https://www.datosabiertos.gob.pa/dataset/alcaldia-de-panama-detalle-de-casos-reportados-al-311-2026), licencia CC0 1.0 (dominio público).
- Casos creados del 2026-04-01 al 2026-06-30. Procesado el 2026-10-05.
- Filas leídas: 530. Válidas: 528.

Las columnas de nombre y detalle se eliminan al leer. No se muestran ejemplos de ellas.

## 311-junio-mayo-abril-2026-detalles-de-casos.xlsx, hoja «Detalles de casos»

530 filas.

| Columna | Tipo | Vacías | Distintos | Ejemplos o tratamiento |
| --- | --- | --- | --- | --- |
| Caso | texto | 0 | 530 | 2026-99154; 2026-99050; 2026-98840 |
| Razón de Estatus | texto | 0 | 5 | Concluido; En Proceso; Vencido |
| Canal | texto | 0 | 5 | Llamada al 311; Web; Email |
| Fecha (Creación) | fecha y hora (texto AAAA-MM-DD hh:mm:ss) | 0 | 530 | 2026-06-30 21:17:35; 2026-06-30 18:21:38; 2026-06-30 15:20:43 |
| Último Cambio | fecha y hora (texto AAAA-MM-DD hh:mm:ss) | 0 | 527 | 2026-07-04 12:10:10; 2026-07-01 15:41:36; 2026-07-01 15:20:30 |
| Nombre | texto | 0 | 438 | dato personal: se elimina al leer |
| Servicios | texto | 0 | 54 | Atención al Cliente; Lote sucio - MUPA; Acciones de hecho contra propiedad privada - MUPA |
| Corregimiento | texto | 0 | 28 | CALIDONIA O LA EXPOSICIÓN; 24 DE DICIEMBRE; PACORA |
| Detalle | texto | 0 | 529 | texto libre del ciudadano: se elimina al leer |

## Filas descartadas

- corregimiento fuera del distrito de Panamá o sin polígono: 2: JOSÉ DOMINGO ESPINAR (1), AMELIA DENIS DE ICAZA (1).

## Servicios sin categoría en config/categorias_311.csv

Ninguno.
