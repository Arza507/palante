"""Agregados del observatorio de empleo por sector, provincia y mes, y escritura de las salidas."""

import shutil
import statistics
from collections import Counter
from dataclasses import dataclass
from datetime import UTC, date, datetime
from pathlib import Path

import pandas as pd

from palante_pipeline.comun.salida import CONFIG, MESES, PUBLIC_DATA, escribir_json, fecha_texto
from palante_pipeline.comun.texto import clave
from palante_pipeline.empleo.extraccion import MODELO
from palante_pipeline.empleo.lectura import Lectura
from palante_pipeline.empleo.modelo import (
    MINIMO_OFERTAS,
    TOP_HABILIDADES,
    Celda,
    Conteo,
    Descarte,
    Extraccion,
    FuenteMeta,
    Grupo,
    Informalidad,
    Meta,
    Oferta,
    Resumen,
    Sector,
    SectorResumen,
)
from palante_pipeline.empleo.normalizacion import Normalizador

INGLES = {"ingles", "english"}


@dataclass
class Fila:
    oferta: Oferta
    ext: Extraccion
    habilidades: list[tuple[str, str | None]]
    herramientas: list[tuple[str, str | None]]
    ingles: bool
    salario: float | None
    mes: str


@dataclass
class Resultado:
    resumen: Resumen
    sectores: list[Sector]
    meta: Meta


def cargar_sectores(carpeta: Path = CONFIG) -> dict[str, str]:
    df = pd.read_csv(carpeta / "sectores.csv", dtype=str, keep_default_na=False)
    return dict(zip(df["id"], df["nombre"], strict=True))


def cargar_provincias(carpeta: Path = CONFIG) -> dict[str, str]:
    df = pd.read_csv(carpeta / "provincias.csv", dtype=str, keep_default_na=False)
    return {clave(n): n for n in df["nombre"]}


def salario_mensual(o: Oferta, e: Extraccion) -> float | None:
    """Salario de la columna del CSV (mensual) o, si falta, el que aparece en el texto por mes."""
    vals = [v for v in (o.salario_min, o.salario_max) if v]
    if not vals and e.salario and e.salario.periodo == "mes":
        vals = [v for v in (e.salario.minimo, e.salario.maximo) if v]
    return sum(vals) / len(vals) if vals else None


def preparar(o: Oferta, e: Extraccion, norm: Normalizador) -> Fila:
    def unicos(items: list[str]) -> list[tuple[str, str | None]]:
        vistos: dict[str, tuple[str, str | None]] = {}
        for i in items:
            n = norm(i)
            if n[0]:
                vistos.setdefault(clave(n[0]), n)
        return list(vistos.values())

    return Fila(
        oferta=o,
        ext=e,
        habilidades=unicos(e.habilidades),
        herramientas=unicos(e.herramientas),
        ingles=any(clave(i.idioma) in INGLES for i in e.idiomas),
        salario=salario_mensual(o, e),
        mes=o.fecha_publicacion.strftime("%Y-%m"),
    )


def _top(listas: list[list[tuple[str, str | None]]]) -> list[Conteo]:
    cuenta: Counter = Counter()
    uris: dict[str, str | None] = {}
    nombres: dict[str, str] = {}
    for items in listas:
        for nombre, uri in items:
            k = clave(nombre)
            cuenta[k] += 1
            nombres.setdefault(k, nombre)
            uris.setdefault(k, uri)
    orden = sorted(cuenta.items(), key=lambda x: (-x[1], nombres[x[0]]))[:TOP_HABILIDADES]
    return [Conteo(nombre=nombres[k], n=n, esco=uris[k]) for k, n in orden]


def celda(filas: list[Fila]) -> Celda:
    """Estadísticas de un grupo. Con menos de 10 ofertas no se publica ningún número."""
    if len(filas) < MINIMO_OFERTAS:
        return Celda(insuficiente=True)
    salarios = [f.salario for f in filas if f.salario]
    return Celda(
        insuficiente=False,
        ofertas=len(filas),
        habilidades=_top([f.habilidades for f in filas]),
        herramientas=_top([f.herramientas for f in filas]),
        pide_ingles=sum(f.ingles for f in filas),
        ofertas_con_salario=len(salarios),
        salario_mediano=round(statistics.median(salarios), 2) if len(salarios) >= MINIMO_OFERTAS else None,
        modalidad=dict(sorted(Counter(f.ext.modalidad for f in filas).items())),
    )


