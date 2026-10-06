"""Procesamiento de capturas de rutas: limpieza, simplificación, paradas, GTFS y GeoJSON.

Solo se publican rutas con permiso "si" de la ATTT (SPEC.md, sección 8).
"""

import json
import shutil
from collections import Counter
from dataclasses import dataclass, field
from datetime import UTC, date, datetime, timedelta
from pathlib import Path

import pandas as pd
from pydantic import ValidationError

from palante_pipeline.comun.salida import CONFIG, PUBLIC_DATA, escribir_json
from palante_pipeline.comun.texto import clave, slug
from palante_pipeline.rutas import gtfs
from palante_pipeline.rutas.geometria import distancia, largo, simplificar
from palante_pipeline.rutas.modelo import Captura, Descarte, HorarioRuta, Meta, RutaMeta

PRECISION_MAX_M = 50
VELOCIDAD_MAX_KMH = 120
TOLERANCIA_M = 10
FUSION_PARADAS_M = 30


@dataclass
class Limpia:
    archivo: str
    captura: Captura
    traza: list[tuple[float, float]]
    largo_m: float
    descartados_precision: int
    descartados_salto: int


@dataclass
class ParadaFusionada:
    id: str
    lat: float
    lon: float
    nombres: Counter = field(default_factory=Counter)
    n: int = 0

    @property
    def nombre(self) -> str:
        return self.nombres.most_common(1)[0][0] if self.nombres else ""


@dataclass
class Ruta:
    id: str
    ruta: str
    sentido: str
    operador: str
    tarifa_usd: float | None
    traza: list[tuple[float, float]]
    paradas: list[str]
    # Segundos desde la primera parada, en el mismo orden que `paradas`.
    tiempos: list[int]
    capturas: int
    ultima_captura: date
    horario: HorarioRuta | None


@dataclass
class Resultado:
    rutas: list[Ruta]
    paradas: dict[str, ParadaFusionada]
    meta: Meta


def leer(carpeta: Path) -> tuple[list[tuple[str, Captura]], list[Descarte]]:
    capturas, malas = [], []
    for p in sorted(carpeta.glob("*.json")):
        try:
            capturas.append((p.name, Captura.model_validate_json(p.read_text(encoding="utf-8"))))
        except (ValidationError, ValueError):
            malas.append(p.name)
    return capturas, (
        [Descarte(motivo="archivo con formato inválido", n=len(malas), detalle=malas)] if malas else []
    )


def limpiar(archivo: str, c: Captura) -> Limpia:
    """Quita puntos con precisión peor que 50 m y saltos de más de 120 km/h; simplifica a 10 m."""
    puntos = sorted(c.puntos, key=lambda p: p.t)
    buenos = [p for p in puntos if p.precision_m <= PRECISION_MAX_M]
    sin_salto = []
    for p in buenos:
        if sin_salto:
            a = sin_salto[-1]
            seg = (p.t - a.t).total_seconds()
            d = distancia(a.lat, a.lon, p.lat, p.lon)
            if seg <= 0 or d / seg * 3.6 > VELOCIDAD_MAX_KMH:
                continue
        sin_salto.append(p)
    traza = simplificar([(p.lat, p.lon) for p in sin_salto], TOLERANCIA_M)
    return Limpia(
        archivo=archivo,
        captura=c,
        traza=traza,
        largo_m=largo(traza),
        descartados_precision=len(puntos) - len(buenos),
        descartados_salto=len(buenos) - len(sin_salto),
    )


