# Cómo recoger ofertas de empleo

Guía corta para llenar `pipeline/data/raw/empleo/ofertas.csv` a mano. Palante no tiene programas que copien
ofertas de páginas web: cada fila la pega una persona.

## Pasos

1. Copia `pipeline/data/raw/empleo/ofertas-plantilla.csv` como `ofertas.csv` en la misma carpeta.
2. Abre una oferta publicada en una página pública de empleo (por ejemplo, la bolsa de empleo del
   Ministerio de Trabajo o la página de empleos de una empresa).
3. Agrega una fila con estas columnas:

| Columna | Qué poner | Obligatoria |
| --- | --- | --- |
| `id` | Año y número correlativo: `2026-0001` | Sí |
| `fecha_publicacion` | Fecha de la oferta, `AAAA-MM-DD` | Sí |
| `fuente` | Dónde la viste: `Empleo 2.0`, `Página de la empresa` | Sí |
| `url` | Enlace a la oferta | No |
| `titulo` | Puesto, tal como aparece | Sí |
| `empresa` | Nombre de la empresa, o vacío si no aparece | No |
| `provincia` | Una de `pipeline/config/provincias.csv` | Sí |
| `sector` | Un `id` de `pipeline/config/sectores.csv` | Sí |
| `salario_min`, `salario_max` | Salario mensual en dólares, solo números (`1200`) | No |
| `texto` | El texto completo de la oferta | Sí |
| `fecha_recoleccion` | El día que la copiaste, `AAAA-MM-DD` | Sí |

4. Guarda el archivo en UTF-8. En Excel: "Guardar como", "CSV UTF-8".

## Reglas

- **Sin datos personales.** Borra del texto nombres, correos y teléfonos de personas. El pipeline también
  quita correos y teléfonos antes de procesar, pero no los copies si no hace falta.
- **No copies una oferta dos veces.** Si la misma empresa publica el mismo puesto en menos de 7 días, el
  pipeline la cuenta una sola vez.
- **Varias fuentes.** Mezcla páginas y sectores para que la muestra no dependa de una sola página.
- Las ofertas, los textos y los nombres de empresas nunca se publican: solo salen totales por sector, con
  10 ofertas o más.

## Procesar

Desde `pipeline/`:

```sh
uv run python -m palante_pipeline empleo --probar    # cuenta ofertas y estima el costo, sin llamar a la API
uv run python -m palante_pipeline empleo --extraer   # llama a la API hasta MAX_USD_EMPLEO
```

`--extraer` necesita `ANTHROPIC_API_KEY` y `MAX_USD_EMPLEO` en `.env`. Cada oferta se paga una sola vez: la
respuesta queda guardada en `pipeline/data/cache/empleo/`.
