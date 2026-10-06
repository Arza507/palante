"""Genera los datos de prueba del módulo de empleo. Todo es inventado y lleva la marca FIXTURE.

Uso (desde pipeline/): uv run python ../fixtures/generar_fixtures_empleo.py

- fixtures/empleo/ofertas-fixture.csv: 20 ofertas válidas y 3 filas que el pipeline debe descartar.
- fixtures/empleo/extracciones-fixture.json: la extracción esperada de cada una de las 20 ofertas.
- fixtures/empleo/esco-fixture.csv: unas pocas etiquetas con el formato del CSV oficial de ESCO.
- fixtures/web/data/empleo/: salidas del pipeline con 20 + 60 ofertas, para probar la web.
"""

import csv
import json
import random
import tempfile
from datetime import date, timedelta
from pathlib import Path

from palante_pipeline.empleo import extraccion, lectura, normalizacion, proceso
from palante_pipeline.empleo.modelo import Extraccion

AQUI = Path(__file__).resolve().parent
DESTINO = AQUI / "empleo"
WEB = AQUI / "web" / "data" / "empleo"
COLUMNAS = lectura.COLUMNAS


def ext(hab, her, idi=(), exp=None, edu="no indicado", mod="presencial", sal=None) -> dict:
    return Extraccion(
        habilidades=list(hab),
        herramientas=list(her),
        idiomas=[{"idioma": i, "nivel": n} for i, n in idi],
        anios_experiencia=exp,
        nivel_educativo=edu,
        modalidad=mod,
        salario={"minimo": sal[0], "maximo": sal[1], "periodo": "mes"} if sal else None,
    ).model_dump()


