"""Distancias y simplificación de trazas GPS en metros, sin dependencias externas."""

import math

RADIO = 6_371_008.8


def distancia(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Distancia en metros (haversine)."""
    f1, f2 = math.radians(lat1), math.radians(lat2)
    df = f2 - f1
    dl = math.radians(lon2 - lon1)
    a = math.sin(df / 2) ** 2 + math.cos(f1) * math.cos(f2) * math.sin(dl / 2) ** 2
    return 2 * RADIO * math.asin(math.sqrt(a))


def _a_metros(puntos: list[tuple[float, float]]) -> list[tuple[float, float]]:
    """Proyección equirectangular local: suficiente para trazas de pocos kilómetros."""
    lat0 = math.radians(sum(p[0] for p in puntos) / len(puntos))
    return [(math.radians(lon) * RADIO * math.cos(lat0), math.radians(lat) * RADIO) for lat, lon in puntos]


def _dist_segmento(p, a, b) -> float:
    (px, py), (ax, ay), (bx, by) = p, a, b
    dx, dy = bx - ax, by - ay
    if dx == dy == 0:
        return math.hypot(px - ax, py - ay)
    t = max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)))
    return math.hypot(px - (ax + t * dx), py - (ay + t * dy))


def simplificar(puntos: list[tuple[float, float]], tolerancia_m: float = 10.0) -> list[tuple[float, float]]:
    """Ramer-Douglas-Peucker en metros. Recibe y devuelve (lat, lon). Iterativo, sin recursión."""
    if len(puntos) < 3:
        return list(puntos)
    m = _a_metros(puntos)
    conservar = [False] * len(puntos)
    conservar[0] = conservar[-1] = True
    pila = [(0, len(puntos) - 1)]
    while pila:
        i, j = pila.pop()
        peor, k = 0.0, -1
        for x in range(i + 1, j):
            d = _dist_segmento(m[x], m[i], m[j])
            if d > peor:
                peor, k = d, x
        if peor > tolerancia_m:
            conservar[k] = True
            pila += [(i, k), (k, j)]
    return [p for p, c in zip(puntos, conservar, strict=True) if c]


def largo(puntos: list[tuple[float, float]]) -> float:
    return sum(distancia(*a, *b) for a, b in zip(puntos, puntos[1:], strict=False))
