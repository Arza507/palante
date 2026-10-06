"""Escritura y validación básica de un feed GTFS estático.

La validación de aquí es una red de seguridad local (archivos, campos obligatorios, referencias, horas y
coordenadas). El validador oficial de MobilityData corre en CI (necesita Java) y manda sobre esta.
"""

import csv
import io
import re
import zipfile
from datetime import date
from typing import TYPE_CHECKING

from palante_pipeline.comun.texto import slug
from palante_pipeline.rutas.geometria import distancia

if TYPE_CHECKING:
    from palante_pipeline.rutas.proceso import Resultado, Ruta

EDITOR = "Palante"
URL_EDITOR = "https://github.com/Arza507/palante"
ZONA = "America/Panama"
DIAS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]

OBLIGATORIOS = {
    "agency.txt": ["agency_id", "agency_name", "agency_url", "agency_timezone"],
    "routes.txt": ["route_id", "agency_id", "route_long_name", "route_type"],
    "stops.txt": ["stop_id", "stop_name", "stop_lat", "stop_lon"],
    "trips.txt": ["route_id", "service_id", "trip_id", "direction_id", "shape_id"],
    "stop_times.txt": ["trip_id", "arrival_time", "departure_time", "stop_id", "stop_sequence"],
    "calendar.txt": ["service_id", *DIAS, "start_date", "end_date"],
    "shapes.txt": ["shape_id", "shape_pt_lat", "shape_pt_lon", "shape_pt_sequence"],
    "frequencies.txt": ["trip_id", "start_time", "end_time", "headway_secs"],
    "feed_info.txt": ["feed_publisher_name", "feed_publisher_url", "feed_lang"],
}


def publicable(r: "Ruta") -> bool:
    """Entra al GTFS con horario confirmado en config/rutas.csv y al menos dos paradas."""
    return r.horario is not None and len(r.paradas) >= 2


def hora(base: str, segundos: int) -> str:
    h, m = (int(x) for x in base.split(":"))
    t = h * 3600 + m * 60 + segundos
    return f"{t // 3600:02d}:{t % 3600 // 60:02d}:{t % 60:02d}"


def tablas(res: "Resultado", desde: date, hasta: date) -> dict[str, list[dict]]:
    rutas = [r for r in res.rutas if publicable(r)]
    agencias: dict[str, dict] = {}
    t: dict[str, list[dict]] = {k: [] for k in OBLIGATORIOS}
    servicios: dict[str, str] = {}
    usadas: set[str] = set()
    for r in rutas:
        h = r.horario
        assert h is not None
        nombre_ag = r.operador or "Operador sin nombre"
        ag = slug(nombre_ag) or "operador"
        agencias.setdefault(
            ag,
            {
                "agency_id": ag,
                "agency_name": nombre_ag,
                # Los operadores no tienen página propia: se enlaza la de Palante, que publica el feed.
                "agency_url": URL_EDITOR,
                "agency_timezone": ZONA,
                "agency_lang": "es",
            },
        )
        rid = slug(r.ruta)
        if not any(x["route_id"] == rid for x in t["routes.txt"]):
            t["routes.txt"].append(
                {"route_id": rid, "agency_id": ag, "route_long_name": r.ruta, "route_type": "3"}
            )
        servicio = servicios.setdefault(h.dias, f"S{h.dias}")
        trip = r.id
        t["trips.txt"].append(
            {
                "route_id": rid,
                "service_id": servicio,
                "trip_id": trip,
                "trip_headsign": "",
                "direction_id": "0" if r.sentido == "ida" else "1",
                "shape_id": trip,
            }
        )
        for i, (pid, seg) in enumerate(zip(r.paradas, r.tiempos, strict=True), start=1):
            hh = hora(h.inicio, seg)
            t["stop_times.txt"].append(
                {
                    "trip_id": trip,
                    "arrival_time": hh,
                    "departure_time": hh,
                    "stop_id": pid,
                    "stop_sequence": str(i),
                }
            )
            usadas.add(pid)
        t["frequencies.txt"].append(
            {
                "trip_id": trip,
                "start_time": hora(h.inicio, 0),
                "end_time": hora(h.fin, 0),
                "headway_secs": str(h.frecuencia_min * 60),
                "exact_times": "0",
            }
        )
        acumulado = 0.0
        for i, (lat, lon) in enumerate(r.traza, start=1):
            if i > 1:
                acumulado += distancia(*r.traza[i - 2], lat, lon)
            t["shapes.txt"].append(
                {
                    "shape_id": trip,
                    "shape_pt_lat": f"{lat:.6f}",
                    "shape_pt_lon": f"{lon:.6f}",
                    "shape_pt_sequence": str(i),
                    "shape_dist_traveled": f"{acumulado:.1f}",
                }
            )
    t["agency.txt"] = list(agencias.values())
    for pid in sorted(usadas):
        p = res.paradas[pid]
        t["stops.txt"].append(
            {
                "stop_id": pid,
                "stop_name": p.nombre or f"Parada {pid}",
                "stop_lat": f"{p.lat:.6f}",
                "stop_lon": f"{p.lon:.6f}",
            }
        )
    for dias, sid in servicios.items():
        fila = {"service_id": sid}
        fila.update({d: v for d, v in zip(DIAS, dias, strict=True)})
        fila.update({"start_date": desde.strftime("%Y%m%d"), "end_date": hasta.strftime("%Y%m%d")})
        t["calendar.txt"].append(fila)
    t["feed_info.txt"] = [
        {
            "feed_publisher_name": EDITOR,
            "feed_publisher_url": URL_EDITOR,
            "feed_lang": "es",
            "feed_start_date": desde.strftime("%Y%m%d"),
            "feed_end_date": hasta.strftime("%Y%m%d"),
            "feed_version": desde.isoformat(),
            "feed_contact_url": f"{URL_EDITOR}/issues",
        }
    ]
    return t


