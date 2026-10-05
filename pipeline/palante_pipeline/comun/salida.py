"""Escritura de las salidas del pipeline hacia web/public/data/."""

import json
from datetime import date
from pathlib import Path
from typing import Any

RAIZ = Path(__file__).resolve().parents[3]
PIPELINE = RAIZ / "pipeline"
RAW = PIPELINE / "data" / "raw"
CONFIG = PIPELINE / "config"
PUBLIC_DATA = RAIZ / "web" / "public" / "data"
FIXTURES = RAIZ / "fixtures"

MESES = [
    "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
]


def fecha_texto(d: date) -> str:
    """5 de octubre de 2026."""
    return f"{d.day} de {MESES[d.month - 1]} de {d.year}"


def escribir_json(ruta: Path, datos: Any, compacto: bool = True) -> None:
    ruta.parent.mkdir(parents=True, exist_ok=True)
    with ruta.open("w", encoding="utf-8", newline="\n") as f:
        if compacto:
            json.dump(datos, f, ensure_ascii=False, separators=(",", ":"))
        else:
            json.dump(datos, f, ensure_ascii=False, indent=2)
        f.write("\n")
