// Mapa de calles de la página de rutas: Leaflet + protomaps-leaflet con un PMTiles propio (sin WebGL ni claves).
// Solo se carga si hay URL de teselas y el navegador no pide ahorro de datos; si no, queda el SVG del build.
import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import type { ParadasGeo, RutasGeo } from '../lib/rutas';
import cssLeaflet from 'leaflet/dist/leaflet.css?url';

interface Props { pmtiles: string; rutas: RutasGeo; paradas: ParadasGeo; colores: string[]; children?: ComponentChildren }

export default function MapaCalles({ pmtiles, rutas, paradas, colores, children }: Props) {
  const caja = useRef<HTMLDivElement>(null);
  const [activo, setActivo] = useState(false);

  useEffect(() => {
    const con = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    if (con?.saveData || !caja.current) return;
    let mapa: { remove: () => void } | undefined;
    void (async () => {
      const [{ default: L }, { leafletLayer }] = await Promise.all([import('leaflet'), import('protomaps-leaflet')]);
      if (!document.querySelector('link[data-leaflet]')) {
        const l = Object.assign(document.createElement('link'), { rel: 'stylesheet', href: cssLeaflet });
        l.dataset.leaflet = '';
        document.head.append(l);
      }
      const estilo = getComputedStyle(document.documentElement);
      const resolver = (c: string) => (c.startsWith('var(') ? estilo.getPropertyValue(c.slice(4, -1)).trim() : c);
      const m = L.map(caja.current!, { attributionControl: true, zoomControl: true, preferCanvas: true }).setView([9, -79.5], 12);
      m.attributionControl.setPrefix('<a href="https://leafletjs.com">Leaflet</a>');
      mapa = m;
      const oscuro = matchMedia('(prefers-color-scheme: dark)').matches && document.documentElement.dataset.theme !== 'claro'
        || document.documentElement.dataset.theme === 'oscuro';
      leafletLayer({ url: pmtiles, flavor: oscuro ? 'dark' : 'light', lang: 'es',
        attribution: '<a href="https://protomaps.com">Protomaps</a> © <a href="https://www.openstreetmap.org/copyright">colaboradores de OpenStreetMap</a>' }).addTo(m);
      const capa = L.geoJSON(rutas as never, {
        style: (f) => ({ color: resolver(colores[rutas.features.findIndex((x) => x.id === f?.id) % colores.length]), weight: 5 }),
        onEachFeature: (f, l) => l.on('click', () => { location.hash = `ruta-${f.id}`; }),
      }).addTo(m);
      // Número de cada ruta en mitad de su línea, igual que en el mapa sin teselas.
      rutas.features.forEach((f, i) => {
        const [lon, lat] = f.geometry.coordinates[Math.floor(f.geometry.coordinates.length / 2)];
        L.marker([lat, lon], {
          interactive: false, keyboard: false,
          icon: L.divIcon({ className: 'numero-mapa', html: String(i + 1), iconSize: [22, 22] }),
        }).addTo(m);
      });
      L.geoJSON(paradas as never, {
        pointToLayer: (_f, ll) => L.circleMarker(ll, { radius: 4, color: '#2A2623', weight: 1.5, fillColor: '#FBF6EE', fillOpacity: 1 }),
      }).addTo(m);
      setActivo(true);
      // El contenedor estaba oculto: Leaflet mide de nuevo cuando ya se ve.
      requestAnimationFrame(() => { m.invalidateSize(); m.fitBounds(capa.getBounds(), { padding: [16, 16] }); });
    })().catch(() => setActivo(false));
    return () => mapa?.remove();
  }, []);

  return (
    <div class="mapa-calles">
      <div ref={caja} class="mapa-leaflet" hidden={!activo} role="region" aria-label="Mapa de calles con las rutas" />
      <div hidden={activo}>{children}</div>
    </div>
  );
}
