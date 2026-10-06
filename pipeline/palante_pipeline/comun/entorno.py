"""Carga variables de .env (raíz del repositorio) sin pisar las que ya existen en el entorno."""

import os
from pathlib import Path

from palante_pipeline.comun.salida import RAIZ


def cargar_env(ruta: Path = RAIZ / ".env") -> None:
    if not ruta.exists():
        return
    for linea in ruta.read_text(encoding="utf-8").splitlines():
        linea = linea.strip()
        if not linea or linea.startswith("#") or "=" not in linea:
            continue
        k, v = linea.split("=", 1)
        os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))
