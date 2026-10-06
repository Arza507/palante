"""Comando del módulo de empleo.

uv run python -m palante_pipeline empleo            agrega con las extracciones guardadas en caché
uv run python -m palante_pipeline empleo --probar   además estima el costo de extraer lo que falta
uv run python -m palante_pipeline empleo --extraer  llama a la API hasta MAX_USD_EMPLEO y agrega
"""

from argparse import Namespace

from palante_pipeline.comun.entorno import cargar_env
from palante_pipeline.comun.salida import RAW
from palante_pipeline.empleo import extraccion, lectura, normalizacion, proceso

CARPETA = RAW / "empleo"
ORIGEN = "Muestra de ofertas publicadas en portales públicos de empleo, recogida a mano"


def usd(x: float) -> str:
    return f"{x:,.4f} USD".replace(",", " ").replace(".", ",")


def main(args: Namespace) -> None:
    cargar_env()
    ruta = CARPETA / "ofertas.csv"
    if not ruta.exists():
        print("Empleo: no existe raw/empleo/ofertas.csv; se usa la plantilla vacía.")
        ruta = CARPETA / "ofertas-plantilla.csv"
    sectores = proceso.cargar_sectores()
    lec = lectura.leer(ruta, set(sectores), proceso.cargar_provincias())
    est = extraccion.estimar(lec.ofertas)
    print(
        f"Empleo: {lec.filas_leidas} filas, {len(lec.ofertas)} ofertas válidas, "
        f"{est.en_cache} con extracción."
    )
    for motivo, n in sorted(lec.descartes.items()):
        print(f"  Descartadas por {motivo}: {n}")

    if args.probar or args.extraer:
        print(
            f"  Por extraer: {est.por_extraer} ofertas, unos {est.tokens_entrada:,} tokens de entrada.\n"
            f"  Costo estimado con {extraccion.MODELO}: {usd(est.costo_tipico)} "
            f"(máximo {usd(est.costo_maximo)} si cada respuesta llega al tope de "
            f"{extraccion.MAX_TOKENS_SALIDA} tokens)."
        )
    if args.extraer and est.por_extraer:
        try:
            tope = extraccion.tope_usd()
            llamar = extraccion.llamada_anthropic()
        except extraccion.SinClave as e:
            raise SystemExit(f"Empleo: {e}") from None
        corrida = extraccion.extraer(lec.ofertas, llamar, tope)
        print(f"  Extraídas: {corrida.extraidas}. Gastado: {usd(corrida.gastado_usd)} de {usd(tope)}.")
        if corrida.detenida_por_tope:
            print("  Detenido por MAX_USD_EMPLEO. Sube el tope en .env o corre de nuevo otro día.")
        for e in corrida.errores:
            print(f"  Error: {e}")

    extracciones = {o.id: e for o in lec.ofertas if (e := extraccion.leer_cache(o)) is not None}
    norm = normalizacion.cargar()
    if not norm.esco_disponible:
        print("  ESCO: no está raw/empleo/esco/skills_es.csv; solo se usan los sinónimos manuales.")
    r = proceso.procesar(
        lec,
        extracciones,
        sectores,
        norm,
        ORIGEN,
        proceso.leer_informalidad(CARPETA / "inec" / "informalidad.csv"),
    )
    proceso.escribir(r)
    publicados = sum(not s.celda.insuficiente for s in r.resumen.sectores)
    print(
        f"  Publicado: {r.meta.ofertas_con_extraccion} ofertas, {publicados} sectores con 10 ofertas o más."
    )
