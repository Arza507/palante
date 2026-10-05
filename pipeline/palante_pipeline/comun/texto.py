"""Normalización de textos para unir nombres de fuentes distintas."""

import re
import unicodedata


def sin_tildes(texto: str) -> str:
    """Quita tildes y diéresis, pero conserva la ñ."""
    texto = texto.replace("ñ", "\0n").replace("Ñ", "\0N")
    descompuesto = unicodedata.normalize("NFD", texto)
    limpio = "".join(c for c in descompuesto if unicodedata.category(c) != "Mn")
    return limpio.replace("\0n", "ñ").replace("\0N", "Ñ")


def clave(texto: str | None) -> str:
    """Clave de comparación: minúsculas, sin tildes, sin signos y con espacios simples."""
    if texto is None:
        return ""
    t = sin_tildes(str(texto)).lower().replace("ñ", "n")
    t = re.sub(r"[^a-z0-9]+", " ", t)
    return re.sub(r"\s+", " ", t).strip()


def slug(texto: str) -> str:
    """Identificador para URL: 'Bella Vista' -> 'bella-vista', 'Las Mañanitas' -> 'las-mananitas'."""
    return clave(texto).replace(" ", "-")
