"""Descarga los Excel del 311 de la Alcaldía de Panamá: todos los años y trimestres publicados.

Busca en el portal, dentro de la organización de la Alcaldía (municipio-de-panama), los conjuntos
"Detalle de Casos Reportados al 311" de cualquier año. Los otros conjuntos del 311 de la Alcaldía
son conteos mensuales de esos mismos casos y no se suman: se contarían dos veces.
"""

import json
import re
from pathlib import Path

from palante_pipeline.comun import ckan
from palante_pipeline.comun.salida import RAW
from palante_pipeline.comun.texto import clave

ORGANIZACION = "municipio-de-panama"
# Conjunto citado en SPEC.md; siempre se incluye aunque la búsqueda no lo devuelva.
CONJUNTO = "alcaldia-de-panama-detalle-de-casos-reportados-al-311-2026"
PATRON = re.compile(r"detalle de casos reportados al 311")
DESTINO = RAW / "311"
INDICE = DESTINO / "_conjuntos.json"


def nombres_conjuntos() -> list[str]:
    encontrados = {n for n, t in ckan.buscar(ORGANIZACION, "311") if PATRON.search(clave(t))}
    return sorted(encontrados | {CONJUNTO}, reverse=True)


def descargar_todo(forzar: bool = False) -> list[Path]:
    archivos, indice = [], []
    for nombre in nombres_conjuntos():
        c = ckan.conjunto(nombre)
        recursos = [r for r in c.recursos if r.formato in ("XLSX", "XLS")]
        for r in recursos:
            archivo = Path(r.url.split("?")[0]).name
            destino = DESTINO / archivo
            if forzar or not destino.exists():
                print(f"Descargando {r.nombre} ({archivo})")
                ckan.descargar(r.url, destino)
            archivos.append(destino)
        indice.append(
            {
                "id": c.id,
                "titulo": c.titulo,
                "licencia": c.licencia,
                "url": c.url,
                "modificado": c.modificado,
                "recursos": [{**r.__dict__, "archivo": Path(r.url.split("?")[0]).name} for r in recursos],
            }
        )
    INDICE.write_text(json.dumps(indice, ensure_ascii=False, indent=2), encoding="utf-8")
    viejo = DESTINO / "_conjunto.json"
    if viejo.exists():
        viejo.unlink()
    return archivos
