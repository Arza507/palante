"""Pruebas del módulo de empleo con 20 ofertas de prueba y su extracción esperada (marca FIXTURE)."""

import json
import re
from argparse import Namespace
from datetime import date
from pathlib import Path

import pytest

from palante_pipeline.comun.salida import FIXTURES, PIPELINE, PUBLIC_DATA, RAIZ
from palante_pipeline.empleo import cli, extraccion, lectura, normalizacion, proceso
from palante_pipeline.empleo.modelo import MINIMO_OFERTAS, Celda, Extraccion, Oferta

F = FIXTURES / "empleo"
ESPERADAS = json.loads((F / "extracciones-fixture.json").read_text(encoding="utf-8"))["extracciones"]


@pytest.fixture(scope="module")
def sectores():
    return proceso.cargar_sectores()


@pytest.fixture(scope="module")
def lec(sectores):
    return lectura.leer(F / "ofertas-fixture.csv", set(sectores), proceso.cargar_provincias())


@pytest.fixture()
def cache(tmp_path, lec):
    """Caché sembrada con la extracción esperada de cada oferta: simula respuestas ya pagadas."""
    for o in lec.ofertas:
        extraccion.guardar_cache(
            o, Extraccion.model_validate(ESPERADAS[o.id]), {"entrada": 0, "salida": 0}, tmp_path
        )
    return tmp_path


@pytest.fixture()
def resultado(lec, sectores, cache):
    exts = {o.id: e for o in lec.ofertas if (e := extraccion.leer_cache(o, cache))}
    norm = normalizacion.cargar(esco=F / "esco-fixture.csv")
    return proceso.procesar(lec, exts, sectores, norm, "FIXTURE", marca="FIXTURE", hoy=date(2026, 10, 5))


def test_lee_20_ofertas_y_descarta_las_invalidas(lec):
    assert lec.filas_leidas == 23
    assert len(lec.ofertas) == 20
    assert lec.descartes["sin texto de la oferta"] == 1
    assert lec.descartes["sector fuera de config/sectores.csv"] == 1
    assert sum(v for k, v in lec.descartes.items() if k.startswith("oferta duplicada")) == 1


def test_duplicados_por_titulo_y_empresa_a_menos_de_7_dias():
    base = dict(
        fuente="x", provincia="Panamá", sector="otros", texto="t" * 30, fecha_recoleccion="2026-09-30"
    )
    a = Oferta(id="1", fecha_publicacion="2026-09-01", titulo="Cajero", empresa="Súper Uno", **base)
    b = Oferta(id="2", fecha_publicacion="2026-09-06", titulo="CAJERO ", empresa="Super Uno", **base)
    c = Oferta(id="3", fecha_publicacion="2026-09-20", titulo="Cajero", empresa="Super Uno", **base)
    d = Oferta(id="4", fecha_publicacion="2026-09-02", titulo="Cajero", empresa=None, **base)
    quedan, n = lectura.quitar_duplicados([a, b, c, d])
    assert n == 1
    assert sorted(o.id for o in quedan) == ["1", "3", "4"]


def test_plantilla_vacia_corre_sin_errores(tmp_path, sectores):
    lec = lectura.leer(
        PIPELINE / "data" / "raw" / "empleo" / "ofertas-plantilla.csv",
        set(sectores),
        proceso.cargar_provincias(),
    )
    assert lec.ofertas == []
    r = proceso.procesar(lec, {}, sectores, normalizacion.cargar(esco=tmp_path / "no"), "x")
    assert r.resumen.total.insuficiente
    assert r.sectores == []
    proceso.escribir(r, tmp_path / "salida")
    assert json.loads((tmp_path / "salida" / "meta.json").read_text(encoding="utf-8"))["ofertas_validas"] == 0


def test_cli_con_plantilla_vacia(monkeypatch, tmp_path, capsys):
    """El comando completo corre sin ofertas.csv y sin clave."""
    monkeypatch.setattr(cli, "CARPETA", PIPELINE / "data" / "raw" / "empleo" / "no-existe")
    (tmp_path / "ofertas-plantilla.csv").write_text(
        (PIPELINE / "data" / "raw" / "empleo" / "ofertas-plantilla.csv").read_text(encoding="utf-8"),
        encoding="utf-8",
    )
    monkeypatch.setattr(cli, "CARPETA", tmp_path)
    escritos = {}
    monkeypatch.setattr(proceso, "escribir", lambda r: escritos.setdefault("r", r))
    cli.main(Namespace(probar=True, extraer=False))
    assert escritos["r"].meta.filas_leidas == 0
    assert "Costo estimado" in capsys.readouterr().out


def test_extraccion_esperada_valida():
    assert len(ESPERADAS) == 20
    for e in ESPERADAS.values():
        Extraccion.model_validate(e)


def test_agregados_cuadran(resultado):
    r = resultado
    assert r.meta.ofertas_con_extraccion == 20
    assert r.resumen.total.ofertas == 20
    # tecnología tiene 12 ofertas: se publica; logística (5) y comercio (3) no.
    pub = {s.id: s.celda for s in r.resumen.sectores}
    assert pub["tecnologia"].ofertas == 12
    assert pub["logistica"].insuficiente and pub["comercio"].insuficiente
    assert [s.id for s in r.sectores] == ["tecnologia"]
    # Inglés: 1, 2, 5, 6, 8, 10, 12 en tecnología.
    assert pub["tecnologia"].pide_ingles == 7