# id, fecha, provincia, sector, salario_min, salario_max, título, texto, extracción esperada
OFERTAS = [
    (
        "F-0001",
        "2026-08-03",
        "Panamá",
        "tecnologia",
        "1500",
        "1800",
        "Analista de datos",
        "FIXTURE. Buscamos analista de datos con 2 años de experiencia en SQL y Power BI. Inglés intermedio. "
        "Licenciatura en estadística o afines. Trabajo híbrido en Costa del Este. Escribe a rrhh@ejemplo.com.",
        ext(
            ["Análisis de datos"],
            ["SQL", "Power BI"],
            [("Inglés", "intermedio")],
            2,
            "universitario",
            "hibrido",
        ),
    ),
    (
        "F-0002",
        "2026-08-05",
        "Panamá",
        "tecnologia",
        "",
        "",
        "Desarrollador web",
        "FIXTURE. Empresa de software busca desarrollador web con JavaScript y React. 3 años de experiencia. "
        "Inglés avanzado. Trabajo remoto. Salario de 2.000 dólares al mes.",
        ext(
            ["Desarrollo web"],
            ["JavaScript", "React"],
            [("Inglés", "avanzado")],
            3,
            "no indicado",
            "remoto",
            (2000, 2000),
        ),
    ),
    (
        "F-0003",
        "2026-08-07",
        "Panamá",
        "tecnologia",
        "900",
        "1100",
        "Soporte técnico",
        "FIXTURE. Se necesita técnico de soporte con conocimientos de redes y Windows. Atención al cliente. "
        "Técnico superior en informática. Presencial en Calidonia. Llamar al 6000-0000.",
        ext(["Soporte técnico", "Redes", "Atención al cliente"], ["Windows"], (), None, "tecnico"),
    ),
    (
        "F-0004",
        "2026-08-10",
        "Panamá Oeste",
        "tecnologia",
        "",
        "",
        "Técnico de redes",
        "FIXTURE. Técnico de redes para instalaciones en La Chorrera. Cableado estructurado y fibra óptica. "
        "Licencia de conducir. 1 año de experiencia.",
        ext(["Redes", "Cableado estructurado"], ["Fibra óptica", "Licencia de conducir"], (), 1),
    ),
    (
        "F-0005",
        "2026-08-12",
        "Panamá",
        "tecnologia",
        "2500",
        "3000",
        "Ingeniero de datos",
        "FIXTURE. Ingeniero de datos con Python, SQL y AWS. Inglés avanzado. 4 años de experiencia. "
        "Modalidad híbrida. Universitario en sistemas.",
        ext(
            ["Ingeniería de datos"],
            ["Python", "SQL", "AWS"],
            [("Inglés", "avanzado")],
            4,
            "universitario",
            "hibrido",
        ),
    ),
    (
        "F-0006",
        "2026-08-14",
        "Panamá",
        "tecnologia",
        "",
        "",
        "Analista de sistemas",
        "FIXTURE. Analista de sistemas para banco. SQL Server y Excel avanzado. Trabajo en equipo. "
        "Inglés intermedio. Presencial.",
        ext(
            ["Análisis de sistemas", "Trabajo en equipo"],
            ["SQL Server", "Excel avanzado"],
            [("Inglés", "intermedio")],
        ),
    ),
    (
        "F-0007",
        "2026-08-18",
        "Chiriquí",
        "tecnologia",
        "",
        "",
        "Técnico en computadoras",
        "FIXTURE. Técnico en reparación de computadoras en David. Atención al cliente y manejo de caja.",
        ext(["Reparación de computadoras", "Atención al cliente", "Manejo de caja"], []),
    ),
    (
        "F-0008",
        "2026-09-01",
        "Panamá",
        "tecnologia",
        "1200",
        "1400",
        "Diseñador UX",
        "FIXTURE. Diseñador UX con Figma. Inglés básico. 2 años de experiencia. Remoto.",
        ext(
            ["Diseño de experiencia de usuario"],
            ["Figma"],
            [("Inglés", "basico")],
            2,
            "no indicado",
            "remoto",
        ),
    ),
    (
        "F-0009",
        "2026-09-03",
        "Panamá",
        "tecnologia",
        "",
        "",
        "Administrador de bases de datos",
        "FIXTURE. Administrador de bases de datos PostgreSQL y MySQL. 5 años de experiencia. Universitario.",
        ext(["Administración de bases de datos"], ["PostgreSQL", "MySQL"], (), 5, "universitario"),
    ),
    (
        "F-0010",
        "2026-09-08",
        "Panamá",
        "tecnologia",
        "",
        "",
        "Desarrollador móvil",
        "FIXTURE. Desarrollador de aplicaciones móviles con Kotlin y Swift. Inglés intermedio. Híbrido.",
        ext(
            ["Desarrollo de aplicaciones móviles"],
            ["Kotlin", "Swift"],
            [("Inglés", "intermedio")],
            None,
            "no indicado",
            "hibrido",
        ),
    ),
    (
        "F-0011",
        "2026-09-10",
        "Panamá",
        "tecnologia",
        "1000",
        "1000",
        "Asistente de TI",
        "FIXTURE. Asistente de TI con paquete Office y soporte a usuarios. Secundaria completa. Presencial.",
        ext(["Soporte técnico"], ["Paquete Office"], (), None, "secundaria"),
    ),
    (
        "F-0012",
        "2026-09-15",
        "Colón",
        "tecnologia",
        "",
        "",
        "Técnico de sistemas portuarios",
        "FIXTURE. Técnico de sistemas para terminal portuaria en Colón. SAP y redes. Inglés intermedio.",
        ext(["Redes"], ["SAP"], [("Inglés", "intermedio")]),
    ),
    (
        "F-0013",
        "2026-08-04",
        "Colón",
        "logistica",
        "",
        "",
        "Operador de montacargas",
        "FIXTURE. Operador de montacargas para zona libre. Licencia de conducir y 2 años de experiencia.",
        ext(["Operación de montacargas"], ["Montacargas", "Licencia de conducir"], (), 2),
    ),
    (
        "F-0014",
        "2026-08-11",
        "Panamá",
        "logistica",
        "800",
        "900",
        "Auxiliar de bodega",
        "FIXTURE. Auxiliar de bodega con manejo de inventario y Excel. Secundaria completa.",
        ext(["Manejo de inventario"], ["Excel"], (), None, "secundaria"),
    ),
    (
        "F-0015",
        "2026-08-25",
        "Panamá Oeste",
        "logistica",
        "",
        "",
        "Conductor de reparto",
        "FIXTURE. Conductor de reparto con licencia tipo C. Atención al cliente.",
        ext(["Conducción", "Atención al cliente"], ["Licencia de conducir"]),
    ),
    (
        "F-0016",
        "2026-09-02",
        "Colón",
        "logistica",
        "",
        "",
        "Coordinador de aduanas",
        "FIXTURE. Coordinador de trámites aduaneros. Inglés avanzado. Universitario. 3 años.",
        ext(["Trámites aduaneros", "Coordinación"], [], [("Inglés", "avanzado")], 3, "universitario"),
    ),
    (
        "F-0017",
        "2026-09-12",
        "Panamá",
        "logistica",
        "",
        "",
        "Planificador de rutas",
        "FIXTURE. Planificador de rutas de distribución con Excel avanzado y SAP. Trabajo en equipo.",
        ext(["Planificación de rutas", "Trabajo en equipo"], ["Excel avanzado", "SAP"]),
    ),
    (
        "F-0018",
        "2026-08-06",
        "Panamá",
        "comercio",
        "650",
        "700",
        "Vendedor de tienda",
        "FIXTURE. Vendedor para tienda en Los Andes. Atención al cliente y manejo de caja.",
        ext(["Ventas", "Atención al cliente", "Manejo de caja"], []),
    ),
    (
        "F-0019",
        "2026-08-20",
        "Chiriquí",
        "comercio",
        "",
        "",
        "Cajero",
        "FIXTURE. Cajero para supermercado en David. Manejo de caja. Secundaria.",
        ext(["Manejo de caja"], [], (), None, "secundaria"),
    ),
    (
        "F-0020",
        "2026-09-05",
        "Panamá",
        "comercio",
        "",
        "",
        "Ejecutivo de ventas",
        "FIXTURE. Ejecutivo de ventas con licencia de conducir. Inglés básico. Comunicación efectiva.",
        ext(["Ventas", "Comunicación efectiva"], ["Licencia de conducir"], [("Inglés", "basico")]),
    ),
]

