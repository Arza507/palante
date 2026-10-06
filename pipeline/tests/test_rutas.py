"""Pruebas del módulo de rutas con capturas de prueba (fixtures/rutas, marca FIXTURE)."""

import csv
import io
import json
import zipfile
from datetime import date, datetime, timedelta, timezone

import pytest

from palante_pipeline.comun.salida import FIXTURES, PUBLIC_DATA
from palante_pipeline.rutas import gtfs, proceso
from palante_pipeline.rutas.geometria import distancia, simplificar
from palante_pipeline.rutas.modelo import Captura

F = FIXTURES / "rutas"
TZ = timezone(timedelta(hours=-5))


@pytest.fixture(scope="module")
def resultado():
    capturas, descartes = proceso.leer(F / "capturas")
    return proceso.procesar(
        capturas,
        descartes,
        proceso.cargar_horarios(F / "rutas-fixture.csv"),
        len(list((F / "capturas").glob("*.json"))),
        marca="FIXTURE",
        hoy=date(2026, 10, 5),
    )


@pytest.fixture(scope="module")
def salida(resultado, tmp_path_factory):
    d = tmp_path_factory.mktemp("rutas")
    proceso.escribir(resultado, d)
    return d


def tabla(z: zipfile.ZipFile, nombre: str) -> list[dict]:
    return list(csv.DictReader(io.StringIO(z.read(nombre).decode("utf-8"))))


def test_valida_el_esquema_y_descarta_el_archivo_malo(resultado):
    m = resultado.meta
    assert m.archivos_leidos == 6
    assert m.capturas_validas == 5
    assert {d.motivo: d.n for d in m.descartes}["archivo con formato inválido"] == 1


def test_solo_rutas_con_permiso(resultado, salida):
    assert {r.ruta for r in resultado.rutas} == {"Ruta FIXTURE Uno", "Ruta FIXTURE Tres"}
    todo = "".join(p.read_text(encoding="utf-8") for p in salida.glob("*.*json"))
    with zipfile.ZipFile(salida / "gtfs.zip") as z:
        todo += "".join(z.read(n).decode("utf-8") for n in z.namelist())
    assert "FIXTURE Dos" not in todo
    # El código de voluntario solo etiqueta capturas: no se publica.
    assert "FIX-01" not in todo


def test_descarta_precision_y_saltos(resultado):
    m = resultado.meta
    assert m.puntos_descartados_precision > 0
    assert m.puntos_descartados_salto == 1


def test_salto_imposible():
    base = datetime(2026, 9, 1, 7, tzinfo=TZ)
    c = Captura.model_validate(
        {
            "version": 1,
            "voluntario": "x",
            "ruta": "r",
            "sentido": "ida",
            "permiso": "si",
            "inicio": base,
            "fin": base + timedelta(seconds=15),
            "puntos": [
                {"t": base, "lat": 9.0, "lon": -79.5, "precision_m": 5},
                {"t": base + timedelta(seconds=5), "lat": 9.0001, "lon": -79.5, "precision_m": 5},
                # 1 km en 5 s = 720 km/h
                {"t": base + timedelta(seconds=10), "lat": 9.0101, "lon": -79.5, "precision_m": 5},
                {"t": base + timedelta(seconds=15), "lat": 9.0002, "lon": -79.5, "precision_m": 60},
            ],
        }
    )
    lim = proceso.limpiar("x", c)
    assert lim.descartados_salto == 1 and lim.descartados_precision == 1
    assert len(lim.traza) == 2


def test_simplificacion_a_10_m():
    recta = [(9.0 + i * 0.0001, -79.5) for i in range(50)]
    assert simplificar(recta, 10) == [recta[0], recta[-1]]
    codo = [(9.0, -79.5), (9.001, -79.5), (9.001, -79.499)]
    assert simplificar(codo, 10) == codo


def test_fusion_de_paradas_a_menos_de_30_m(resultado):
    ida = next(r for r in resultado.rutas if r.id == "ruta-fixture-uno-ida")
    vuelta = next(r for r in resultado.rutas if r.id == "ruta-fixture-uno-vuelta")
    # Ida y vuelta pasan por las mismas paradas: se fusionan.
    assert set(ida.paradas) == set(vuelta.paradas)
    ps = list(resultado.paradas.values())
    for i, a in enumerate(ps):
        for b in ps[i + 1 :]:
            assert distancia(a.lat, a.lon, b.lat, b.lon) >= proceso.FUSION_PARADAS_M


def test_traza_mas_completa(resultado):
    ida = next(r for r in resultado.rutas if r.id == "ruta-fixture-uno-ida")
    assert ida.capturas == 2
    assert len(ida.paradas) == 5  # la captura de 30 minutos, no la corta
    assert ida.ultima_captura == date(2026, 9, 16)


def test_gtfs_completo_y_valido(salida):
    with zipfile.ZipFile(salida / "gtfs.zip") as z:
        assert set(z.namelist()) == set(gtfs.OBLIGATORIOS)
        assert {r["route_type"] for r in tabla(z, "routes.txt")} == {"3"}
        assert len(tabla(z, "trips.txt")) == 2
        assert {f["headway_secs"] for f in tabla(z, "frequencies.txt")} == {"900"}
    assert gtfs.validar(salida / "gtfs.zip") == []


def test_ruta_sin_horario_queda_fuera_del_gtfs(resultado, salida):
    tres = next(m for m in resultado.meta.rutas if m.ruta == "Ruta FIXTURE Tres")
    assert not tres.en_gtfs
    with zipfile.ZipFile(salida / "gtfs.zip") as z:
        assert "FIXTURE Tres" not in z.read("routes.txt").decode("utf-8")
    geo = json.loads((salida / "rutas.geojson").read_text(encoding="utf-8"))
    assert "ruta-fixture-tres-ida" in {f["id"] for f in geo["features"]}


def test_validador_detecta_errores(tmp_path, salida):
    roto = tmp_path / "roto.zip"
    with zipfile.ZipFile(salida / "gtfs.zip") as z, zipfile.ZipFile(roto, "w") as w:
        for n in z.namelist():
            datos = z.read(n).decode("utf-8")
            if n == "stop_times.txt":
                datos = datos.replace(",P", ",X", 1)
            if n != "calendar.txt":
                w.writestr(n, datos)
    errores = gtfs.validar(roto)
    assert "falta calendar.txt" in errores


def test_gtfs_reproducible(resultado, tmp_path):
    a, b = tmp_path / "a", tmp_path / "b"
    proceso.escribir(resultado, a)
    proceso.escribir(resultado, b)
    assert (a / "gtfs.zip").read_bytes() == (b / "gtfs.zip").read_bytes()


def test_rutas_publicas_nunca_son_de_prueba():
    """/rutas no se publica con datos de prueba: public/ no puede traer la marca FIXTURE."""
    carpeta = PUBLIC_DATA / "rutas"
    for p in carpeta.glob("*"):
        if p.suffix == ".zip":
            with zipfile.ZipFile(p) as z:
                assert all("FIXTURE" not in z.read(n).decode("utf-8") for n in z.namelist())
        else:
            assert "FIXTURE" not in p.read_text(encoding="utf-8")
