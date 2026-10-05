"""Límites de los corregimientos del distrito de Panamá desde OpenStreetMap (ODbL).

En OSM, Panamá usa admin_level 4 para provincias, 6 para distritos y 8 para corregimientos.
El distrito de Panamá es la relación 8415626. Se toman los corregimientos (nivel 8) cuyo punto
interior cae dentro del distrito, sin depender de una lista fija de nombres.
"""

import json
import time
from datetime import UTC, datetime
from pathlib import Path

import geopandas as gpd
import httpx
from shapely.geometry import LineString, MultiPolygon, Polygon
from shapely.ops import linemerge, polygonize, unary_union

from palante_pipeline.comun.salida import RAW
from palante_pipeline.comun.texto import slug

DISTRITO_OSM = 8415626
CAJA = (8.85, -79.75, 9.42, -79.0)  # sur, oeste, norte, este: cubre el distrito con margen
ARCHIVO = RAW / "geo" / "osm-corregimientos-panama.json"
SERVIDORES = [
    "https://overpass-api.de/api/interpreter",
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
]
AGENTE = "Palante/0.1 (+https://github.com/Arza507/palante)"


def consulta() -> str:
    s, o, n, e = CAJA
    return (
        "[out:json][timeout:180];"
        f"(rel({DISTRITO_OSM});"
        f'rel["boundary"="administrative"]["admin_level"="8"]({s},{o},{n},{e}););'
        "out geom;"
    )


def descargar(intentos: int = 6, espera_s: int = 20) -> Path:
    """Descarga los límites con la API Overpass. Reintenta en varios servidores si están ocupados."""
    ultimo_error = ""
    for i in range(intentos):
        for url in SERVIDORES:
            try:
                r = httpx.post(url, data={"data": consulta()}, headers={"User-Agent": AGENTE}, timeout=240)
                if r.status_code == 200 and r.text.lstrip().startswith("{"):
                    datos = r.json()
                    datos["_palante"] = {
                        "descargado": datetime.now(UTC).isoformat(timespec="seconds"),
                        "url": url,
                    }
                    ARCHIVO.parent.mkdir(parents=True, exist_ok=True)
                    ARCHIVO.write_text(json.dumps(datos, ensure_ascii=False), encoding="utf-8")
                    return ARCHIVO
                ultimo_error = f"{url}: HTTP {r.status_code}"
            except httpx.HTTPError as e:
                ultimo_error = f"{url}: {e}"
        print(f"Overpass ocupado (intento {i + 1}/{intentos}); reintento en {espera_s} s")
        time.sleep(espera_s)
    raise RuntimeError(f"No se pudieron descargar los límites de OSM. Último error: {ultimo_error}")


def _poligono(rel: dict) -> MultiPolygon | Polygon | None:
    """Arma el polígono de una relación a partir de las geometrías de sus vías."""
    exteriores, interiores = [], []
    for m in rel.get("members", []):
        if m.get("type") != "way" or "geometry" not in m:
            continue
        linea = LineString([(p["lon"], p["lat"]) for p in m["geometry"]])
        (interiores if m.get("role") == "inner" else exteriores).append(linea)
    if not exteriores:
        return None
    ext = unary_union(list(polygonize(linemerge(exteriores))))
    if interiores:
        ext = ext.difference(unary_union(list(polygonize(linemerge(interiores)))))
    return ext if not ext.is_empty else None


def corregimientos(archivo: Path = ARCHIVO) -> tuple[gpd.GeoDataFrame, dict]:
    """GeoDataFrame con los corregimientos del distrito de Panamá y los metadatos de la descarga."""
    datos = json.loads(archivo.read_text(encoding="utf-8"))
    distrito = None
    filas = []
    for e in datos["elements"]:
        if e.get("type") != "relation":
            continue
        geom = _poligono(e)
        if geom is None:
            continue
        if e["id"] == DISTRITO_OSM:
            distrito = geom
            continue
        nombre = e["tags"].get("name", "")
        filas.append({"osm_id": e["id"], "nombre": nombre, "slug": slug(nombre), "geometry": geom})
    if distrito is None:
        raise ValueError("La descarga no incluye el polígono del distrito de Panamá")
    gdf = gpd.GeoDataFrame(filas, crs="EPSG:4326")
    dentro = gdf.geometry.representative_point().within(distrito)
    gdf = gdf[dentro].sort_values("slug").reset_index(drop=True)
    meta = {
        "fecha_osm": datos.get("osm3s", {}).get("timestamp_osm_base", "")[:10],
        "descargado": datos.get("_palante", {}).get("descargado", ""),
    }
    return gdf, meta