# Filas que el pipeline debe descartar: sin texto, duplicada (mismo título y empresa a 3 días) y sector inválido.
DESCARTES = [
    ("F-0021", "2026-08-08", "Panamá", "tecnologia", "", "", "Analista de datos", ""),
    (
        "F-0022",
        "2026-08-06",
        "Panamá",
        "tecnologia",
        "1500",
        "1800",
        "Analista de datos",
        "FIXTURE. Repetida: buscamos analista de datos con SQL y Power BI, publicada de nuevo.",
    ),
    (
        "F-0023",
        "2026-08-09",
        "Panamá",
        "pesca",
        "",
        "",
        "Marinero",
        "FIXTURE. Marinero para barco pesquero con experiencia en redes de pesca.",
    ),
]
EMPRESA = {"F-0001": "Empresa FIXTURE A", "F-0022": "Empresa FIXTURE A"}


def fila(o, texto=None) -> dict:
    i, f, prov, sec, smin, smax, tit, txt = o[:8]
    d = date.fromisoformat(f)
    return {
        "id": i,
        "fecha_publicacion": f,
        "fuente": "Portal FIXTURE",
        "url": "",
        "titulo": tit,
        "empresa": EMPRESA.get(i, ""),
        "provincia": prov,
        "sector": sec,
        "salario_min": smin,
        "salario_max": smax,
        "texto": txt if texto is None else texto,
        "fecha_recoleccion": (d + timedelta(days=2)).isoformat(),
    }


def escribir_csv(ruta: Path, filas: list[dict]) -> None:
    with ruta.open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=COLUMNAS, lineterminator="\n")
        w.writeheader()
        w.writerows(filas)


ESCO = [
    (
        "http://data.europa.eu/esco/skill/FIXTURE-1",
        "atender a los clientes",
        "Atención al cliente\nservicio al cliente",
    ),
    ("http://data.europa.eu/esco/skill/FIXTURE-2", "SQL", "lenguaje SQL"),
    ("http://data.europa.eu/esco/skill/FIXTURE-3", "trabajar en equipo", "Trabajo en equipo"),
]

SINTETICAS = {
    # sector: (ofertas, habilidades, herramientas)
    "tecnologia": (
        18,
        ["Desarrollo web", "Análisis de datos", "Soporte técnico", "Redes"],
        ["Python", "SQL", "JavaScript", "Power BI", "Excel"],
    ),
    "logistica": (
        12,
        ["Manejo de inventario", "Conducción", "Trámites aduaneros"],
        ["Montacargas", "SAP", "Excel", "Licencia de conducir"],
    ),
    "turismo": (14, ["Atención al cliente", "Cocina", "Recepción"], ["Opera PMS", "Paquete Office"]),
    "salud": (6, ["Enfermería", "Atención al paciente"], ["Expediente clínico electrónico"]),
    "administracion": (10, ["Contabilidad", "Nómina"], ["Excel", "SAP", "QuickBooks"]),
}
PROVINCIAS = ["Panamá"] * 6 + ["Panamá Oeste"] * 2 + ["Colón", "Chiriquí"]


