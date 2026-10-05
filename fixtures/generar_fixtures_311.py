"""Genera los datos de prueba del 311 (FIXTURE). Todo es inventado.

Uso: uv run --project pipeline python fixtures/generar_fixtures_311.py
"""

import json
from pathlib import Path

import pandas as pd

AQUI = Path(__file__).parent / "311"


def caso(n, estado, fecha, cambio, servicios, corregimiento):
    return {
        "Caso": f"FIXTURE-{n:04d}",
        "Razón de Estatus": estado,
        "Canal": "Llamada al 311",
        "Fecha (Creación)": fecha,
        "Último Cambio": cambio,
        "Nombre": f"FIXTURE PERSONA {n}",
        "Servicios": servicios,
        "Corregimiento": corregimiento,
        "Detalle": f"FIXTURE texto libre secreto {n}",
    }


def excel() -> None:
    filas = []
    n = 0
    # 10 casos resueltos de ruido en Bella Vista, cerrados en 1 a 10 días.
    for i in range(10):
        n += 1
        filas.append(
            caso(
                n,
                "Concluido",
                f"2026-04-{i + 1:02d} 08:00:00",
                f"2026-04-{2 * i + 2:02d} 08:00:00",
                "Ruido excesivo - MUPA",
                "BELLA VISTA",
            )
        )
    # 6 casos en proceso de basura en Betania (alias de Bethania), con servicio genérico delante.
    for i in range(6):
        n += 1
        filas.append(
            caso(
                n,
                "En Proceso",
                f"2026-05-{i + 1:02d} 09:00:00",
                f"2026-05-{i + 2:02d} 09:00:00",
                "Atención al Cliente, Lote sucio - MUPA",
                "BETANIA",
            )
        )
    # 3 casos vencidos de aceras en Calidonia con el nombre largo de la Alcaldía.
    for i in range(3):
        n += 1
        filas.append(
            caso(
                n,
                "Vencido",
                f"2026-06-{i + 1:02d} 10:00:00",
                f"2026-06-{i + 20:02d} 10:00:00",
                "Aceras por reparar - MUPA",
                "CALIDONIA O LA EXPOSICIÓN",
            )
        )
    # 1 caso con un servicio que no está en la configuración: va a Otros.
    n += 1
    filas.append(
        caso(
            n,
            "Finalizado",
            "2026-01-15 10:00:00",
            "2026-01-16 10:00:00",
            "Servicio nuevo de prueba - MUPA",
            "bella vista",
        )
    )
    # Casos que se descartan.
    n += 1
    filas.append(
        caso(
            n,
            "Concluido",
            "2026-04-03 10:00:00",
            "2026-04-04 10:00:00",
            "Lote sucio - MUPA",
            "JOSÉ DOMINGO ESPINAR",
        )
    )
    n += 1
    filas.append(
        caso(
            n,
            "Concluido",
            "fecha mala",
            "2026-04-04 10:00:00",
            "Lote sucio - MUPA",
            "BELLA VISTA",
        )
    )
    n += 1
    filas.append(
        caso(
            n,
            "Concluido",
            "2026-04-03 10:00:00",
            "2026-04-04 10:00:00",
            "Lote sucio - MUPA",
            "",
        )
    )
    n += 1
    filas.append(
        caso(
            n,
            "Archivado raro",
            "2026-04-03 10:00:00",
            "2026-04-04 10:00:00",
            "Lote sucio - MUPA",
            "BELLA VISTA",
        )
    )
    df = pd.DataFrame(filas)
    # Un caso repetido: la misma fila aparece de nuevo.
    df = pd.concat([df, df.iloc[[0]]], ignore_index=True)
    AQUI.mkdir(parents=True, exist_ok=True)
    df.to_excel(
        AQUI / "casos-fixture.xlsx", index=False, sheet_name="Detalles de casos"
    )


def cuadrado(x0, y0, lado):
    return [
        (x0, y0),
        (x0 + lado, y0),
        (x0 + lado, y0 + lado),
        (x0, y0 + lado),
        (x0, y0),
    ]


def via(id_, puntos, rol="outer"):
    return {
        "type": "way",
        "ref": id_,
        "role": rol,
        "geometry": [{"lon": x, "lat": y} for x, y in puntos],
    }


def osm() -> None:
    # Distrito de prueba: cuadrado de 0,3 grados. Tres corregimientos dentro y uno fuera.
    elementos = [
        {
            "type": "relation",
            "id": 8415626,
            "tags": {"name": "Distrito de Panamá FIXTURE", "admin_level": "6"},
            "members": [via(1, cuadrado(-79.6, 8.9, 0.3))],
        },
        {
            "type": "relation",
            "id": 101,
            "tags": {"name": "Bella Vista", "admin_level": "8"},
            "members": [via(2, cuadrado(-79.6, 8.9, 0.1))],
        },
        {
            "type": "relation",
            "id": 102,
            "tags": {"name": "Bethania", "admin_level": "8"},
            "members": [via(3, cuadrado(-79.5, 8.9, 0.1))],
        },
        {
            "type": "relation",
            "id": 103,
            "tags": {"name": "Calidonia", "admin_level": "8"},
            "members": [via(4, cuadrado(-79.4, 8.9, 0.1))],
        },
        {
            "type": "relation",
            "id": 104,
            "tags": {"name": "José Domingo Espinar", "admin_level": "8"},
            "members": [via(5, cuadrado(-79.0, 9.3, 0.1))],
        },
    ]
    datos = {
        "_marca": "FIXTURE",
        "osm3s": {"timestamp_osm_base": "2026-10-01T00:00:00Z"},
        "elements": elementos,
    }
    (AQUI / "osm-fixture.json").write_text(
        json.dumps(datos, ensure_ascii=False, indent=1), encoding="utf-8"
    )


if __name__ == "__main__":
    excel()
    osm()
    print("Fixtures del 311 generados en", AQUI)
