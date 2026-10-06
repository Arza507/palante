"""Procesamiento del 311: limpieza, unión con polígonos, categorías, agregados y salidas."""

import json
from dataclasses import dataclass, field
from datetime import UTC, date, datetime
from pathlib import Path

import geopandas as gpd
import pandas as pd
import topojson

from palante_pipeline.comun.salida import CONFIG, PUBLIC_DATA, RAIZ, escribir_json, fecha_texto
from palante_pipeline.comun.texto import clave, slug
from palante_pipeline.m311 import lectura
from palante_pipeline.m311.modelo import (
    Categoria,
    ConjuntoMeta,
    Corregimiento,
    Descarte,
    Estado,
    FuenteMeta,
    Mediana,
    Meta,
    PeriodoFilas,
    Resumen,
    Trimestre,
)
from palante_pipeline.m311.poblacion import Poblacion

CATEGORIAS = [
    ("agua", "Agua y alcantarillado"),
    ("calles", "Calles y aceras"),
    ("basura", "Basura y limpieza"),
    ("alumbrado", "Alumbrado"),
    ("drenajes", "Drenajes e inundaciones"),
    ("arboles", "Árboles y áreas verdes"),
    ("ruido", "Ruido y convivencia"),
    ("otros", "Otros"),
]
MESES_TRIMESTRE = {1: "enero a marzo", 2: "abril a junio", 3: "julio a septiembre", 4: "octubre a diciembre"}
MINIMO_CASOS_MEDIANA = 5
FORMATO_FECHA = "%Y-%m-%d %H:%M:%S"


@dataclass
class Config:
    categoria_de_servicio: dict[str, str]
    genericos: set[str]
    estados: pd.DataFrame
    alias: dict[str, str]


def cargar_config(carpeta: Path = CONFIG) -> Config:
    cat = pd.read_csv(carpeta / "categorias_311.csv", dtype=str)
    nombres_validos = {n for _, n in CATEGORIAS}
    malas = set(cat["categoria"]) - nombres_validos
    if malas:
        raise ValueError(f"categorias_311.csv tiene categorías desconocidas: {sorted(malas)}")
    ids = {n: i for i, n in CATEGORIAS}
    alias = pd.read_csv(carpeta / "alias_corregimientos.csv", dtype=str)
    return Config(
        categoria_de_servicio={
            clave(s): ids[c] for s, c in zip(cat["servicio"], cat["categoria"], strict=True)
        },
        genericos={clave(s) for s in pd.read_csv(carpeta / "servicios_genericos.csv", dtype=str)["servicio"]},
        estados=pd.read_csv(carpeta / "estados_311.csv", dtype=str),
        alias={clave(a): clave(c) for a, c in zip(alias["alias"], alias["corregimiento"], strict=True)},
    )


def servicio_principal(servicios: str, genericos: set[str]) -> str:
    """El primer servicio que describe el problema; si todos son genéricos, el primero."""
    partes = [p.strip() for p in str(servicios).split(",") if p.strip()]
    for p in partes:
        if clave(p) not in genericos:
            return p
    return partes[0] if partes else ""


def trimestre(fecha: pd.Timestamp) -> str:
    return f"{fecha.year}-T{(fecha.month - 1) // 3 + 1}"


def nombre_trimestre(tid: str) -> str:
    anio, q = tid.split("-T")
    return f"{MESES_TRIMESTRE[int(q)]} de {anio}"


@dataclass
class Resultado:
    limpio: pd.DataFrame
    resumen: Resumen
    meta: Meta
    descartes: list[Descarte] = field(default_factory=list)
    sin_poligono: dict[str, int] = field(default_factory=dict)