def sinteticas() -> tuple[list[dict], dict]:
    rnd = random.Random(507)
    filas, exts = [], {}
    n = 100
    for sec, (cuantas, habs, hers) in SINTETICAS.items():
        for _ in range(cuantas):
            n += 1
            i = f"S-{n:04d}"
            d = date(2026, 8, 1) + timedelta(days=rnd.randrange(0, 60))
            h = rnd.sample(habs, k=min(len(habs), rnd.randint(1, 3)))
            t = rnd.sample(hers, k=min(len(hers), rnd.randint(1, 3)))
            ingles = rnd.random() < 0.45
            sal = rnd.choice([None, None, (700, 900), (1000, 1300), (1500, 2000)])
            texto = (
                f"FIXTURE. Oferta sintética {i} del sector {sec}. Pide {', '.join(h)} y {', '.join(t)}."
                + (" Inglés intermedio." if ingles else "")
            )
            filas.append(
                {
                    "id": i,
                    "fecha_publicacion": d.isoformat(),
                    "fuente": "Portal FIXTURE",
                    "url": "",
                    "titulo": f"Puesto FIXTURE {n}",
                    "empresa": "",
                    "provincia": rnd.choice(PROVINCIAS),
                    "sector": sec,
                    "salario_min": str(sal[0]) if sal else "",
                    "salario_max": str(sal[1]) if sal else "",
                    "texto": texto,
                    "fecha_recoleccion": (d + timedelta(days=1)).isoformat(),
                }
            )
            exts[i] = ext(
                h,
                t,
                [("Inglés", "intermedio")] if ingles else (),
                rnd.choice([None, 1, 2, 3]),
                rnd.choice(["secundaria", "tecnico", "universitario", "no indicado"]),
                rnd.choice(["presencial", "presencial", "hibrido", "remoto"]),
            )
    return filas, exts


def main() -> None:
    DESTINO.mkdir(parents=True, exist_ok=True)
    filas = [fila(o) for o in OFERTAS] + [fila(o) for o in DESCARTES]
    escribir_csv(DESTINO / "ofertas-fixture.csv", filas)
    esperadas = {o[0]: o[8] for o in OFERTAS}
    (DESTINO / "extracciones-fixture.json").write_text(
        json.dumps({"marca": "FIXTURE", "extracciones": esperadas}, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    with (DESTINO / "esco-fixture.csv").open("w", encoding="utf-8", newline="") as f:
        w = csv.writer(f, lineterminator="\n")
        w.writerow(["conceptType", "conceptUri", "preferredLabel", "altLabels"])
        for uri, pref, alt in ESCO:
            w.writerow(["KnowledgeSkillCompetence", uri, pref, alt])

    # Salidas para la web: 20 ofertas fijas + 60 sintéticas, con la caché sembrada (sin API).
    extra, extra_ext = sinteticas()
    with tempfile.TemporaryDirectory() as tmp:
        tmp = Path(tmp)
        escribir_csv(tmp / "ofertas.csv", filas + extra)
        sectores = proceso.cargar_sectores()
        lec = lectura.leer(tmp / "ofertas.csv", set(sectores), proceso.cargar_provincias())
        todas = {**esperadas, **extra_ext}
        cache = tmp / "cache"
        for o in lec.ofertas:
            extraccion.guardar_cache(
                o, Extraccion.model_validate(todas[o.id]), {"entrada": 0, "salida": 0}, cache
            )
        exts = {o.id: e for o in lec.ofertas if (e := extraccion.leer_cache(o, cache))}
        norm = normalizacion.cargar(esco=DESTINO / "esco-fixture.csv")
        r = proceso.procesar(
            lec,
            exts,
            sectores,
            norm,
            "FIXTURE: ofertas inventadas para pruebas",
            marca="FIXTURE",
            hoy=date(2026, 10, 5),
        )
        proceso.escribir(r, WEB)
    print(f"Fixtures de empleo: {len(filas)} filas; web con {r.meta.ofertas_con_extraccion} ofertas.")


if __name__ == "__main__":
    main()
