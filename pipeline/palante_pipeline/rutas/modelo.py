"""Esquema del archivo de captura (SPEC.md, sección 8) y de la configuración de rutas."""

from typing import Literal

from pydantic import AwareDatetime, BaseModel, Field, model_validator

# Caja de Panamá con margen: descarta puntos con coordenadas imposibles.
LAT = (7.0, 9.8)
LON = (-83.1, -77.1)


class Punto(BaseModel):
    t: AwareDatetime
    lat: float = Field(ge=LAT[0], le=LAT[1])
    lon: float = Field(ge=LON[0], le=LON[1])
    precision_m: float = Field(ge=0)


class Parada(BaseModel):
    t: AwareDatetime
    lat: float = Field(ge=LAT[0], le=LAT[1])
    lon: float = Field(ge=LON[0], le=LON[1])
    nombre: str = ""


class Captura(BaseModel):
    version: Literal[1]
    voluntario: str = Field(min_length=1, max_length=20)
    ruta: str = Field(min_length=1, max_length=80)
    operador: str = Field(default="", max_length=80)
    tarifa_usd: float | None = Field(default=None, ge=0, le=20)
    sentido: Literal["ida", "vuelta"]
    permiso: Literal["si", "no", "no-se"]
    inicio: AwareDatetime
    fin: AwareDatetime
    puntos: list[Punto] = Field(min_length=2)
    paradas: list[Parada] = []

    @model_validator(mode="after")
    def orden(self) -> "Captura":
        if self.fin < self.inicio:
            raise ValueError("fin es anterior a inicio")
        return self


class HorarioRuta(BaseModel):
    """Una fila de config/rutas.csv: datos que la captura no trae y que confirma Iker."""

    ruta: str
    sentido: Literal["ida", "vuelta"]
    sector: str = "Sin sector"
    dias: str = Field(pattern=r"^[01]{7}$", description="Lunes a domingo, 1 si hay servicio")
    inicio: str = Field(pattern=r"^\d{2}:\d{2}$")
    fin: str = Field(pattern=r"^\d{2}:\d{2}$")
    frecuencia_min: int = Field(gt=0, le=240)


class Descarte(BaseModel):
    motivo: str
    n: int = Field(gt=0)
    detalle: list[str] = []


class RutaMeta(BaseModel):
    id: str
    ruta: str
    sentido: str
    operador: str
    tarifa_usd: float | None
    sector: str
    paradas: int
    capturas: int
    ultima_captura: str
    en_gtfs: bool


class Meta(BaseModel):
    modulo: str = "rutas"
    marca: str | None = None
    licencia: str = "CC BY 4.0"
    fecha_proceso: str
    archivos_leidos: int
    capturas_validas: int
    rutas: list[RutaMeta]
    descartes: list[Descarte]
    puntos_leidos: int
    puntos_descartados_precision: int
    puntos_descartados_salto: int
    validacion_gtfs: list[str]
