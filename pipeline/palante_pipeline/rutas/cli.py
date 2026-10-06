"""Comando del módulo de rutas: uv run python -m palante_pipeline rutas

Lee las capturas de pipeline/data/raw/rutas/*.json y escribe web/public/data/rutas/.
Sin capturas no escribe nada: la página /rutas sigue oculta.
"""

from argparse import Namespace

from palante_pipeline.comun.salida import RAW
from palante_pipeline.rutas import proceso

CARPETA = RAW / "rutas"


def main(args: Namespace) -> None:
    archivos = sorted(CARPETA.glob("*.json"))
    if not archivos:
        print("Rutas: no hay capturas en raw/rutas/; no se publica nada.")
        return
    capturas, descartes = proceso.leer(CARPETA)
    r = proceso.procesar(capturas, descartes, proceso.cargar_horarios(), len(archivos))
    m = r.meta
    print(
        f"Rutas: {m.archivos_leidos} archivos, {m.capturas_validas} capturas válidas, "
        f"{len(r.rutas)} rutas con permiso."
    )
    print(
        f"  Puntos: {m.puntos_leidos} leídos, {m.puntos_descartados_precision} por precisión, "
        f"{m.puntos_descartados_salto} por saltos."
    )
    for d in m.descartes:
        print(f"  Descartadas por {d.motivo}: {d.n}")
    for x in m.rutas:
        if not x.en_gtfs:
            print(
                f"  {x.ruta} ({x.sentido}): fuera del GTFS hasta tener horario en config/rutas.csv "
                "y dos paradas."
            )
    if not r.rutas:
        print("  Ninguna ruta con permiso: no se publica nada.")
        return
    proceso.escribir(r)
    print("  Publicado en web/public/data/rutas/.")
