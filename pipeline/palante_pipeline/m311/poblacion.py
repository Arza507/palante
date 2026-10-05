"""Población por corregimiento del censo del INEC (opcional).

Si existe pipeline/data/raw/poblacion/poblacion_corregimientos.csv, el mapa usa reportes por cada
10.000 habitantes. Si no, muestra conteos absolutos con una nota visible.
Formato: corregimiento,poblacion,censo,fuente_url (ver poblacion-plantilla.csv).
"""

from dataclasses import dataclass
from pathlib import Path

import pandas as pd

from palante_pipeline.comun.salida import RAW
from palante_pipeline.comun.texto import clave

ARCHIVO = RAW / "poblacion" / "poblacion_corregimientos.csv"
PLANTILLA = RAW / "poblacion" / "poblacion-plantilla.csv"


@dataclass
class Poblacion:
    por_clave: dict[str, int]
    censo: str
    url: str


def escribir_plantilla(nombres: list[str]) -> None:
    PLANTILLA.parent.mkdir(parents=True, exist_ok=True)
    pd.DataFrame({"corregimiento": nombres, "poblacion": "", "censo": "2023", "fuente_url": ""}).to_csv(
        PLANTILLA, index=False, encoding="utf-8"
    )


def leer(archivo: Path = ARCHIVO) -> Poblacion | None:
    if not archivo.exists():
        return None
    df = pd.read_csv(archivo, dtype=str).dropna(subset=["corregimiento", "poblacion"])
    df = df[df["poblacion"].str.strip() != ""]
    if df.empty:
        return None
    if "FIXTURE" in archivo.read_text(encoding="utf-8"):
        raise ValueError(f"{archivo} tiene datos de prueba; la población real sale solo del INEC")
    valores = {
        clave(r.corregimiento): int(str(r.poblacion).replace(".", "").replace(",", ""))
        for r in df.itertuples()
    }
    return Poblacion(
        por_clave=valores,
        censo=str(df["censo"].iloc[0]) if "censo" in df else "",
        url=str(df["fuente_url"].iloc[0]) if "fuente_url" in df else "",
    )
