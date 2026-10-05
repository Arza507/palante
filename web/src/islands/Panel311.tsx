// Isla del mapa del 311: filtros en la URL, recoloreo del mapa SVG, leyenda, lista ordenable y hoja inferior.
import type { ComponentChildren } from 'preact';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import {
  agregar, clase, COLOR_CLASE, cortes, detalle, escribirFiltros, leerFiltros, leyenda,
  SIN_FILTRO, totalDistrito, usaTasa, type Filtros, type Resumen311,
} from '../lib/m311';
import { numero, porcentaje } from '../lib/formato';

interface Props {
  resumen: Resumen311;
  periodo: string;
  /** Mapa SVG estático generado en el build. */
  children?: ComponentChildren;
}

type Orden = { columna: 'nombre' | 'valor' | 'resuelto'; asc: boolean };

export default function Panel311({ resumen, periodo, children }: Props) {
  const [listo, setListo] = useState(false);
  const [filtros, setFiltros] = useState<Filtros>(SIN_FILTRO);
  const [orden, setOrden] = useState<Orden>({ columna: 'valor', asc: false });
  const [abierto, setAbierto] = useState<string | null>(null);
  const [soloLista, setSoloLista] = useState(false);
  const cerrar = useRef<HTMLButtonElement>(null);

  const tasa = usaTasa(resumen);
  const decimales = tasa ? 1 : 0;
  const filas = useMemo(() => agregar(resumen, filtros), [resumen, filtros]);
  const c = useMemo(() => cortes(filas.map((f) => f.valor), decimales), [filas, decimales]);
  const distrito = useMemo(() => totalDistrito(filas), [filas]);
  const unidad = tasa ? 'reportes por cada 10.000 habitantes' : 'reportes';

  // Al hidratar: filtros desde la URL y vista de lista si el navegador pide ahorro de datos.
  useEffect(() => {
    setFiltros(leerFiltros(location.search, resumen));
    const con = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    if (con?.saveData) setSoloLista(true);
    setListo(true);
  }, [resumen]);

  // Filtros en la URL para compartir una vista exacta.
  useEffect(() => {
    if (!listo) return;
    history.replaceState(null, '', location.pathname + escribirFiltros(filtros));
  }, [filtros, listo]);

  // Recolorea los trazos del mapa estático y actualiza sus títulos.
  useEffect(() => {
    const porSlug = new Map(filas.map((f) => [f.slug, f]));
    for (const p of document.querySelectorAll<SVGPathElement>('.mapa311 [data-slug]')) {
      const f = porSlug.get(p.dataset.slug ?? '');
      if (!f) continue;
      p.style.fill = COLOR_CLASE[clase(f.valor, c)];
      const t = p.querySelector('title');
      if (t) t.textContent = `${f.nombre}: ${numero(f.valor, decimales)} ${unidad}`;
    }
  }, [filas, c, decimales, unidad]);

  // Tocar un corregimiento abre la hoja inferior.
  useEffect(() => {
    const alTocar = (e: Event) => {
      const p = (e.target as Element).closest<SVGPathElement>('[data-slug]');
      if (p?.dataset.slug) setAbierto(p.dataset.slug);
    };
    const mapas = document.querySelectorAll('.mapa311');
    mapas.forEach((m) => m.addEventListener('click', alTocar));
    return () => mapas.forEach((m) => m.removeEventListener('click', alTocar));
  }, []);

  useEffect(() => {
    const m = document.getElementById('mapa-311');
    if (m) m.hidden = soloLista;
  }, [soloLista]);

  useEffect(() => {
    if (!abierto) return;
    cerrar.current?.focus();
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setAbierto(null);
    addEventListener('keydown', esc);
    return () => removeEventListener('keydown', esc);
  }, [abierto]);

  const ordenadas = useMemo(() => {
    const pr = (f: (typeof filas)[number]) => (f.total ? f.resueltos / f.total : -1);
    const v = [...filas].sort((a, b) => {
      const d = orden.columna === 'nombre' ? a.nombre.localeCompare(b.nombre, 'es')
        : orden.columna === 'valor' ? a.valor - b.valor : pr(a) - pr(b);
      return (orden.asc ? d : -d) || a.nombre.localeCompare(b.nombre, 'es');
    });
    return v;
  }, [filas, orden]);

  const cambiar = (k: keyof Filtros) => (e: Event) => setFiltros({ ...filtros, [k]: (e.target as HTMLSelectElement).value });
  const ordenar = (columna: Orden['columna']) =>
    setOrden((o) => ({ columna, asc: o.columna === columna ? !o.asc : columna === 'nombre' }));
  const ariaSort = (col: Orden['columna']) => (orden.columna === col ? (orden.asc ? 'ascending' : 'descending') : 'none');

  const filaAbierta = abierto ? filas.find((f) => f.slug === abierto) : undefined;
  const det = filaAbierta ? detalle(resumen, filaAbierta) : null;
  const hayFiltros = filtros.categoria || filtros.estado || filtros.trimestre;
  const nombreCat = resumen.categorias.find((x) => x.id === filtros.categoria)?.nombre;

  return (
    <div class="panel311">
      <form class="filtros solo-js" style={listo ? undefined : { visibility: 'hidden' }} onSubmit={(e) => e.preventDefault()} aria-label="Filtros del mapa">
        <label>
          Categoría
          <select value={filtros.categoria} onChange={cambiar('categoria')}>
            <option value="">Todas</option>
            {resumen.categorias.map((x) => <option value={x.id}>{x.nombre}</option>)}
          </select>
        </label>
        <label>
          Estado
          <select value={filtros.estado} onChange={cambiar('estado')}>
            <option value="">Todos</option>
            {resumen.estados.map((x) => <option value={x.id}>{x.nombre}</option>)}
          </select>
        </label>
        <label>
          Trimestre
          <select value={filtros.trimestre} onChange={cambiar('trimestre')}>
            <option value="">Todos</option>
            {resumen.trimestres.map((x) => <option value={x.id}>{x.nombre}</option>)}
          </select>
        </label>
        <div class="acciones-filtro">
          {hayFiltros && <button type="button" class="boton secundario" onClick={() => setFiltros(SIN_FILTRO)}>Quitar filtros</button>}
          <button type="button" class="boton secundario" aria-pressed={soloLista} onClick={() => setSoloLista(!soloLista)}>
            {soloLista ? 'Mostrar el mapa' : 'Ocultar el mapa'}
          </button>
        </div>
      </form>

      <p class="estado-filtro" role="status">
        {numero(distrito.total)} {distrito.total === 1 ? 'reporte' : 'reportes'}
        {nombreCat ? ` de ${nombreCat.toLowerCase()}` : ''} en el distrito, {periodo}.
      </p>

      {children}

      <div class="leyenda" aria-label={`Leyenda: ${unidad}`} role="group">
        <p class="leyenda-titulo">{tasa ? 'Reportes por cada 10.000 habitantes' : 'Número de reportes'}</p>
        <ul>
          {leyenda(c, decimales).map((p) => (
            <li><span class="muestra" style={{ background: COLOR_CLASE[p.clase] }} aria-hidden="true"></span>{p.texto}</li>
          ))}
        </ul>
      </div>

      <h2 id="lista-311">Lista de corregimientos</h2>
      <div class="tabla-scroll">
        <table aria-labelledby="lista-311">
          <thead>
            <tr>
              <th scope="col" aria-sort={ariaSort('nombre')}>
                <button type="button" class="ordenar" onClick={() => ordenar('nombre')}>Corregimiento</button>
              </th>
              <th scope="col" class="num" aria-sort={ariaSort('valor')}>
                <button type="button" class="ordenar" onClick={() => ordenar('valor')}>{tasa ? 'Por 10.000 hab.' : 'Reportes'}</button>
              </th>
              <th scope="col" class="num" aria-sort={ariaSort('resuelto')}>
                <button type="button" class="ordenar" onClick={() => ordenar('resuelto')}>Resueltos</button>
              </th>
            </tr>
          </thead>
          <tbody>
            {ordenadas.map((f) => (
              <tr>
                <th scope="row">
                  <span class="muestra" style={{ background: COLOR_CLASE[clase(f.valor, c)] }} aria-hidden="true"></span>
                  <a href={`/311/${f.slug}`}>{f.nombre}</a>
                </th>
                <td class="num">{numero(f.valor, decimales)}</td>
                <td class="num">{f.total ? porcentaje(f.resueltos / f.total) : '–'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filaAbierta && det && (
        <div class="hoja" role="dialog" aria-modal="false" aria-labelledby="hoja-titulo">
          <div class="hoja-cabecera">
            <h2 id="hoja-titulo">{filaAbierta.nombre}</h2>
            <button ref={cerrar} type="button" class="boton-cerrar" onClick={() => setAbierto(null)} aria-label="Cerrar resumen">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" /></svg>
            </button>
          </div>
          <p class="hoja-dato">
            <strong class="num">{numero(det.total)}</strong> {det.total === 1 ? 'reporte' : 'reportes'}
            {tasa && filaAbierta.poblacion ? ` (${numero(filaAbierta.valor, 1)} por cada 10.000 habitantes)` : ''}
          </p>
          {det.principales.length > 0 && (
            <>
              <p>Problemas principales:</p>
              <ol>{det.principales.map((p) => <li>{p.nombre}: {numero(p.n)}</li>)}</ol>
            </>
          )}
          {det.porcentajeResuelto !== null && <p>Resueltos: {porcentaje(det.porcentajeResuelto)}.</p>}
          <a class="boton" href={`/311/${filaAbierta.slug}`}>Ver la ficha de {filaAbierta.nombre}</a>
        </div>
      )}
    </div>
  );
}
