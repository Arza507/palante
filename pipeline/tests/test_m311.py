"""Pruebas del módulo 311 con datos de prueba (fixtures/311, marca FIXTURE)."""

import json
from datetime import date

import pandas as pd
import pytest

from palante_pipeline.comun.salida import FIXTURES, PUBLIC_DATA, RAW
from palante_pipeline.m311 import geo, proceso
from palante_pipeline.m311.modelo import Mediana, Resumen

F = FIXTURES / "311"
CONJUNTOS = [
    {
        "titulo": "Detalle de casos 311 2027 FIXTURE",
        "url": "https://example.org/311-2027",
        "licencia": "cc-zero",
    },
    {"titulo": "Detalle de casos 311 FIXTURE", "url": "https://example.org/311", "licencia": "cc-zero"},
]


@pytest.fixture(scope="module")
def corrida(tmp_path_factory):
    poligonos, meta_geo = geo.corregimientos(F / "osm-fixture.json")
    resultado, perfiles = proceso.procesar(
        [F / "casos-fixture.xlsx"],
        poligonos,
        proceso.cargar_config(),
        CONJUNTOS,
        meta_geo["fecha_osm"],
        None,
        hoy=date(2026, 10, 5),
    )
    destino = tmp_path_factory.mktemp("salida")
    proceso.escribir(resultado, proceso.topologia(poligonos), destino)
    return resultado, perfiles, poligonos, destino


def test_poligonos_solo_del_distrito(corrida):
    _, _, poligonos, _ = corrida
    assert sorted(poligonos["slug"]) == ["bella-vista", "bethania", "calidonia"]


def test_suma_de_agregados_igual_a_filas_validas(corrida):
    r, _, _, _ = corrida
    assert sum(c[4] for c in r.resumen.conteos) == r.resumen.total == r.meta.filas_validas == len(r.limpio)
    assert r.meta.filas_validas == 20


def test_filas_leidas_cuadran_con_descartes(corrida):
    r, _, _, _ = corrida
    assert r.meta.filas_leidas == 25
    motivos = {d.motivo: d.filas for d in r.meta.filas_descartadas}
    assert motivos["caso repetido en más de un archivo"] == 1
    assert motivos["fecha de creación vacía o inválida"] == 1
    assert motivos["sin corregimiento"] == 1
    assert motivos["corregimiento fuera del distrito de Panamá o sin polígono"] == 1
    assert motivos["estado desconocido"] == 1
    assert r.sin_poligono == {"JOSÉ DOMINGO ESPINAR": 1}


def test_alias_y_nombres_normalizados(corrida):
    r, _, _, _ = corrida
    por = r.limpio.groupby("corregimiento").size().to_dict()
    assert por == {"Bella Vista": 11, "Bethania": 6, "Calidonia": 3}


def test_categorias_y_servicio_principal(corrida):
    r, _, _, _ = corrida
    cats = r.limpio.groupby("categoria").size().to_dict()
    assert cats == {"ruido": 10, "basura": 6, "calles": 3, "otros": 1}
    assert r.meta.servicios_sin_categoria == ["Servicio nuevo de prueba - MUPA"]


def test_estados_y_mediana(corrida):
    r, _, _, _ = corrida
    bv = r.resumen.dias_cierre["bella-vista"]
    # Cierres de 1 a 10 días y uno de 1 día (el caso de enero): mediana de 11 valores.
    assert bv.n == 11
    assert bv.mediana == 5.0
    assert r.resumen.dias_cierre["bethania"].mediana is None  # sin resueltos
    assert r.resumen.dias_cierre["calidonia"] == Mediana(mediana=None, n=0)


def test_trimestres(corrida):
    r, _, _, _ = corrida
    assert [t.id for t in r.resumen.trimestres] == ["2026-T1", "2026-T2"]
    assert r.resumen.trimestres[1].nombre == "abril a junio de 2026"


def test_sin_datos_personales_ni_texto_libre(corrida):
    _, perfiles, _, destino = corrida
    for archivo in destino.iterdir():
        texto = archivo.read_text(encoding="utf-8")
        assert "PERSONA" not in texto, archivo.name
        assert "texto libre secreto" not in texto, archivo.name
    columnas = pd.read_csv(destino / "311-limpio.csv").columns
    assert "nombre" not in {c.lower() for c in columnas}
    assert "detalle" not in {c.lower() for c in columnas}
    # El perfil de columnas no muestra ejemplos de las columnas sensibles.
    for p in perfiles:
        for c in p.columnas:
            if c.nombre in ("Nombre", "Detalle"):
                assert c.ejemplos == [] and c.omitida


def test_sin_poblacion_hay_nota(corrida):
    r, _, _, _ = corrida
    assert r.meta.poblacion_disponible is False
    assert "población" in r.meta.poblacion_nota
    assert all(c.poblacion is None for c in r.resumen.corregimientos)