def _grupos(filas: list[Fila], llave, nombres: dict[str, str] | None = None) -> list[Grupo]:
    por: dict[str, list[Fila]] = {}
    for f in filas:
        por.setdefault(llave(f), []).append(f)
    return [
        Grupo(id=k, nombre=(nombres or {}).get(k, k), celda=celda(v))
        for k, v in sorted(por.items(), key=lambda x: (-len(x[1]), x[0]))
    ]


def nombre_mes(m: str) -> str:
    a, n = m.split("-")
    return f"{MESES[int(n) - 1]} de {a}"


def procesar(
    lectura: Lectura,
    extracciones: dict[str, Extraccion],
    sectores: dict[str, str],
    norm: Normalizador,
    origen: str,
    informalidad: Informalidad | None = None,
    marca: str | None = None,
    hoy: date | None = None,
) -> Resultado:
    hoy = hoy or datetime.now(UTC).date()
    filas = [preparar(o, extracciones[o.id], norm) for o in lectura.ofertas if o.id in extracciones]
    meses = sorted({f.mes for f in filas})
    nombres_mes = {m: nombre_mes(m) for m in meses}
    por_sector: dict[str, list[Fila]] = {s: [] for s in sectores}
    for f in filas:
        por_sector[f.oferta.sector].append(f)

    resumen = Resumen(
        marca=marca,
        total=celda(filas),
        sectores=[
            SectorResumen(id=s, nombre=n, celda=celda(por_sector[s]))
            for s, n in sorted(sectores.items(), key=lambda x: (-len(por_sector[x[0]]), x[1]))
        ],
        provincias=_grupos(filas, lambda f: f.oferta.provincia),
        meses=sorted(_grupos(filas, lambda f: f.mes, nombres_mes), key=lambda g: g.id),
    )
    detalle = [
        Sector(
            marca=marca,
            id=s,
            nombre=sectores[s],
            celda=celda(v),
            provincias=_grupos(v, lambda f: f.oferta.provincia),
            meses=sorted(_grupos(v, lambda f: f.mes, nombres_mes), key=lambda g: g.id),
        )
        for s, v in por_sector.items()
        if len(v) >= MINIMO_OFERTAS
    ]
    fechas = sorted(f.oferta.fecha_publicacion for f in filas)
    meta = Meta(
        origen=origen,
        marca=marca,
        fecha_proceso=hoy.isoformat(),
        fecha_inicio=fechas[0].isoformat() if fechas else None,
        fecha_fin=fechas[-1].isoformat() if fechas else None,
        filas_leidas=lectura.filas_leidas,
        ofertas_validas=len(lectura.ofertas),
        ofertas_con_extraccion=len(filas),
        ofertas_sin_extraccion=len(lectura.ofertas) - len(filas),
        filas_descartadas=[Descarte(motivo=m, filas=n) for m, n in sorted(lectura.descartes.items())],
        fuentes_ofertas=sorted({f.oferta.fuente for f in filas}),
        modelo_extraccion=MODELO,
        esco_disponible=norm.esco_disponible,
        informalidad=informalidad,
        fuentes=[
            FuenteMeta(
                id="esco",
                nombre="ESCO, clasificación europea de capacidades y ocupaciones",
                url="https://esco.ec.europa.eu/es",
                licencia="Reutilización libre con atribución",
                fecha_texto=f"etiquetas usadas el {fecha_texto(hoy)}",
            )
        ]
        if norm.esco_disponible
        else [],
    )
    return Resultado(resumen=resumen, sectores=detalle, meta=meta)


def leer_informalidad(ruta: Path) -> Informalidad | None:
    """raw/empleo/inec/informalidad.csv con columnas porcentaje, periodo, fuente y url (una fila)."""
    if not ruta.exists():
        return None
    df = pd.read_csv(ruta, dtype=str, keep_default_na=False)
    if df.empty:
        return None
    f = df.iloc[0]
    return Informalidad(
        porcentaje=float(f["porcentaje"].replace(",", ".")),
        periodo=f["periodo"],
        fuente=f["fuente"],
        url=f["url"],
    )


def escribir(r: Resultado, destino: Path = PUBLIC_DATA / "empleo") -> None:
    if (destino / "sectores").exists():
        shutil.rmtree(destino / "sectores")
    escribir_json(destino / "resumen.json", r.resumen.model_dump())
    for s in r.sectores:
        escribir_json(destino / "sectores" / f"{s.id}.json", s.model_dump())
    escribir_json(destino / "meta.json", r.meta.model_dump(), compacto=False)
