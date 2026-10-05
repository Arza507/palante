"""Punto de entrada del pipeline.

Uso:
  uv run python -m palante_pipeline 311 [--descargar]
  uv run python -m palante_pipeline empleo [--probar | --extraer]
  uv run python -m palante_pipeline rutas
  uv run python -m palante_pipeline todo [--descargar]
"""

import argparse
import importlib
import sys

# Cada módulo expone main(args). Se cargan solo si existen, para poder correr hitos parciales.
MODULOS = {"311": "palante_pipeline.m311.cli", "empleo": "palante_pipeline.empleo.cli",
           "rutas": "palante_pipeline.rutas.cli"}


def cargar(nombre: str):
    try:
        return importlib.import_module(MODULOS[nombre])
    except ModuleNotFoundError as e:
        if e.name == MODULOS[nombre]:
            return None
        raise


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(prog="palante_pipeline", description="Pipeline de datos de Palante")
    p.add_argument("modulo", choices=[*MODULOS, "todo"])
    p.add_argument("--descargar", action="store_true", help="descarga las fuentes oficiales que falten")
    p.add_argument("--probar", action="store_true", help="empleo: estima el costo sin llamar a la API")
    p.add_argument("--extraer", action="store_true", help="empleo: llama a la API hasta MAX_USD_EMPLEO")
    args = p.parse_args(argv)
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    nombres = list(MODULOS) if args.modulo == "todo" else [args.modulo]
    for n in nombres:
        mod = cargar(n)
        if mod is None:
            print(f"Módulo {n}: todavía no implementado, se omite.")
            continue
        mod.main(args)
    return 0


if __name__ == "__main__":
    sys.exit(main())