def escribir(res: "Resultado", destino, desde: date, hasta: date) -> bool:
    """Escribe el zip. Devuelve False (y no escribe) si ninguna ruta tiene horario y dos paradas."""
    t = tablas(res, desde, hasta)
    if not t["trips.txt"]:
        return False
    with zipfile.ZipFile(destino, "w", zipfile.ZIP_DEFLATED) as z:
        for nombre, filas in t.items():
            buf = io.StringIO()
            columnas = list(dict.fromkeys(k for f in filas for k in f))
            w = csv.DictWriter(buf, fieldnames=columnas, lineterminator="\n")
            w.writeheader()
            w.writerows(filas)
            # Fecha fija: el mismo contenido produce el mismo zip.
            info = zipfile.ZipInfo(nombre, date_time=(desde.year, desde.month, desde.day, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            z.writestr(info, buf.getvalue().encode("utf-8"))
    return True


_HORA = re.compile(r"^\d{1,3}:[0-5]\d:[0-5]\d$")


def _seg(h: str) -> int:
    a, b, c = (int(x) for x in h.split(":"))
    return a * 3600 + b * 60 + c


def validar(ruta) -> list[str]:
    """Errores del feed. Lista vacía si pasa."""
    e: list[str] = []
    with zipfile.ZipFile(ruta) as z:
        nombres = set(z.namelist())
        datos: dict[str, list[dict]] = {}
        for archivo, campos in OBLIGATORIOS.items():
            if archivo not in nombres:
                e.append(f"falta {archivo}")
                continue
            filas = list(csv.DictReader(io.StringIO(z.read(archivo).decode("utf-8"))))
            datos[archivo] = filas
            if not filas:
                e.append(f"{archivo} está vacío")
            for i, f in enumerate(filas, start=2):
                for c in campos:
                    if not (f.get(c) or "").strip():
                        e.append(f"{archivo}:{i} sin {c}")
    if e:
        return e

    def ids(archivo, campo):
        return [f[campo] for f in datos[archivo]]

    for archivo, campo in [
        ("agency.txt", "agency_id"),
        ("routes.txt", "route_id"),
        ("stops.txt", "stop_id"),
        ("trips.txt", "trip_id"),
        ("calendar.txt", "service_id"),
    ]:
        v = ids(archivo, campo)
        if len(v) != len(set(v)):
            e.append(f"{archivo}: {campo} repetido")
    ag, rt, st, tr = (
        set(ids(a, c))
        for a, c in [
            ("agency.txt", "agency_id"),
            ("routes.txt", "route_id"),
            ("stops.txt", "stop_id"),
            ("trips.txt", "trip_id"),
        ]
    )
    sv, sh = set(ids("calendar.txt", "service_id")), set(ids("shapes.txt", "shape_id"))
    e += [
        f"routes.txt: agency_id {f['agency_id']} no existe"
        for f in datos["routes.txt"]
        if f["agency_id"] not in ag
    ]
    for f in datos["routes.txt"]:
        if f["route_type"] != "3":
            e.append(f"routes.txt: route_type {f['route_type']} no es bus")
    for f in datos["trips.txt"]:
        if f["route_id"] not in rt:
            e.append(f"trips.txt: route_id {f['route_id']} no existe")
        if f["service_id"] not in sv:
            e.append(f"trips.txt: service_id {f['service_id']} no existe")
        if f["shape_id"] not in sh:
            e.append(f"trips.txt: shape_id {f['shape_id']} no existe")
    for f in datos["stops.txt"]:
        if not (7 <= float(f["stop_lat"]) <= 9.8 and -83.1 <= float(f["stop_lon"]) <= -77.1):
            e.append(f"stops.txt: {f['stop_id']} fuera de Panamá")
    por_viaje: dict[str, list[dict]] = {}
    for f in datos["stop_times.txt"]:
        if f["trip_id"] not in tr:
            e.append(f"stop_times.txt: trip_id {f['trip_id']} no existe")
        if f["stop_id"] not in st:
            e.append(f"stop_times.txt: stop_id {f['stop_id']} no existe")
        if not (_HORA.match(f["arrival_time"]) and _HORA.match(f["departure_time"])):
            e.append(f"stop_times.txt: hora inválida en {f['trip_id']}")
            continue
        por_viaje.setdefault(f["trip_id"], []).append(f)
    for trip in tr:
        filas = sorted(por_viaje.get(trip, []), key=lambda f: int(f["stop_sequence"]))
        if len(filas) < 2:
            e.append(f"{trip}: menos de dos paradas")
        horas = [_seg(f["arrival_time"]) for f in filas]
        if horas != sorted(horas):
            e.append(f"{trip}: las horas retroceden")
    for f in datos["frequencies.txt"]:
        if f["trip_id"] not in tr:
            e.append(f"frequencies.txt: trip_id {f['trip_id']} no existe")
        if _seg(f["end_time"]) <= _seg(f["start_time"]) or int(f["headway_secs"]) <= 0:
            e.append(f"frequencies.txt: intervalo inválido en {f['trip_id']}")
    secuencias: dict[str, list[int]] = {}
    for f in datos["shapes.txt"]:
        secuencias.setdefault(f["shape_id"], []).append(int(f["shape_pt_sequence"]))
    for s, seq in secuencias.items():
        if len(seq) < 2 or seq != sorted(set(seq)):
            e.append(f"shapes.txt: {s} con secuencia inválida")
    for f in datos["calendar.txt"]:
        if f["end_date"] < f["start_date"]:
            e.append(f"calendar.txt: {f['service_id']} termina antes de empezar")
    return e
