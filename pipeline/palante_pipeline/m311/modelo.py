"""Esquemas de las salidas del módulo 311, validados con pydantic antes de escribir."""

from pydantic import BaseModel, Field, model_validator


class Categoria(BaseModel):
    id: str
    nombre: str


class Estado(BaseModel):
    id: str
    nombre: str
    resuelto: bool


class Trimestre(BaseModel):
    id: str = Field(pattern=r"^\d{4}-T[1-4]$")
    nombre: str


class Corregimiento(BaseModel):
    slug: str
    nombre: str
    poblacion: int | None = Field(default=None, gt=0)


class Mediana(BaseModel):
    mediana: float | None = Field(ge=0)
    n: int = Field(ge=0)


class Resumen(BaseModel):
    version: int = 1
    categorias: list[Categoria]
    estados: list[Estado]
    trimestres: list[Trimestre]
    corregimientos: list[Corregimiento]
    # [corregimiento, categoría, trimestre, estado, casos] con índices sobre las listas anteriores.
    conteos: list[tuple[int, int, int, int, int]]
    total: int = Field(ge=0)
    dias_cierre_distrito: Mediana
    dias_cierre: dict[str, Mediana]
    minimo_casos_mediana: int

    @model_validator(mode="after")
    def coherente(self) -> "Resumen":
        if sum(c[4] for c in self.conteos) != self.total:
            raise ValueError("La suma de los conteos no coincide con el total")
        limites = (len(self.corregimientos), len(self.categorias), len(self.trimestres), len(self.estados))
        for c in self.conteos:
            if any(not 0 <= c[i] < limites[i] for i in range(4)) or c[4] <= 0:
                raise ValueError(f"Conteo fuera de rango: {c}")
        slugs = {c.slug for c in self.corregimientos}
        if set(self.dias_cierre) - slugs:
            raise ValueError("dias_cierre tiene corregimientos desconocidos")
        return self


class Descarte(BaseModel):
    motivo: str
    filas: int = Field(gt=0)
    detalle: list[str] = []


class FuenteMeta(BaseModel):
    id: str
    nombre: str
    url: str
    licencia: str
    fecha_texto: str


class ConjuntoMeta(BaseModel):
    titulo: str
    url: str


class PeriodoFilas(BaseModel):
    archivo: str
    # Mes de creación del caso (AAAA-MM) o "sin fecha".
    mes: str
    leidas: int = Field(ge=0)
    validas: int = Field(ge=0)


class Meta(BaseModel):
    modulo: str = "311"
    fuente: str
    url: str
    licencia: str
    fecha_datos: str
    fecha_datos_texto: str
    periodo_inicio: str
    periodo_fin: str
    fecha_proceso: str
    archivos: list[str]
    conjuntos: list[ConjuntoMeta]
    filas_por_periodo: list[PeriodoFilas]
    filas_leidas: int
    filas_validas: int
    filas_descartadas: list[Descarte]
    servicios_sin_categoria: list[str]
    poblacion_disponible: bool
    poblacion_nota: str
    fuentes: list[FuenteMeta]

    @model_validator(mode="after")
    def cuadra(self) -> "Meta":
        if self.filas_validas + sum(d.filas for d in self.filas_descartadas) != self.filas_leidas:
            raise ValueError("Filas válidas + descartadas no suman las filas leídas")
        if sum(p.leidas for p in self.filas_por_periodo) != self.filas_leidas:
            raise ValueError("Las filas por periodo no suman las filas leídas")
        if sum(p.validas for p in self.filas_por_periodo) != self.filas_validas:
            raise ValueError("Las filas válidas por periodo no suman las filas válidas")
        return self
