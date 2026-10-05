from datetime import date

from palante_pipeline.comun.salida import fecha_texto
from palante_pipeline.comun.texto import clave, sin_tildes, slug


def test_sin_tildes_conserva_la_enie():
    assert sin_tildes("Panamá Viejo") == "Panama Viejo"
    assert sin_tildes("Las Mañanitas") == "Las Mañanitas"
    assert sin_tildes("PEÑA BLANCA") == "PEÑA BLANCA"


def test_clave_ignora_tildes_mayusculas_y_signos():
    assert clave("  BELLA   VISTA ") == clave("Bella Vista")
    assert clave("San Martín") == "san martin"
    assert clave("Las Mañanitas") == "las mananitas"
    assert clave("Juan Díaz (Cabecera)") == "juan diaz cabecera"
    assert clave(None) == ""


def test_slug():
    assert slug("Bella Vista") == "bella-vista"
    assert slug("24 de Diciembre") == "24-de-diciembre"


def test_fecha_texto():
    assert fecha_texto(date(2026, 10, 5)) == "5 de octubre de 2026"
