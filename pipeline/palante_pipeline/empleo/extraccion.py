"""Extracción de habilidades con la API de Anthropic, con caché por texto y tope de gasto.

- Cada respuesta se guarda en pipeline/data/cache/empleo/<sha256 del texto>.json: nunca se paga dos veces.
- `estimar()` calcula el costo sin llamar a la API (modo --probar).
- `extraer()` se detiene antes de la llamada que podría pasar de MAX_USD_EMPLEO.
"""

import hashlib
import json
import math
import os
import re
from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path

from palante_pipeline.comun.salida import PIPELINE
from palante_pipeline.empleo.modelo import Extraccion, Oferta

# Haiku vigente (SPEC.md, sección 5). Precios en dólares por millón de tokens.
MODELO = "claude-haiku-4-5"
PRECIO_ENTRADA = 1.00
PRECIO_SALIDA = 5.00
MAX_TOKENS_SALIDA = 1024
# Salida típica de una extracción; el tope real por llamada es MAX_TOKENS_SALIDA.
SALIDA_TIPICA = 350
# Tokens por carácter en español, con margen hacia arriba: mejor sobrestimar el costo.
CARACTERES_POR_TOKEN = 3.0
VERSION_PROMPT = 1
CACHE = PIPELINE / "data" / "cache" / "empleo"

SISTEMA = """Extraes datos de ofertas de empleo de Panamá. Respondes solo con lo que dice el texto \
de la oferta.

Reglas:
- habilidades: competencias y conocimientos que pide la oferta, en español y en forma corta \
("Atención al cliente", "Contabilidad", "Trabajo en equipo"). Sin repetir.
- herramientas: programas, plataformas, equipos o lenguajes con nombre propio ("Microsoft Excel", "SAP", \
"Python", "montacargas"). No van aquí las habilidades generales.
- idiomas: cada idioma que pide, con nivel basico, intermedio, avanzado, nativo o "no indicado". \
El español solo si la oferta lo pide de forma explícita.
- anios_experiencia: el mínimo de años que pide; null si no lo dice.
- nivel_educativo: el mínimo que pide; "no indicado" si no lo dice.
- modalidad: presencial, hibrido o remoto; "no indicado" si no lo dice.
- salario: solo si el texto da una cifra en dólares; null si no aparece. No lo calcules ni lo supongas.
- Si un dato no aparece en el texto, no lo inventes."""

_CORREO = re.compile(r"[\w.+-]+@[\w-]+(\.[\w-]+)+")
_TELEFONO = re.compile(r"(?<!\d)(\+?507[\s-]?)?\d{3,4}[\s-]?\d{4}(?!\d)")


class TopeAlcanzado(Exception):
    """La siguiente llamada podría pasar de MAX_USD_EMPLEO."""


class SinClave(Exception):
    """No hay ANTHROPIC_API_KEY en .env."""


def limpiar_texto(texto: str) -> str:
    """Quita correos y teléfonos de contacto antes de enviar o guardar nada: no hacen falta para extraer."""
    t = _CORREO.sub("[correo]", texto)
    t = _TELEFONO.sub("[teléfono]", t)
    return re.sub(r"\s+", " ", t).strip()


def huella(texto: str) -> str:
    return hashlib.sha256(limpiar_texto(texto).encode("utf-8")).hexdigest()


def mensaje(oferta: Oferta) -> str:
    return f"Título: {oferta.titulo}\n\nTexto de la oferta:\n{limpiar_texto(oferta.texto)}"


def _tokens(texto: str) -> int:
    return math.ceil(len(texto) / CARACTERES_POR_TOKEN)


# El esquema JSON viaja con cada llamada como parte de la instrucción del sistema.
_TOKENS_FIJOS = (
    _tokens(SISTEMA) + _tokens(json.dumps(Extraccion.model_json_schema(), ensure_ascii=False)) + 50
)


def tokens_entrada(oferta: Oferta) -> int:
    return _TOKENS_FIJOS + _tokens(mensaje(oferta))


def costo(entrada: int, salida: int) -> float:
    return entrada * PRECIO_ENTRADA / 1e6 + salida * PRECIO_SALIDA / 1e6


@dataclass
class Estimacion:
    ofertas: int
    en_cache: int
    por_extraer: int
    tokens_entrada: int
    costo_tipico: float
    costo_maximo: float


