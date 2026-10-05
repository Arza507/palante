"""Comando del módulo 311: uv run python -m palante_pipeline 311 [--descargar]"""

import json
from argparse import Namespace

from palante_pipeline.comun.salida import RAW
from palante_pipeline.m311 import descarga, geo, poblacion, proceso


def main(args: Namespace) -> None:
    carpeta = RAW / "311"
    archivos = sorted(carpeta.glob("*.xls*"))
    if args.descargar or not archivos:
        archivos = descarga.descargar_todo()
    if args.descargar or not geo.ARCHIVO.exists():
        geo.descargar()
    conjunto = json.loads((carpeta / "_conjunto.json").read_text(encoding="utf-8"))

    poligonos, meta_geo = geo.corregimientos()
    if not poblacion.PLANTILLA.exists():
        poblacion.escribir_plantilla(list(poligonos["nombre"]))
    pob = poblacion.leer()

    resultado, perfiles = proceso.procesar(
        archivos, poligonos, proceso.cargar_config(), conjunto, meta_geo["fecha_osm"], pob
    )
    proceso.escribir(resultado, proceso.topologia(poligonos))
    proceso.escribir_documentacion(perfiles, resultado)

    m = resultado.meta
    print(f"311: {m.filas_leidas} filas leídas, {m.filas_validas} válidas.")
    for d in m.filas_descartadas:
        print(f"  Descartadas por {d.motivo}: {d.filas} {d.detalle}")
    if m.servicios_sin_categoria:
        print(f"  Servicios sin categoría (van a Otros): {m.servicios_sin_categoria}")
    print(f"  Población: {'sí' if m.poblacion_disponible else 'no'}")