def fusionar_paradas(
    capturas: list[Captura],
) -> tuple[dict[str, ParadaFusionada], dict[tuple[int, int], str]]:
    """Une paradas de distintas capturas a menos de 30 m. Devuelve las paradas y (captura, parada) -> id."""
    grupos: list[ParadaFusionada] = []
    asignado: dict[tuple[int, int], int] = {}
    for ci, c in enumerate(capturas):
        for pi, p in enumerate(c.paradas):
            cercana = min(grupos, key=lambda g: distancia(g.lat, g.lon, p.lat, p.lon), default=None)
            if cercana and distancia(cercana.lat, cercana.lon, p.lat, p.lon) < FUSION_PARADAS_M:
                k = grupos.index(cercana)
                g = cercana
                g.lat = (g.lat * g.n + p.lat) / (g.n + 1)
                g.lon = (g.lon * g.n + p.lon) / (g.n + 1)
            else:
                k = len(grupos)
                g = ParadaFusionada(id="", lat=p.lat, lon=p.lon)
                grupos.append(g)
            g.n += 1
            if p.nombre.strip():
                g.nombres[" ".join(p.nombre.split())] += 1
            asignado[(ci, pi)] = k
    # Identificadores estables: ordenados de norte a sur y de oeste a este.
    orden = sorted(range(len(grupos)), key=lambda i: (-round(grupos[i].lat, 5), round(grupos[i].lon, 5)))
    ids = {}
    for n, i in enumerate(orden, start=1):
        grupos[i].id = f"P{n:03d}"
        ids[i] = grupos[i].id
    return {g.id: g for g in grupos}, {k: ids[v] for k, v in asignado.items()}


def cargar_horarios(ruta: Path = CONFIG / "rutas.csv") -> dict[tuple[str, str], HorarioRuta]:
    if not ruta.exists():
        return {}
    df = pd.read_csv(ruta, dtype=str, keep_default_na=False)
    hs = [HorarioRuta.model_validate(f) for f in df.to_dict("records")]
    return {(clave(h.ruta), h.sentido): h for h in hs}


def procesar(
    capturas: list[tuple[str, Captura]],
    descartes: list[Descarte],
    horarios: dict[tuple[str, str], HorarioRuta],
    archivos_leidos: int,
    marca: str | None = None,
    hoy: date | None = None,
) -> Resultado:
    hoy = hoy or datetime.now(UTC).date()
    sin_permiso = [a for a, c in capturas if c.permiso != "si"]
    if sin_permiso:
        descartes = [*descartes, Descarte(motivo="sin permiso de la ATTT confirmado", n=len(sin_permiso))]
    con_permiso = [(a, c) for a, c in capturas if c.permiso == "si"]
    limpias = [limpiar(a, c) for a, c in con_permiso]
    cortas = [x for x in limpias if len(x.traza) < 2]
    if cortas:
        descartes = [
            *descartes,
            Descarte(
                motivo="traza con menos de 2 puntos válidos",
                n=len(cortas),
                detalle=[x.archivo for x in cortas],
            ),
        ]
    limpias = [x for x in limpias if len(x.traza) >= 2]

    paradas, id_parada = fusionar_paradas([x.captura for x in limpias])
    por_ruta: dict[tuple[str, str], list[int]] = {}
    for i, x in enumerate(limpias):
        por_ruta.setdefault((clave(x.captura.ruta), x.captura.sentido), []).append(i)

    rutas: list[Ruta] = []
    for (k, sentido), idx in sorted(por_ruta.items()):
        # La traza más completa: la más larga después de limpiar.
        mejor_i = max(idx, key=lambda i: (limpias[i].largo_m, limpias[i].captura.fin))
        mejor = limpias[mejor_i].captura
        secuencia: list[str] = []
        tiempos: list[int] = []
        t0 = None
        for pi, p in sorted(enumerate(mejor.paradas), key=lambda x: x[1].t):
            pid = id_parada[(mejor_i, pi)]
            if secuencia and secuencia[-1] == pid:
                continue
            t0 = t0 or p.t
            secuencia.append(pid)
            tiempos.append(max(int((p.t - t0).total_seconds()), tiempos[-1] if tiempos else 0))
        ultima = max(limpias[i].captura.fin for i in idx)
        rutas.append(
            Ruta(
                id=f"{slug(mejor.ruta)}-{sentido}",
                ruta=mejor.ruta.strip(),
                sentido=sentido,
                operador=mejor.operador.strip(),
                tarifa_usd=mejor.tarifa_usd,
                traza=limpias[mejor_i].traza,
                paradas=secuencia,
                tiempos=tiempos,
                capturas=len(idx),
                ultima_captura=ultima.date(),
                horario=horarios.get((k, sentido)),
            )
        )
    usadas = {p for r in rutas for p in r.paradas}
    paradas = {k: v for k, v in paradas.items() if k in usadas}

    meta = Meta(
        marca=marca,
        fecha_proceso=hoy.isoformat(),
        archivos_leidos=archivos_leidos,
        capturas_validas=len(capturas),
        rutas=[
            RutaMeta(
                id=r.id,
                ruta=r.ruta,
                sentido=r.sentido,
                operador=r.operador,
                tarifa_usd=r.tarifa_usd,
                sector=r.horario.sector if r.horario else "Sin sector",
                paradas=len(r.paradas),
                capturas=r.capturas,
                ultima_captura=r.ultima_captura.isoformat(),
                en_gtfs=gtfs.publicable(r),
            )
            for r in rutas
        ],
        descartes=descartes,
        puntos_leidos=sum(len(c.puntos) for _, c in con_permiso),
        puntos_descartados_precision=sum(x.descartados_precision for x in limpias + cortas),
        puntos_descartados_salto=sum(x.descartados_salto for x in limpias + cortas),
        validacion_gtfs=[],
    )
    return Resultado(rutas=rutas, paradas=paradas, meta=meta)


