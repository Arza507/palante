"""Genera capturas de rutas de prueba (marca FIXTURE). Todo es inventado.

Uso (desde pipeline/): uv run python ../fixtures/generar_fixtures_rutas.py

- fixtures/rutas/capturas/*.json: capturas con el formato de la app (SPEC.md, sección 8).
  - Ruta FIXTURE Uno, ida: dos capturas (una de 30 minutos y otra más corta) con paradas a menos de 30 m.
  - Ruta FIXTURE Uno, vuelta: una captura.
  - Ruta FIXTURE Dos: permiso "no"; nunca se publica.
  - Ruta FIXTURE Tres: permiso "si" pero sin horario en la configuración; sale en el mapa, no en el GTFS.
  - mala.json: archivo que no cumple el esquema.
- fixtures/rutas/rutas-fixture.csv: horarios de prueba (config/rutas.csv).
- fixtures/web/data/rutas/: salidas del pipeline para probar la web con PUBLIC_RUTAS=true.
"""

import json
import math
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

from palante_pipeline.rutas import proceso

AQUI = Path(__file__).resolve().parent
CAPTURAS = AQUI / "rutas" / "capturas"
WEB = AQUI / "web" / "data" / "rutas"
PANAMA = timezone(timedelta(hours=-5))

# Recorrido inventado en el oeste de la ciudad: vértices (lat, lon).
RECORRIDO_UNO = [
    (8.9800, -79.5600),
    (8.9850, -79.5550),
    (8.9900, -79.5560),
    (8.9960, -79.5500),
    (9.0020, -79.5480),
]
RECORRIDO_TRES = [(9.0300, -79.4800), (9.0350, -79.4750), (9.0400, -79.4760)]


def interpolar(vertices, n):
    """n puntos repartidos a lo largo de la línea."""
    tramos = list(zip(vertices, vertices[1:], strict=False))
    largos = [math.dist(a, b) for a, b in tramos]
    total = sum(largos)
    puntos = []
    for i in range(n):
        d = total * i / (n - 1)
        for (a, b), lg in zip(tramos, largos, strict=True):
            if d <= lg or (a, b) == tramos[-1]:
                f = min(1.0, d / lg) if lg else 0
                puntos.append((a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f))
                break
            d -= lg
    return puntos


def captura(ruta, sentido, permiso, vertices, inicio, minutos, paradas_en, desvio=0.0, ruido=False):
    n = minutos * 60 // 5 + 1
    pts = interpolar(vertices if sentido == "ida" else vertices[::-1], n)
    puntos = []
    for i, (lat, lon) in enumerate(pts):
        t = inicio + timedelta(seconds=5 * i)
        precision = 8.0
        if ruido and i % 40 == 7:
            precision = 75.0  # peor que 50 m: se descarta
        if ruido and i == 100:
            lat += 0.05  # salto de unos 5,5 km en 5 s: se descarta
        puntos.append(
            {
                "t": t.isoformat(),
                "lat": round(lat + desvio, 6),
                "lon": round(lon, 6),
                "precision_m": precision,
            }
        )
    paradas = []
    for k, frac in enumerate(paradas_en):
        i = int(frac * (n - 1))
        p = puntos[i]
        paradas.append(
            {
                "t": p["t"],
                "lat": round(pts[i][0] + desvio, 6),
                "lon": p["lon"],
                "nombre": f"Parada FIXTURE {k + 1}" if desvio == 0 else "",
            }
        )
    return {
        "version": 1,
        "voluntario": "FIX-01",
        "ruta": ruta,
        "operador": "Cooperativa FIXTURE",
        "tarifa_usd": 0.5,
        "sentido": sentido,
        "permiso": permiso,
        "inicio": inicio.isoformat(),
        "fin": (inicio + timedelta(minutes=minutos)).isoformat(),
        "puntos": puntos,
        "paradas": paradas,
    }


def main() -> None:
    CAPTURAS.mkdir(parents=True, exist_ok=True)
    for p in CAPTURAS.glob("*.json"):
        p.unlink()
    dia = datetime(2026, 9, 14, 7, 0, tzinfo=PANAMA)
    paradas = [0, 0.25, 0.5, 0.75, 1]
    archivos = {
        "uno-ida-a.json": captura(
            "Ruta FIXTURE Uno", "ida", "si", RECORRIDO_UNO, dia, 30, paradas, ruido=True
        ),
        # Segunda captura: termina antes y sus paradas están corridas unos 11 m (se fusionan).
        "uno-ida-b.json": captura(
            "Ruta FIXTURE Uno",
            "ida",
            "si",
            RECORRIDO_UNO[:4],
            dia + timedelta(days=2),
            20,
            [0, 0.33, 0.66],
            desvio=0.0001,
        ),
        "uno-vuelta.json": captura(
            "Ruta FIXTURE Uno", "vuelta", "si", RECORRIDO_UNO, dia + timedelta(hours=1), 28, paradas
        ),
        "dos-ida.json": captura("Ruta FIXTURE Dos", "ida", "no", RECORRIDO_TRES, dia, 10, [0, 1]),
        "tres-ida.json": captura(
            "Ruta FIXTURE Tres", "ida", "si", RECORRIDO_TRES, dia + timedelta(days=1), 12, [0, 0.5, 1]
        ),
    }
    for nombre, datos in archivos.items():
        (CAPTURAS / nombre).write_text(
            json.dumps(datos, ensure_ascii=False, indent=1) + "\n", encoding="utf-8"
        )
    (CAPTURAS / "mala.json").write_text('{"version": 1, "ruta": "FIXTURE sin puntos"}\n', encoding="utf-8")
    (AQUI / "rutas" / "rutas-fixture.csv").write_text(
        "ruta,sentido,sector,dias,inicio,fin,frecuencia_min\n"
        "Ruta FIXTURE Uno,ida,Sector FIXTURE Oeste,1111110,05:30,21:00,15\n"
        "Ruta FIXTURE Uno,vuelta,Sector FIXTURE Oeste,1111110,06:00,21:30,15\n"
        "Ruta FIXTURE Dos,ida,Sector FIXTURE Norte,1111111,06:00,20:00,20\n",
        encoding="utf-8",
    )
    capturas, descartes = proceso.leer(CAPTURAS)
    r = proceso.procesar(
        capturas,
        descartes,
        proceso.cargar_horarios(AQUI / "rutas" / "rutas-fixture.csv"),
        len(list(CAPTURAS.glob("*.json"))),
        marca="FIXTURE",
        hoy=date(2026, 10, 5),
    )
    proceso.escribir(r, WEB)
    print(f"Fixtures de rutas: {len(archivos) + 1} capturas; web con {len(r.rutas)} rutas.")


if __name__ == "__main__":
    main()