def test_sinonimos_y_esco(resultado):
    tec = {h.nombre: h for h in resultado.resumen.sectores[0].celda.herramientas}
    # SQL Server y MySQL pasan a SQL; SQL coincide con la etiqueta de ESCO de prueba.
    assert tec["SQL"].n == 4
    assert tec["SQL"].esco and "FIXTURE" in tec["SQL"].esco
    # "Excel avanzado" y "Excel" pasan a "Microsoft Excel".
    total = {h.nombre: h.n for h in resultado.resumen.total.herramientas}
    assert total["Microsoft Excel"] == 3
    assert "Excel avanzado" not in total


def test_salario_mediano_solo_con_10_salarios(resultado):
    tec = resultado.resumen.sectores[0].celda
    assert tec.ofertas_con_salario == 6
    assert tec.salario_mediano is None


def test_celda_insuficiente_no_lleva_numeros():
    with pytest.raises(ValueError):
        Celda(insuficiente=True, ofertas=4)
    with pytest.raises(ValueError):
        Celda(insuficiente=False, ofertas=MINIMO_OFERTAS - 1)


def recorrer(x, ruta=""):
    if isinstance(x, dict):
        if "insuficiente" in x:
            yield ruta, x
        for k, v in x.items():
            yield from recorrer(v, f"{ruta}.{k}")
    elif isinstance(x, list):
        for i, v in enumerate(x):
            yield from recorrer(v, f"{ruta}[{i}]")


@pytest.mark.parametrize("carpeta", [PUBLIC_DATA / "empleo", FIXTURES / "web" / "data" / "empleo"])
def test_ninguna_celda_con_menos_de_10_ofertas_se_publica(carpeta):
    archivos = list(carpeta.rglob("*.json"))
    for a in archivos:
        for ruta, c in recorrer(json.loads(a.read_text(encoding="utf-8"))):
            if c["insuficiente"]:
                assert c.get("ofertas") is None and not c.get("habilidades"), f"{a.name}{ruta}"
            else:
                assert c["ofertas"] >= MINIMO_OFERTAS, f"{a.name}{ruta}"


def test_salidas_sin_texto_de_ofertas_ni_empresas(resultado, tmp_path):
    proceso.escribir(resultado, tmp_path)
    todo = "".join(p.read_text(encoding="utf-8") for p in tmp_path.rglob("*.json"))
    assert "Empresa FIXTURE" not in todo
    assert "Buscamos analista" not in todo
    assert "rrhh@" not in todo


# ---- Extracción, caché y costo ----


def test_limpia_correos_y_telefonos():
    t = extraccion.limpiar_texto("Escribe a rrhh@ejemplo.com o llama al 6000-0000 o +507 222-3333.")
    assert "@" not in t and "6000" not in t and "222" not in t


def test_estimacion_sin_llamar_a_la_api(lec, tmp_path):
    est = extraccion.estimar(lec.ofertas, tmp_path)
    assert est.por_extraer == 20 and est.en_cache == 0
    # 20 ofertas cortas: unos céntimos.
    assert 0 < est.costo_tipico < est.costo_maximo < 0.5


def test_estimacion_con_cache_no_cuesta_nada(lec, cache):
    est = extraccion.estimar(lec.ofertas, cache)
    assert est.por_extraer == 0 and est.costo_maximo == 0


def test_extraer_usa_cache_y_respeta_el_tope(lec, tmp_path):
    llamadas = []

    def falsa(o: Oferta):
        llamadas.append(o.id)
        return Extraccion.model_validate(ESPERADAS[o.id]), {"entrada": 500, "salida": 200}

    peor = max(
        extraccion.costo(extraccion.tokens_entrada(o), extraccion.MAX_TOKENS_SALIDA) for o in lec.ofertas
    )
    # Con tope para unas 3 llamadas en el peor caso, se detiene antes de pasarse.
    c = extraccion.extraer(lec.ofertas, falsa, tope=peor * 3, carpeta=tmp_path)
    assert c.detenida_por_tope
    assert c.gastado_usd <= peor * 3
    hechas = len(llamadas)
    assert hechas >= 3
    # Segunda corrida: lo ya extraído sale de la caché y no se paga de nuevo.
    c2 = extraccion.extraer(lec.ofertas, falsa, tope=10, carpeta=tmp_path)
    assert not c2.detenida_por_tope
    assert len(llamadas) == 20
    assert c2.extraidas == 20 - hechas


def test_extraer_sin_clave_no_llama(monkeypatch):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    with pytest.raises(extraccion.SinClave):
        extraccion.llamada_anthropic()


def test_error_fatal_detiene_la_corrida(lec, tmp_path):
    class AuthenticationError(Exception):
        pass

    def falla(o):
        raise AuthenticationError("clave inválida")

    with pytest.raises(AuthenticationError):
        extraccion.extraer(lec.ofertas, falla, tope=10, carpeta=tmp_path)


# ---- Reglas del repositorio ----

PORTALES = re.compile(r"konzerta|computrabajo|encuentra24|bumeran|linkedin\.com/jobs", re.I)
SCRAPING = re.compile(r"\b(bs4|BeautifulSoup|scrapy|selenium|requests_html|mechanicalsoup|lxml\.html)\b")


def test_no_hay_scrapers_en_el_repositorio():
    yo = Path(__file__).resolve()
    codigo = [
        p
        for carpeta in (
            "pipeline/palante_pipeline",
            "pipeline/tests",
            "web/src",
            "web/scripts",
            "scripts",
            "fixtures",
        )
        for p in (RAIZ / carpeta).rglob("*")
        if p.suffix in {".py", ".ts", ".tsx", ".mjs", ".js", ".astro"} and p.resolve() != yo
    ]
    assert codigo
    for p in codigo:
        t = p.read_text(encoding="utf-8")
        assert not PORTALES.search(t), f"{p} menciona un portal privado"
        assert not SCRAPING.search(t), f"{p} usa una librería de scraping"