def procesar(
    archivos: list[Path],
    poligonos: gpd.GeoDataFrame,
    config: Config,
    conjuntos: list[dict],
    fecha_osm: str,
    poblacion: Poblacion | None,
    hoy: date | None = None,
) -> tuple[Resultado, list]:
    df, perfiles, leidas = lectura.leer(archivos)
    descartes: list[Descarte] = []
    if not conjuntos:
        raise ValueError("Falta la lista de conjuntos de datos del 311")
    # El conjunto más reciente da el nombre y el enlace principal de la fuente.
    principal = conjuntos[0]
    df["mes"] = (
        df["fecha_creacion"]
        .fillna("")
        .str.slice(0, 7)
        .where(df["fecha_creacion"].fillna("").str.match(r"^\d{4}-\d{2}"), "sin fecha")
    )
    leidas_periodo = df.groupby(["archivo", "mes"]).size()

    def descartar(mascara: pd.Series, motivo: str, detalle: list[str] | None = None) -> None:
        nonlocal df
        n = int(mascara.sum())
        if n:
            descartes.append(Descarte(motivo=motivo, filas=n, detalle=detalle or []))
            df = df[~mascara].copy()

    # Casos repetidos entre archivos: se queda la versión con el último cambio más reciente.
    df = df.sort_values("ultimo_cambio", na_position="first")
    descartar(df.duplicated("caso", keep="last"), "caso repetido en más de un archivo")

    df["fecha_creacion"] = pd.to_datetime(df["fecha_creacion"], format=FORMATO_FECHA, errors="coerce")
    df["ultimo_cambio"] = pd.to_datetime(df["ultimo_cambio"], format=FORMATO_FECHA, errors="coerce")
    descartar(df["fecha_creacion"].isna(), "fecha de creación vacía o inválida")

    df["corregimiento_original"] = df["corregimiento_original"].fillna("").str.strip()
    descartar(df["corregimiento_original"] == "", "sin corregimiento")

    # Unión con los polígonos de OSM por clave normalizada y alias.
    por_clave = {clave(n): (s, n) for s, n in zip(poligonos["slug"], poligonos["nombre"], strict=True)}
    claves = df["corregimiento_original"].map(clave).map(lambda k: config.alias.get(k, k))
    df["corregimiento_slug"] = claves.map(lambda k: por_clave.get(k, (None, None))[0])
    sin = df[df["corregimiento_slug"].isna()]["corregimiento_original"].value_counts()
    sin_poligono = {str(k): int(v) for k, v in sin.items()}
    descartar(
        df["corregimiento_slug"].isna(),
        "corregimiento fuera del distrito de Panamá o sin polígono",
        [f"{k} ({v})" for k, v in sin_poligono.items()],
    )

    estados = config.estados
    mapa_estado = {clave(o): e for o, e in zip(estados["estado_original"], estados["estado"], strict=True)}
    desconocidos = df[~df["estado_original"].map(clave).isin(mapa_estado)]["estado_original"].value_counts()
    descartar(
        ~df["estado_original"].map(clave).isin(mapa_estado),
        "estado desconocido",
        [f"{k} ({v})" for k, v in desconocidos.items()],
    )
    df["estado"] = df["estado_original"].map(clave).map(mapa_estado)
    resueltos = set(estados.loc[estados["resuelto"] == "si", "estado"])

    df["servicio_principal"] = df["servicios"].map(lambda s: servicio_principal(s, config.genericos))
    df["categoria"] = df["servicio_principal"].map(
        lambda s: config.categoria_de_servicio.get(clave(s), "otros")
    )
    servicios_sin_categoria = sorted(
        {
            p.strip()
            for s in df["servicios"]
            for p in str(s).split(",")
            if p.strip() and clave(p) not in config.categoria_de_servicio
        }
    )

    df["trimestre"] = df["fecha_creacion"].map(trimestre)
    dias = (df["ultimo_cambio"] - df["fecha_creacion"]).dt.total_seconds() / 86400
    df["dias_hasta_cierre"] = dias.where(df["estado"].isin(resueltos) & (dias >= 0)).round(1)

    # Listas ordenadas para los índices del resumen.
    lista_estados = list(dict.fromkeys(estados["estado"]))
    lista_trimestres = sorted(df["trimestre"].unique())
    corr = poligonos[["slug", "nombre"]].sort_values("slug").reset_index(drop=True)
    idx_corr = {s: i for i, s in enumerate(corr["slug"])}
    idx_cat = {c: i for i, (c, _) in enumerate(CATEGORIAS)}
    idx_tri = {t: i for i, t in enumerate(lista_trimestres)}
    idx_est = {e: i for i, e in enumerate(lista_estados)}

    grupos = df.groupby(["corregimiento_slug", "categoria", "trimestre", "estado"]).size()
    conteos = sorted(
        (idx_corr[c], idx_cat[k], idx_tri[t], idx_est[e], int(n))
        for (c, k, t, e), n in grupos.items()
        if n > 0
    )

    def mediana(serie: pd.Series) -> Mediana:
        s = serie.dropna()
        if len(s) < MINIMO_CASOS_MEDIANA:
            return Mediana(mediana=None, n=len(s))
        return Mediana(mediana=round(float(s.median()), 1), n=len(s))

    resumen = Resumen(
        categorias=[Categoria(id=i, nombre=n) for i, n in CATEGORIAS],
        estados=[Estado(id=slug(e), nombre=e, resuelto=e in resueltos) for e in lista_estados],
        trimestres=[Trimestre(id=t, nombre=nombre_trimestre(t)) for t in lista_trimestres],
        corregimientos=[
            Corregimiento(
                slug=r.slug,
                nombre=r.nombre,
                poblacion=poblacion.por_clave.get(clave(r.nombre)) if poblacion else None,
            )
            for r in corr.itertuples()
        ],
        conteos=conteos,
        total=len(df),
        dias_cierre_distrito=mediana(df["dias_hasta_cierre"]),
        dias_cierre={s: mediana(g["dias_hasta_cierre"]) for s, g in df.groupby("corregimiento_slug")},
        minimo_casos_mediana=MINIMO_CASOS_MEDIANA,
    )

    validas_periodo = df.groupby(["archivo", "mes"]).size()
    inicio, fin = df["fecha_creacion"].min().date(), df["fecha_creacion"].max().date()
    hoy = hoy or datetime.now(UTC).date()
    con_poblacion = poblacion is not None and all(c.poblacion for c in resumen.corregimientos)
    fecha_osm_d = date.fromisoformat(fecha_osm) if fecha_osm else hoy
    fuentes = [
        FuenteMeta(
            id="311",
            nombre="; ".join(c["titulo"] for c in conjuntos),
            url=principal["url"],
            licencia="CC0 1.0",
            fecha_texto=f"casos creados del {fecha_texto(inicio)} al {fecha_texto(fin)}",
        ),
        FuenteMeta(
            id="osm",
            nombre="Límites de corregimientos de OpenStreetMap",
            url="https://www.openstreetmap.org/relation/8415626",
            licencia="ODbL 1.0",
            fecha_texto=f"descargados el {fecha_texto(fecha_osm_d)}",
        ),
    ]
    if con_poblacion and poblacion:
        fuentes.append(
            FuenteMeta(
                id="inec",
                nombre=f"Censo de Población y Vivienda {poblacion.censo}",
                url=poblacion.url,
                licencia="Información pública del INEC",
                fecha_texto=f"censo de {poblacion.censo}",
            )
        )
    meta = Meta(
        fuente=principal["titulo"],
        url=principal["url"],
        licencia="CC0 1.0 (dominio público)",
        fecha_datos=fin.isoformat(),
        fecha_datos_texto=fecha_texto(fin),
        periodo_inicio=inicio.isoformat(),
        periodo_fin=fin.isoformat(),
        fecha_proceso=hoy.isoformat(),
        archivos=sorted({Path(a).name for a in archivos}),
        conjuntos=[ConjuntoMeta(titulo=c["titulo"], url=c["url"]) for c in conjuntos],
        filas_por_periodo=[
            PeriodoFilas(archivo=a, mes=m, leidas=int(n), validas=int(validas_periodo.get((a, m), 0)))
            for (a, m), n in sorted(leidas_periodo.items())
        ],
        filas_leidas=leidas,
        filas_validas=len(df),
        filas_descartadas=descartes,
        servicios_sin_categoria=servicios_sin_categoria,
        poblacion_disponible=con_poblacion,
        poblacion_nota=(
            f"Tasas calculadas con la población del censo {poblacion.censo} del INEC."
            if con_poblacion and poblacion
            else "Todavía no tenemos la población por corregimiento del INEC. "
            "El mapa muestra el número de reportes, no la tasa por habitante."
        ),
        fuentes=fuentes,
    )
    limpio = df.assign(
        corregimiento=df["corregimiento_slug"].map(dict(zip(corr["slug"], corr["nombre"], strict=True))),
        fecha_creacion=df["fecha_creacion"].dt.strftime(FORMATO_FECHA),
        ultimo_cambio=df["ultimo_cambio"].dt.strftime(FORMATO_FECHA),
    )[
        [
            "caso",
            "fecha_creacion",
            "ultimo_cambio",
            "trimestre",
            "estado_original",
            "estado",
            "canal",
            "servicios",
            "categoria",
            "corregimiento",
            "dias_hasta_cierre",
        ]
    ].sort_values(["fecha_creacion", "caso"])
    return Resultado(
        limpio=limpio, resumen=resumen, meta=meta, descartes=descartes, sin_poligono=sin_poligono
    ), perfiles