def leer_cache(oferta: Oferta, carpeta: Path = CACHE) -> Extraccion | None:
    p = carpeta / f"{huella(oferta.texto)}.json"
    if not p.exists():
        return None
    return Extraccion.model_validate(json.loads(p.read_text(encoding="utf-8"))["extraccion"])


def guardar_cache(oferta: Oferta, ext: Extraccion, uso: dict, carpeta: Path = CACHE) -> None:
    carpeta.mkdir(parents=True, exist_ok=True)
    datos = {"modelo": MODELO, "version_prompt": VERSION_PROMPT, "uso": uso, "extraccion": ext.model_dump()}
    (carpeta / f"{huella(oferta.texto)}.json").write_text(
        json.dumps(datos, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )


def estimar(ofertas: list[Oferta], carpeta: Path = CACHE) -> Estimacion:
    """Costo de extraer las ofertas que no están en caché. No llama a la API."""
    pendientes = [o for o in ofertas if leer_cache(o, carpeta) is None]
    # Textos repetidos se pagan una sola vez.
    unicas = {huella(o.texto): o for o in pendientes}.values()
    ent = sum(tokens_entrada(o) for o in unicas)
    n = len(unicas)
    return Estimacion(
        ofertas=len(ofertas),
        en_cache=len(ofertas) - len(pendientes),
        por_extraer=n,
        tokens_entrada=ent,
        costo_tipico=costo(ent, n * SALIDA_TIPICA),
        costo_maximo=costo(ent, n * MAX_TOKENS_SALIDA),
    )


def tope_usd() -> float:
    valor = os.environ.get("MAX_USD_EMPLEO", "").strip()
    if not valor:
        raise SinClave("Falta MAX_USD_EMPLEO en .env: sin tope no se llama a la API.")
    return float(valor)


Llamada = Callable[[Oferta], tuple[Extraccion, dict]]


def llamada_anthropic() -> Llamada:
    """Cliente real. Solo se crea si ANTHROPIC_API_KEY está en el entorno (cargado desde .env)."""
    if not os.environ.get("ANTHROPIC_API_KEY"):
        raise SinClave("Falta ANTHROPIC_API_KEY en .env. Usa --probar para estimar el costo sin clave.")
    import anthropic

    cliente = anthropic.Anthropic()

    def llamar(oferta: Oferta) -> tuple[Extraccion, dict]:
        r = cliente.messages.parse(
            model=MODELO,
            max_tokens=MAX_TOKENS_SALIDA,
            system=SISTEMA,
            messages=[{"role": "user", "content": mensaje(oferta)}],
            output_format=Extraccion,
            # El SDK 1.x ya no tiene el argumento temperature; Haiku 4.5 lo sigue aceptando en el cuerpo.
            extra_body={"temperature": 0},
        )
        if r.stop_reason != "end_turn" or r.parsed_output is None:
            raise ValueError(f"Respuesta incompleta para la oferta {oferta.id}: {r.stop_reason}")
        uso = {"entrada": r.usage.input_tokens, "salida": r.usage.output_tokens}
        return r.parsed_output, uso

    return llamar


FATALES = {"AuthenticationError", "PermissionDeniedError", "NotFoundError", "BillingError"}


@dataclass
class Corrida:
    extraidas: int
    gastado_usd: float
    detenida_por_tope: bool
    errores: list[str]


def extraer(ofertas: list[Oferta], llamar: Llamada, tope: float, carpeta: Path = CACHE) -> Corrida:
    """Extrae las ofertas sin caché hasta el tope. Antes de cada llamada comprueba el peor caso."""
    gastado = 0.0
    hechas = 0
    errores: list[str] = []
    vistas: set[str] = set()
    for o in ofertas:
        h = huella(o.texto)
        if h in vistas or leer_cache(o, carpeta) is not None:
            continue
        vistas.add(h)
        peor = costo(tokens_entrada(o), MAX_TOKENS_SALIDA)
        if gastado + peor > tope:
            return Corrida(hechas, gastado, True, errores)
        try:
            ext, uso = llamar(o)
        except Exception as e:  # noqa: BLE001 - se anota y se sigue con la siguiente oferta
            # Clave inválida, sin permiso o modelo inexistente: seguir solo repetiría el error.
            if type(e).__name__ in FATALES:
                raise
            errores.append(f"{o.id}: {type(e).__name__}: {e}")
            gastado += peor
            continue
        gastado += costo(uso["entrada"], uso["salida"])
        guardar_cache(o, ext, uso, carpeta)
        hechas += 1
    return Corrida(hechas, gastado, False, errores)
