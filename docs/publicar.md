# Publicar en Cloudflare Pages

Todo está listo para publicar, pero **nada se ha publicado**. Publicar en producción lo decide Iker.

## Una sola vez

1. Crea la cuenta de Cloudflare y un proyecto de Pages llamado `palante` (Workers y Pages, Crear, Pages,
   «Subir recursos directamente»; no conectes el repositorio: publica el flujo de GitHub).
2. Crea un token de API con el permiso «Cloudflare Pages: Editar» y copia el ID de tu cuenta.
3. En GitHub, en Settings, Secrets and variables, Actions:
   - Secretos: `CLOUDFLARE_API_TOKEN` y `CLOUDFLARE_ACCOUNT_ID`.
   - Variables: `PUBLIC_SITE_URL` (por ejemplo `https://palante.pages.dev`), `PUBLIC_CONTACTO_EMAIL`,
     `PUBLIC_CF_BEACON_TOKEN` (Cloudflare Web Analytics, sin cookies), `PUBLIC_RUTAS` (`false`) y
     `PUBLIC_PMTILES_URL` (vacía hasta tener el mapa de calles).
4. En Settings, Environments, crea `produccion` con «Required reviewers»: así nadie publica en producción sin
   tu aprobación. Crea también `vista-previa`.

## Cada vez

En GitHub, Actions, «Publicar», «Run workflow»:

- `vista-previa`: publica en una URL de prueba (`vista-previa.palante.pages.dev`).
- `main`: producción. Pide tu aprobación si configuraste el entorno `produccion`.

El flujo corre lint, pruebas y el build de producción, que falla si hay datos de prueba (FIXTURE) o si se rompe
un presupuesto de rendimiento.

## Mapa de calles (opcional)

1. Crea un bucket de R2 (por ejemplo `palante-mapas`) con acceso público o un dominio propio.
2. Extrae Panamá del mapa base de Protomaps con `pmtiles extract` (ver https://docs.protomaps.com/) y sube
   `panama.pmtiles` al bucket.
3. Configura CORS del bucket para el dominio de Palante y pon la URL en `PUBLIC_PMTILES_URL`.

## Rutas

`/rutas` solo aparece con `PUBLIC_RUTAS=true`, y el build falla si no hay rutas reales en
`web/public/data/rutas/`. Actívala cuando haya al menos una ruta real validada.

## Dominio

`palante` como dominio y como marca en la DIGERPI está por comprobar (SPEC.md, sección 1). Cambiar el dominio
es decisión de Iker.
