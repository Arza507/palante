"""Lectura y validación de ofertas.csv: rechaza filas inválidas y elimina duplicados."""

from collections import Counter
from dataclasses import dataclass, field
from pathlib import Path

import pandas as pd
from pydantic import ValidationError

from palante_pipeline.comun.texto import clave
from palante_pipeline.empleo.modelo import Oferta

COLUMNAS = [
    "id",
    "fecha_publicacion",
    "fuente",
    "url",
    "titulo",
    "empresa",
    "provincia",
    "sector",
    "salario_min",
    "salario_max",
    "texto",
    "fecha_recoleccion",
]
DIAS_DUPLICADO = 7


@dataclass
class Lectura:
    ofertas: list[Oferta]
    filas_leidas: int
    descartes: Counter = field(default_factory=Counter)


def leer(ruta: Path, sectores: set[str], provincias: dict[str, str]) -> Lectura:
    """Lee el CSV. `provincias` va de clave sin tildes al nombre oficial."""
    df = pd.read_csv(ruta, dtype=str, keep_default_na=False, encoding="utf-8")
    faltan = [c for c in COLUMNAS if c not in df.columns]
    if faltan:
        raise ValueError(f"{ruta.name} no tiene las columnas {faltan}. Usa ofertas-plantilla.csv.")
    descartes: Counter = Counter()
    validas: list[Oferta] = []
    ids: set[str] = set()
    for fila in df.to_dict("records"):
        if not str(fila.get("texto", "")).strip():
            descartes["sin texto de la oferta"] += 1
            continue
        try:
            o = Oferta.model_validate(fila)
        except ValidationError:
            descartes["fila con datos inválidos (fecha, salario o texto muy corto)"] += 1
            continue
        if o.sector not in sectores:
            descartes["sector fuera de config/sectores.csv"] += 1
            continue
        prov = provincias.get(clave(o.provincia))
        if prov is None:
            descartes["provincia desconocida"] += 1
            continue
        if o.id in ids:
            descartes["id repetido"] += 1
            continue
        ids.add(o.id)
        validas.append(o.model_copy(update={"provincia": prov}))
    sin_dup, n_dup = quitar_duplicados(validas)
    if n_dup:
        descartes[f"oferta duplicada (mismo título y empresa a menos de {DIAS_DUPLICADO} días)"] += n_dup
    return Lectura(ofertas=sin_dup, filas_leidas=len(df), descartes=descartes)


def quitar_duplicados(ofertas: list[Oferta]) -> tuple[list[Oferta], int]:
    """Misma oferta publicada dos veces: título y empresa normalizados, a menos de 7 días.

    Se queda la primera publicación. Sin empresa, el título solo no basta para declarar duplicado.
    """
    ordenadas = sorted(ofertas, key=lambda o: (o.fecha_publicacion, o.id))
    ultimas: dict[tuple[str, str], Oferta] = {}
    quedan: list[Oferta] = []
    repetidas = 0
    for o in ordenadas:
        if not o.empresa:
            quedan.append(o)
            continue
        k = (clave(o.titulo), clave(o.empresa))
        previa = ultimas.get(k)
        if previa and (o.fecha_publicacion - previa.fecha_publicacion).days < DIAS_DUPLICADO:
            repetidas += 1
            continue
        ultimas[k] = o
        quedan.append(o)
    return quedan, repetidas
