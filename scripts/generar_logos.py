"""Genera las tres variantes del logo de Palante en design/logo/.

Arco chato del Casco Antiguo con una flecha hacia la derecha debajo, junto a "Palante" en Fraunces.
La palabra se convierte a trazos para que el SVG no dependa de fuentes instaladas.
Uso: uv run --project pipeline --group fuentes python scripts/generar_logos.py
"""

from pathlib import Path

from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont

RAIZ = Path(__file__).resolve().parents[1]
DESTINO = RAIZ / "design/logo"
FUENTE = RAIZ / "web/src/og/fraunces-600.ttf"

CAL, HIERRO, TERRACOTA, PERSIANA = "#FBF6EE", "#2A2623", "#B5452F", "#2E6B62"

# Arco chato: banda entre dos curvas casi planas.
ARCO = "M6 22Q32 12 58 22V31Q32 22 6 31Z"
FLECHA = "M14 46H46M38 38l9 8-9 8"


def curva(t: float, y0: float, yc: float) -> tuple[float, float]:
    """Punto de la cuadrática (6,y0)-(32,yc)-(58,y0)."""
    x = (1 - t) ** 2 * 6 + 2 * (1 - t) * t * 32 + t**2 * 58
    y = (1 - t) ** 2 * y0 + 2 * (1 - t) * t * yc + t**2 * y0
    return round(x, 1), round(y, 1)


def dovelas(n: int = 5, junta: float = 0.012) -> str:
    partes = []
    for i in range(n):
        a, b = i / n + (junta if i else 0), (i + 1) / n - (junta if i < n - 1 else 0)
        pts = [curva(t, 22, 12) for t in (a, (a + b) / 2, b)]
        pts += [curva(t, 31, 22) for t in (b, (a + b) / 2, a)]
        partes.append("M" + "L".join(f"{x} {y}" for x, y in pts) + "Z")
    return "".join(partes)


def palabra(texto: str, tam: float, x0: float, base: float) -> str:
    fuente = TTFont(FUENTE)
    cmap, glifos = fuente.getBestCmap(), fuente.getGlyphSet()
    escala = tam / fuente["head"].unitsPerEm
    pen = SVGPathPen(glifos, ntos=lambda v: f"{v:.1f}".rstrip("0").rstrip("."))
    x = 0.0
    for c in texto:
        nombre = cmap[ord(c)]
        glifos[nombre].draw(
            TransformPen(pen, (escala, 0, 0, -escala, x0 + x * escala, base))
        )
        x += fuente["hmtx"][nombre][0]
    return pen.getCommands(), x0 + x * escala


def svg(ancho: float, contenido: str, titulo: str) -> str:
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {ancho:.0f} 64" '
        f'role="img" aria-label="{titulo}"><title>{titulo}</title>{contenido}</svg>\n'
    )


def icono(variante: str, mono: bool) -> str:
    c = "currentColor"
    if variante == "a":
        if mono:
            return f'<path d="{ARCO}" fill="{c}"/><path d="{FLECHA}" fill="none" stroke="{c}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>'
        return (
            f'<rect width="64" height="64" rx="14" fill="{TERRACOTA}"/>'
            f'<path d="{ARCO}" fill="{CAL}"/>'
            f'<path d="{FLECHA}" fill="none" stroke="{CAL}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>'
        )
    if variante == "b":
        return (
            f'<path d="{dovelas()}" fill="{c if mono else TERRACOTA}"/>'
            f'<path d="{FLECHA}" fill="none" stroke="{c if mono else PERSIANA}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>'
        )
    return (
        f'<path d="{ARCO}" fill="none" stroke="{c if mono else HIERRO}" stroke-width="3.5" stroke-linejoin="round"/>'
        f'<path d="{FLECHA}" fill="none" stroke="{c if mono else TERRACOTA}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>'
    )


def main() -> None:
    DESTINO.mkdir(parents=True, exist_ok=True)
    trazo, fin = palabra("Palante", 40, 76, 45)
    nombres = {"a": "Sello", "b": "Dovelas", "c": "Trazo"}
    for v, nombre in nombres.items():
        (DESTINO / f"palante-{v}-icono.svg").write_text(
            svg(64, icono(v, False), "Palante"), "utf8"
        )
        (DESTINO / f"palante-{v}.svg").write_text(
            svg(
                fin + 4,
                icono(v, False) + f'<path d="{trazo}" fill="{HIERRO}"/>',
                "Palante",
            ),
            "utf8",
        )
        (DESTINO / f"palante-{v}-mono.svg").write_text(
            svg(
                fin + 4,
                icono(v, True) + f'<path d="{trazo}" fill="currentColor"/>',
                "Palante",
            ),
            "utf8",
        )
        print(f"Variante {v.upper()} ({nombre}) generada")


if __name__ == "__main__":
    main()