def topologia(poligonos: gpd.GeoDataFrame, simplificar: float = 0.0004) -> dict:
    """TopoJSON simplificado que conserva los bordes compartidos entre corregimientos."""
    gdf = poligonos[["slug", "nombre", "geometry"]].copy()
    topo = topojson.Topology(gdf, prequantize=100_000, toposimplify=simplificar, prevent_oversimplify=True)
    datos = json.loads(topo.to_json())
    datos["objects"] = {"corregimientos": next(iter(datos["objects"].values()))}
    return datos


def escribir(resultado: Resultado, topo: dict, destino: Path = PUBLIC_DATA / "311") -> None:
    destino.mkdir(parents=True, exist_ok=True)
    escribir_json(destino / "resumen.json", resultado.resumen.model_dump())
    escribir_json(destino / "meta.json", resultado.meta.model_dump(), compacto=False)
    escribir_json(destino / "corregimientos.topo.json", topo)
    resultado.limpio.to_csv(destino / "311-limpio.csv", index=False, encoding="utf-8", lineterminator="\n")


def escribir_documentacion(
    perfiles: list, resultado: Resultado, ruta: Path = RAIZ / "docs" / "datos-311.md"
) -> None:
    m = resultado.meta
    lineas = [
        "# Datos del 311: columnas reales",
        "",
        "Generado por el pipeline (`uv run python -m palante_pipeline 311`). No editar a mano.",
        "",
        *[f"- Fuente: [{c.titulo}]({c.url}), licencia {m.licencia}." for c in m.conjuntos],
        f"- Casos creados del {m.periodo_inicio} al {m.periodo_fin}. Procesado el {m.fecha_proceso}.",
        f"- Filas leídas: {m.filas_leidas}. Válidas: {m.filas_validas}.",
        "",
        "Las columnas de nombre y detalle se eliminan al leer. No se muestran ejemplos de ellas.",
        "",
    ]
    for p in perfiles:
        lineas += [
            f"## {p.archivo}, hoja «{p.hoja}»",
            "",
            f"{p.filas} filas.",
            "",
            "| Columna | Tipo | Vacías | Distintos | Ejemplos o tratamiento |",
            "| --- | --- | --- | --- | --- |",
        ]
        for c in p.columnas:
            ej = c.omitida or "; ".join(e.replace("|", "/")[:60] for e in c.ejemplos)
            lineas.append(f"| {c.nombre} | {c.tipo} | {c.vacias} | {c.distintos} | {ej} |")
        lineas.append("")
    lineas += [
        "## Filas por archivo y mes de creación",
        "",
        "| Archivo | Mes | Leídas | Válidas |",
        "| --- | --- | --- | --- |",
        *[f"| {p.archivo} | {p.mes} | {p.leidas} | {p.validas} |" for p in m.filas_por_periodo],
        "",
        "## Filas descartadas",
        "",
    ]
    if not m.filas_descartadas:
        lineas.append("Ninguna.")
    for d in m.filas_descartadas:
        extra = f": {', '.join(d.detalle)}" if d.detalle else ""
        lineas.append(f"- {d.motivo}: {d.filas}{extra}.")
    lineas += ["", "## Servicios sin categoría en config/categorias_311.csv", ""]
    lineas += [f"- {s}" for s in m.servicios_sin_categoria] or ["Ninguno."]
    ruta.write_text("\n".join(lineas) + "\n", encoding="utf-8")