def test_validacion_rechaza_sumas_incorrectas(corrida):
    r, _, _, _ = corrida
    datos = r.resumen.model_dump()
    datos["total"] += 1
    with pytest.raises(ValueError):
        Resumen.model_validate(datos)


def test_topojson_tiene_los_corregimientos(corrida):
    _, _, _, destino = corrida
    topo = json.loads((destino / "corregimientos.topo.json").read_text(encoding="utf-8"))
    geoms = topo["objects"]["corregimientos"]["geometries"]
    assert sorted(g["properties"]["slug"] for g in geoms) == ["bella-vista", "bethania", "calidonia"]


# Pruebas sobre las salidas reales publicadas en web/public/data/311/.
SALIDA = PUBLIC_DATA / "311"
hay_salida = pytest.mark.skipif(not (SALIDA / "resumen.json").exists(), reason="sin salidas del 311")


@hay_salida
def test_salida_publicada_es_valida_y_suma():
    resumen = Resumen.model_validate_json((SALIDA / "resumen.json").read_text(encoding="utf-8"))
    meta = json.loads((SALIDA / "meta.json").read_text(encoding="utf-8"))
    limpio = pd.read_csv(SALIDA / "311-limpio.csv")
    assert resumen.total == meta["filas_validas"] == len(limpio)
    assert sum(c[4] for c in resumen.conteos) == resumen.total


@hay_salida
def test_salida_publicada_sin_fixtures():
    for archivo in SALIDA.iterdir():
        assert "FIXTURE" not in archivo.read_text(encoding="utf-8"), archivo.name


@hay_salida
def test_corregimientos_sin_poligono_estan_en_report():
    meta = json.loads((SALIDA / "meta.json").read_text(encoding="utf-8"))
    report = (PUBLIC_DATA.parents[2] / "REPORT.md").read_text(encoding="utf-8")
    for d in meta["filas_descartadas"]:
        if d["motivo"].startswith("corregimiento fuera"):
            for nombre in d["detalle"]:
                assert nombre.rsplit(" (", 1)[0] in report, nombre


@pytest.mark.skipif(not list((RAW / "311").glob("*.xlsx")), reason="sin Excel crudos del 311")
def test_ninguna_descripcion_real_llega_a_public():
    """Ninguna descripción ni nombre de los Excel reales aparece en web/public/."""
    textos = set()
    for x in (RAW / "311").glob("*.xlsx"):
        df = pd.read_excel(x, dtype=str)
        for col in df.columns:
            if col.strip().lower() in ("detalle", "nombre"):
                textos |= {t.strip() for t in df[col].dropna() if len(t.strip()) >= 12}
    publico = "".join(
        f.read_text(encoding="utf-8", errors="ignore")
        for f in PUBLIC_DATA.rglob("*")
        if f.is_file() and f.suffix in (".json", ".csv")
    )
    assert textos, "no se leyeron textos de control"
    fugas = [t for t in textos if t in publico]
    assert fugas == []


def test_filas_por_periodo_cuadran(corrida):
    r, _, _, _ = corrida
    m = r.meta
    assert sum(p.leidas for p in m.filas_por_periodo) == m.filas_leidas
    assert sum(p.validas for p in m.filas_por_periodo) == m.filas_validas
    assert {p.archivo for p in m.filas_por_periodo} == {"casos-fixture.xlsx"}


def test_varios_conjuntos_en_la_fuente(corrida):
    r, _, _, _ = corrida
    assert [c.url for c in r.meta.conjuntos] == [c["url"] for c in CONJUNTOS]
    assert r.meta.url == CONJUNTOS[0]["url"]
    fuente = next(f for f in r.meta.fuentes if f.id == "311")
    assert all(c["titulo"] in fuente.nombre for c in CONJUNTOS)


def test_descarga_busca_todos_los_detalles_de_la_alcaldia(monkeypatch):
    from palante_pipeline.m311 import descarga

    monkeypatch.setattr(
        descarga.ckan,
        "buscar",
        lambda org, texto: [
            (
                "alcaldia-de-panama-detalle-de-casos-reportados-al-311-2027",
                "Alcaldía de Panamá - Detalle de Casos Reportados al 311 - 2027",
            ),
            (
                "alcaldia-de-panama-reportes-311-por-tipo-2026",
                "Alcaldía de Panamá - Reportes 311 por Tipo - 2026",
            ),
        ],
    )
    assert descarga.nombres_conjuntos() == [
        "alcaldia-de-panama-detalle-de-casos-reportados-al-311-2027",
        "alcaldia-de-panama-detalle-de-casos-reportados-al-311-2026",
    ]
