"""Lee el report.json del validador GTFS de MobilityData y falla si hay errores.

Uso: python scripts/revisar_gtfs.py salida/report.json
"""

import json
import sys
from pathlib import Path


def main(ruta: str) -> int:
    informe = json.loads(Path(ruta).read_text(encoding="utf-8"))
    avisos = informe.get("notices", [])
    errores = [a for a in avisos if a.get("severity") == "ERROR"]
    for a in avisos:
        print(f"{a.get('severity', '?'):8} {a.get('code')}: {a.get('totalNotices', 1)}")
    if errores:
        print(f"\nEl GTFS tiene {sum(a.get('totalNotices', 1) for a in errores)} errores.")
        return 1
    print("\nGTFS válido: 0 errores.")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1]))