def geojson(r: Resultado) -> tuple[dict, dict]:
    sector = {m.id: m.sector for m in r.meta.rutas}
    rutas = {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "id": x.id,
                "properties": {
                    "id": x.id,
                    "ruta": x.ruta,
                    "sentido": x.sentido,
                    "operador": x.operador,
                    "tarifa_usd": x.tarifa_usd,
                    "sector": sector[x.id],
                    "paradas": x.paradas,
                    "ultima_captura": x.ultima_captura.isoformat(),
                },
                "geometry": {
                    "type": "LineString",
                    "coordinates": [[round(lon, 6), round(lat, 6)] for lat, lon in x.traza],
                },
            }
            for x in r.rutas
        ],
    }
    rutas_de: dict[str, list[str]] = {}
    for x in r.rutas:
        for p in x.paradas:
            rutas_de.setdefault(p, []).append(x.id)
    paradas = {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "id": p.id,
                "properties": {"id": p.id, "nombre": p.nombre, "rutas": sorted(set(rutas_de.get(p.id, [])))},
                "geometry": {"type": "Point", "coordinates": [round(p.lon, 6), round(p.lat, 6)]},
            }
            for p in sorted(r.paradas.values(), key=lambda p: p.id)
        ],
    }
    return rutas, paradas


def escribir(r: Resultado, destino: Path = PUBLIC_DATA / "rutas", hoy: date | None = None) -> None:
    hoy = hoy or date.fromisoformat(r.meta.fecha_proceso)
    if destino.exists():
        shutil.rmtree(destino)
    destino.mkdir(parents=True)
    zip_ = destino / "gtfs.zip"
    validacion = ["sin GTFS: ninguna ruta tiene horario en config/rutas.csv y dos paradas"]
    if gtfs.escribir(r, zip_, hoy, hasta=hoy + timedelta(days=365)):
        errores = gtfs.validar(zip_)
        if errores:
            shutil.rmtree(destino)
            raise ValueError("El GTFS no pasa la validación:\n  " + "\n  ".join(errores))
        validacion = ["validación interna: 0 errores"]
    rutas, paradas = geojson(r)
    escribir_json(destino / "rutas.geojson", rutas)
    escribir_json(destino / "paradas.geojson", paradas)
    meta = r.meta.model_copy(update={"validacion_gtfs": validacion})
    escribir_json(destino / "meta.json", json.loads(meta.model_dump_json()), compacto=False)
