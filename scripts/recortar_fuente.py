"""Recorta Fraunces a un solo WOFF2 variable (peso 500-700, latín y español).

Uso: uv run --project pipeline --group fuentes python scripts/recortar_fuente.py <Fraunces.ttf>
Fuente: https://github.com/google/fonts/tree/main/ofl/fraunces (licencia OFL 1.1).
"""

import sys
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

LIMITE_BYTES = 40 * 1024
RAIZ = Path(__file__).resolve().parents[1]
SALIDA = RAIZ / "web/public/fonts/fraunces-palante.woff2"
# Instancia estática para el build (imágenes para compartir y logos); no se sirve al teléfono.
SALIDA_ESTATICA = RAIZ / "web/src/og/fraunces-600.ttf"

# ASCII imprimible, Latin-1 (tildes, ñ, ¿, ¡, °, «») y puntuación tipográfica común.
UNICODES = (
    list(range(0x20, 0x7F))
    + list(range(0xA0, 0x100))
    + [0x2013, 0x2014, 0x2018, 0x2019, 0x201C, 0x201D, 0x2026, 0x20AC, 0x2192]
)


def recortar(fuente: TTFont, flavor: str | None) -> None:
    opciones = subset.Options()
    opciones.flavor = flavor
    opciones.layout_features = ["kern", "liga", "calt", "ccmp", "locl", "mark", "mkmk"]
    opciones.name_IDs = [
        0,
        1,
        2,
        3,
        4,
        5,
        6,
        13,
        14,
    ]  # conserva copyright y licencia OFL
    opciones.notdef_outline = True
    opciones.hinting = False
    opciones.desubroutinize = True
    sub = subset.Subsetter(opciones)
    sub.populate(unicodes=UNICODES)
    sub.subset(fuente)


def main(origen: str) -> None:
    estatica = instancer.instantiateVariableFont(
        TTFont(origen), {"opsz": 72, "SOFT": 0, "WONK": 0, "wght": 600}
    )
    recortar(estatica, None)
    SALIDA_ESTATICA.parent.mkdir(parents=True, exist_ok=True)
    estatica.save(SALIDA_ESTATICA)
    print(f"{SALIDA_ESTATICA.name}: {SALIDA_ESTATICA.stat().st_size} bytes")

    fuente = TTFont(origen)
    fuente = instancer.instantiateVariableFont(
        fuente, {"opsz": 72, "SOFT": 0, "WONK": 0, "wght": (500, 700)}
    )
    recortar(fuente, "woff2")
    SALIDA.parent.mkdir(parents=True, exist_ok=True)
    fuente.flavor = "woff2"
    fuente.save(SALIDA)
    tam = SALIDA.stat().st_size
    print(f"{SALIDA.name}: {tam} bytes ({tam / 1024:.1f} KB)")
    if tam > LIMITE_BYTES:
        sys.exit(f"Supera el límite de {LIMITE_BYTES} bytes")


if __name__ == "__main__":
    main(sys.argv[1])
