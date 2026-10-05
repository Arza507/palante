"""Descarga de recursos del Portal de Datos Abiertos de Panamá (CKAN).

Solo descarga archivos de datos abiertos citados en SPEC.md, a través de la API oficial del portal.
"""

from dataclasses import dataclass
from pathlib import Path

import httpx

PORTAL = "https://www.datosabiertos.gob.pa"
AGENTE = "Palante/0.1 (+https://github.com/Arza507/palante)"


@dataclass
class Recurso:
    id: str
    nombre: str
    formato: str
    url: str
    modificado: str


@dataclass
class Conjunto:
    id: str
    titulo: str
    licencia: str
    url: str
    modificado: str
    recursos: list[Recurso]


def conjunto(nombre: str) -> Conjunto:
    r = httpx.get(
        f"{PORTAL}/api/3/action/package_show",
        params={"id": nombre},
        headers={"User-Agent": AGENTE},
        timeout=60,
    )
    r.raise_for_status()
    d = r.json()["result"]
    return Conjunto(
        id=d["name"],
        titulo=d["title"],
        licencia=d.get("license_id") or "",
        url=f"{PORTAL}/dataset/{d['name']}",
        modificado=d.get("metadata_modified", "")[:10],
        recursos=[
            Recurso(
                id=x["id"],
                nombre=x.get("name") or "",
                formato=(x.get("format") or "").upper(),
                url=x["url"],
                modificado=(x.get("last_modified") or x.get("created") or "")[:10],
            )
            for x in d["resources"]
        ],
    )


def descargar(url: str, destino: Path) -> Path:
    destino.parent.mkdir(parents=True, exist_ok=True)
    with httpx.stream("GET", url, headers={"User-Agent": AGENTE}, timeout=120, follow_redirects=True) as r:
        r.raise_for_status()
        tmp = destino.with_suffix(destino.suffix + ".parcial")
        with tmp.open("wb") as f:
            for parte in r.iter_bytes():
                f.write(parte)
    tmp.replace(destino)
    return destino
