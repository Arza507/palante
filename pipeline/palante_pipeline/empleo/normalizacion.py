"""Normaliza los nombres de habilidades y herramientas.

Orden: primero config/sinonimos_habilidades.csv (correcciones manuales), luego las etiquetas en español
de ESCO si existe el archivo oficial skills_es.csv en raw/empleo/esco/. Lo que no coincide se deja como
lo escribió la extracción, con la primera letra en mayúscula.
"""

from dataclasses import dataclass
from pathlib import Path

import pandas as pd

from palante_pipeline.comun.salida import CONFIG, RAW
from palante_pipeline.comun.texto import clave

ESCO = RAW / "empleo" / "esco" / "skills_es.csv"


@dataclass
class Normalizador:
    sinonimos: dict[str, str]
    # clave -> (etiqueta preferida, URI de ESCO)
    esco: dict[str, tuple[str, str]]

    @property
    def esco_disponible(self) -> bool:
        return bool(self.esco)

    def __call__(self, texto: str) -> tuple[str, str | None]:
        """Nombre normalizado y URI de ESCO, si la hay."""
        t = " ".join(str(texto).split()).strip(" .;,")
        if not t:
            return "", None
        nombre = self.sinonimos.get(clave(t), t)
        hallado = self.esco.get(clave(nombre))
        if hallado:
            nombre, uri = hallado
            return nombre[:1].upper() + nombre[1:], uri
        return nombre[:1].upper() + nombre[1:], None


def cargar_esco(ruta: Path = ESCO) -> dict[str, tuple[str, str]]:
    """Lee el CSV oficial de ESCO (columnas conceptUri, preferredLabel y altLabels)."""
    if not ruta.exists():
        return {}
    df = pd.read_csv(ruta, dtype=str, keep_default_na=False)
    mapa: dict[str, tuple[str, str]] = {}
    for uri, pref, alt in zip(df["conceptUri"], df["preferredLabel"], df.get("altLabels", ""), strict=False):
        if not pref:
            continue
        mapa.setdefault(clave(pref), (pref, uri))
        for a in str(alt or "").split("\n"):
            if a.strip():
                mapa.setdefault(clave(a), (pref, uri))
    return mapa


def cargar(carpeta: Path = CONFIG, esco: Path = ESCO) -> Normalizador:
    sin = pd.read_csv(carpeta / "sinonimos_habilidades.csv", dtype=str, keep_default_na=False)
    return Normalizador(
        sinonimos={clave(a): b.strip() for a, b in zip(sin["texto"], sin["habilidad"], strict=True)},
        esco=cargar_esco(esco),
    )
