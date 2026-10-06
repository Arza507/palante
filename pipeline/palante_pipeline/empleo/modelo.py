"""Esquemas del módulo de empleo: filas del CSV, extracción de cada oferta y salidas publicables."""

from datetime import date
from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator

# Ninguna celda con menos ofertas que esto llega a public/ (SPEC.md, sección 7, paso 8).
MINIMO_OFERTAS = 10
TOP_HABILIDADES = 15


class Oferta(BaseModel):
    """Una fila de pipeline/data/raw/empleo/ofertas.csv."""

    id: str = Field(min_length=1)
    fecha_publicacion: date
    fuente: str = Field(min_length=1)
    url: str | None = None
    titulo: str = Field(min_length=1)
    empresa: str | None = None
    provincia: str = Field(min_length=1)
    sector: str = Field(min_length=1)
    salario_min: float | None = Field(default=None, gt=0)
    salario_max: float | None = Field(default=None, gt=0)
    texto: str = Field(min_length=20)
    fecha_recoleccion: date

    @field_validator("url", "empresa", "salario_min", "salario_max", mode="before")
    @classmethod
    def vacio_es_nulo(cls, v):
        if v is None or (isinstance(v, float) and v != v) or (isinstance(v, str) and not v.strip()):
            return None
        return v

    @model_validator(mode="after")
    def salario_ordenado(self) -> "Oferta":
        if self.salario_min and self.salario_max and self.salario_min > self.salario_max:
            raise ValueError("salario_min es mayor que salario_max")
        return self


class Idioma(BaseModel):
    idioma: str
    nivel: Literal["basico", "intermedio", "avanzado", "nativo", "no indicado"]


class Salario(BaseModel):
    minimo: float | None = Field(default=None, ge=0)
    maximo: float | None = Field(default=None, ge=0)
    periodo: Literal["mes", "hora", "año", "no indicado"] = "no indicado"


class Extraccion(BaseModel):
    """Lo que el modelo extrae de una oferta. Solo lo que dice el texto; nada inferido."""

    habilidades: list[str] = Field(description="Habilidades y competencias que pide la oferta")
    herramientas: list[str] = Field(description="Programas, equipos y tecnologías concretas")
    idiomas: list[Idioma] = Field(description="Idiomas que pide, con su nivel")
    anios_experiencia: float | None = Field(description="Años mínimos de experiencia; null si no lo dice")
    nivel_educativo: Literal[
        "ninguno", "primaria", "secundaria", "tecnico", "universitario", "posgrado", "no indicado"
    ]
    modalidad: Literal["presencial", "hibrido", "remoto", "no indicado"]
    salario: Salario | None = Field(description="Salario en dólares si aparece en el texto; null si no")


# ---- Salidas publicables ----


class Conteo(BaseModel):
    nombre: str
    n: int = Field(ge=1)
    esco: str | None = None


class Celda(BaseModel):
    """Estadísticas de un grupo de ofertas. Con menos de MINIMO_OFERTAS no lleva ningún número."""

    insuficiente: bool
    ofertas: int | None = None
    habilidades: list[Conteo] = []
    herramientas: list[Conteo] = []
    pide_ingles: int | None = None
    ofertas_con_salario: int | None = None
    salario_mediano: float | None = None
    modalidad: dict[str, int] = {}

    @model_validator(mode="after")
    def sin_numeros_si_insuficiente(self) -> "Celda":
        if self.insuficiente:
            if (
                self.ofertas is not None
                or self.habilidades
                or self.herramientas
                or self.pide_ingles is not None
                or self.salario_mediano is not None
                or self.modalidad
            ):
                raise ValueError("Una celda con muestra insuficiente no puede llevar números")
        elif self.ofertas is None or self.ofertas < MINIMO_OFERTAS:
            raise ValueError(f"Una celda publicada necesita al menos {MINIMO_OFERTAS} ofertas")
        return self


class Grupo(BaseModel):
    id: str
    nombre: str
    celda: Celda


class SectorResumen(BaseModel):
    id: str
    nombre: str
    celda: Celda


class Resumen(BaseModel):
    version: int = 1
    marca: str | None = None
    minimo_ofertas: int = MINIMO_OFERTAS
    total: Celda
    sectores: list[SectorResumen]
    provincias: list[Grupo]
    meses: list[Grupo]


class Sector(BaseModel):
    version: int = 1
    marca: str | None = None
    id: str
    nombre: str
    minimo_ofertas: int = MINIMO_OFERTAS
    celda: Celda
    provincias: list[Grupo]
    meses: list[Grupo]


class Descarte(BaseModel):
    motivo: str
    filas: int = Field(gt=0)


class FuenteMeta(BaseModel):
    id: str
    nombre: str
    url: str
    licencia: str
    fecha_texto: str


class Informalidad(BaseModel):
    """Dato de contexto del INEC, solo si existe raw/empleo/inec/informalidad.csv."""

    porcentaje: float = Field(gt=0, lt=100)
    periodo: str
    fuente: str
    url: str


class Meta(BaseModel):
    modulo: str = "empleo"
    origen: str
    marca: str | None = None
    fecha_proceso: str
    fecha_inicio: str | None
    fecha_fin: str | None
    filas_leidas: int = Field(ge=0)
    ofertas_validas: int = Field(ge=0)
    ofertas_con_extraccion: int = Field(ge=0)
    ofertas_sin_extraccion: int = Field(ge=0)
    filas_descartadas: list[Descarte]
    fuentes_ofertas: list[str]
    modelo_extraccion: str
    esco_disponible: bool
    informalidad: Informalidad | None = None
    fuentes: list[FuenteMeta]

    @model_validator(mode="after")
    def cuadra(self) -> "Meta":
        if self.ofertas_validas + sum(d.filas for d in self.filas_descartadas) != self.filas_leidas:
            raise ValueError("Ofertas válidas + descartadas no suman las filas leídas")
        if self.ofertas_con_extraccion + self.ofertas_sin_extraccion != self.ofertas_validas:
            raise ValueError("Ofertas con y sin extracción no suman las válidas")
        return self
