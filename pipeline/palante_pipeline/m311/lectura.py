"""Lectura de los Excel del 311 y perfil de sus columnas.

Las columnas con datos personales (nombre) y texto libre (detalle) se eliminan al leer:
nunca salen de la memoria del proceso ni de pipeline/data/raw/.
"""

from dataclasses import dataclass, field
from pathlib import Path

import pandas as pd

from palante_pipeline.comun.texto import clave

# Clave normalizada del encabezado -> nombre interno.
COLUMNAS = {
    "caso": "caso",
    "razon de estatus": "estado_original",
    "canal": "canal",
    "fecha creacion": "fecha_creacion",
    "ultimo cambio": "ultimo_cambio",
    "servicios": "servicios",
    "corregimiento": "corregimiento_original",
}
PERSONALES = {"nombre"}
TEXTO_LIBRE = {"detalle", "descripcion"}
OBLIGATORIAS = {"caso", "estado_original", "fecha_creacion", "servicios", "corregimiento_original"}


@dataclass
class PerfilColumna:
    nombre: str
    tipo: str
    vacias: int
    distintos: int
    ejemplos: list[str]
    omitida: str = ""


@dataclass
class PerfilArchivo:
    archivo: str
    hoja: str
    filas: int
    columnas: list[PerfilColumna] = field(default_factory=list)


def _tipo(serie: pd.Series) -> str:
    s = serie.dropna().astype(str)
    if s.empty:
        return "vacía"
    if s.str.fullmatch(r"\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?").all():
        return "fecha y hora (texto AAAA-MM-DD hh:mm:ss)"
    if pd.to_numeric(s, errors="coerce").notna().all():
        return "número"
    return "texto"


def perfilar(df: pd.DataFrame, archivo: str, hoja: str) -> PerfilArchivo:
    p = PerfilArchivo(archivo=archivo, hoja=hoja, filas=len(df))
    for c in df.columns:
        k = clave(c)
        omitida = ""
        if k in PERSONALES:
            omitida = "dato personal: se elimina al leer"
        elif k in TEXTO_LIBRE:
            omitida = "texto libre del ciudadano: se elimina al leer"
        ejemplos = [] if omitida else [str(v) for v in df[c].dropna().astype(str).drop_duplicates().head(3)]
        p.columnas.append(
            PerfilColumna(
                nombre=str(c),
                tipo=_tipo(df[c]),
                vacias=int(df[c].isna().sum()),
                distintos=int(df[c].nunique()),
                ejemplos=ejemplos,
                omitida=omitida,
            )
        )
    return p


def leer(archivos: list[Path]) -> tuple[pd.DataFrame, list[PerfilArchivo], int]:
    """Lee todas las hojas de todos los Excel.

    Devuelve las filas sin datos personales, el perfil de cada hoja y el total de filas leídas.
    """
    partes, perfiles, leidas = [], [], 0
    for archivo in sorted(archivos):
        hojas = pd.read_excel(archivo, sheet_name=None, dtype=str)
        for hoja, df in hojas.items():
            df = df.dropna(how="all")
            if df.empty:
                continue
            perfiles.append(perfilar(df, archivo.name, hoja))
            leidas += len(df)
            renombre, quitar = {}, []
            for c in df.columns:
                k = clave(c)
                if k in COLUMNAS:
                    renombre[c] = COLUMNAS[k]
                elif k in PERSONALES or k in TEXTO_LIBRE:
                    quitar.append(c)
            df = df.drop(columns=quitar).rename(columns=renombre)
            faltan = OBLIGATORIAS - set(df.columns)
            if faltan:
                raise ValueError(f"{archivo.name} / {hoja}: faltan columnas {sorted(faltan)}")
            df = df[[c for c in COLUMNAS.values() if c in df.columns]].copy()
            df["archivo"] = archivo.name
            partes.append(df)
    if not partes:
        raise FileNotFoundError("No hay Excel del 311 en pipeline/data/raw/311/")
    return pd.concat(partes, ignore_index=True), perfiles, leidas
