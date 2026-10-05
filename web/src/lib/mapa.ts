// Mapa del 311 en SVG, generado en el build con d3-geo. En el teléfono solo se recolorea.
import { geoMercator, geoPath, geoBounds, geoArea } from 'd3-geo';
import { feature } from 'topojson-client';
import type { Topology, GeometryCollection } from 'topojson-specification';
import type { Feature, FeatureCollection, Geometry } from 'geojson';

export interface Prop { slug: string; nombre: string }
export interface Trazo { slug: string; nombre: string; d: string }
export interface Vista { ancho: number; alto: number; trazos: Trazo[]; recuadro?: { x: number; y: number; w: number; h: number } }

export function rasgos(topo: Topology): FeatureCollection<Geometry, Prop> {
  return feature(topo, topo.objects.corregimientos as GeometryCollection<Prop>) as FeatureCollection<Geometry, Prop>;
}

/** Corregimientos pequeños (zona urbana): los que ocupan menos de cierta fracción del área total. */
export function urbanos(fc: FeatureCollection<Geometry, Prop>, fraccion = 0.006): Feature<Geometry, Prop>[] {
  const total = fc.features.reduce((a, f) => a + geoArea(f), 0);
  return fc.features.filter((f) => geoArea(f) / total < fraccion);
}

function dibujar(fc: FeatureCollection<Geometry, Prop>, foco: FeatureCollection<Geometry, Prop>, ancho: number, alto: number) {
  const proy = geoMercator().fitExtent([[4, 4], [ancho - 4, alto - 4]], foco);
  const camino = geoPath(proy).digits(1);
  return { proy, camino };
}

/** Vista de todo el distrito, con el recuadro de la zona ampliada. */
export function vistaDistrito(fc: FeatureCollection<Geometry, Prop>, ancho = 400, alto = 360): Vista {
  const { proy, camino } = dibujar(fc, fc, ancho, alto);
  const centro: FeatureCollection<Geometry, Prop> = { type: 'FeatureCollection', features: urbanos(fc) };
  const [[x0, y0], [x1, y1]] = geoBounds(centro);
  const a = proy([x0, y1]) ?? [0, 0];
  const b = proy([x1, y0]) ?? [0, 0];
  return {
    ancho, alto,
    trazos: fc.features.map((f) => ({ slug: f.properties.slug, nombre: f.properties.nombre, d: camino(f) ?? '' })),
    recuadro: { x: a[0] - 3, y: a[1] - 3, w: b[0] - a[0] + 6, h: b[1] - a[1] + 6 },
  };
}

/** Vista ampliada del centro de la ciudad: corregimientos urbanos y lo que cae en su recuadro. */
export function vistaCentro(fc: FeatureCollection<Geometry, Prop>, ancho = 400, alto = 300): Vista {
  const centro: FeatureCollection<Geometry, Prop> = { type: 'FeatureCollection', features: urbanos(fc) };
  const { camino } = dibujar(fc, centro, ancho, alto);
  return {
    ancho, alto,
    trazos: centro.features.map((f) => ({ slug: f.properties.slug, nombre: f.properties.nombre, d: camino(f) ?? '' })),
  };
}
