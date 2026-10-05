"""Descarga los Excel del 311 de la Alcaldía de Panamá (todos los trimestres del conjunto)."""

import json
from pathlib import Path

from palante_pipeline.comun import ckan
from palante_pipeline.comun.salida import RAW

CONJUNTO = "alcaldia-de-panama-detalle-de-casos-reportados-al-311-2026"
DESTINO = RAW / "311"


def descargar_todo(forzar: bool = False) -> list[Path]:
    c = ckan.conjunto(CONJUNTO)
    archivos = []
    for r in c.recursos:
        if r.formato not in ("XLSX", "XLS"):
            continue
        nombre = Path(r.url.split("?")[0]).name
        destino = DESTINO / nombre
        if forzar or not destino.exists():
            print(f"Descargando {r.nombre} ({nombre})")
            ckan.descargar(r.url, destino)
        archivos.append(destino)
    (DESTINO / "_conjunto.json").write_text(
        json.dumps(
            {
                "id": c.id,
                "titulo": c.titulo,
                "licencia": c.licencia,
                "url": c.url,
                "modificado": c.modificado,
                "recursos": [r.__dict__ for r in c.recursos if r.formato in ("XLSX", "XLS")],
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )
    return archivos
