// App de captura de rutas para voluntarios. Sin cuentas ni servidor: todo queda en el teléfono (IndexedDB)
// hasta que se envía por WhatsApp (Web Share API) o se descarga el archivo.
import { useEffect, useRef, useState } from 'preact/hooks';
import {
  archivo, borrar, codigoValido, guardar, guardarAjuste, INTERVALO_MS, isoLocal, leerAjuste, leerTarifa, minutos,
  nombreArchivo, PRECISION_MAX_M, proyectar, punto, todas, type Captura, type Permiso, type Punto, type Sentido,
} from '../lib/captura';

type Paso = 'inicio' | 'nueva' | 'grabando' | 'revisar' | 'enviar';

const esIOS = () =>
  typeof navigator !== 'undefined' && (/iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));

export default function CapturaApp() {
  const [paso, setPaso] = useState<Paso>('inicio');
  const [codigo, setCodigo] = useState('');
  const [pendientes, setPendientes] = useState<Captura[]>([]);
  const [actual, setActual] = useState<Captura | null>(null);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');

  // Al abrir: código guardado y capturas pendientes. Si una quedó grabando, se retoma.
  useEffect(() => {
    void (async () => {
      try {
        setCodigo((await leerAjuste('codigo')) ?? '');
        const lista = await todas();
        setPendientes(lista);
        const abierta = lista.find((c) => c.estado === 'grabando');
        if (abierta) { setActual(abierta); setPaso('grabando'); }
      } catch {
        setError('Este navegador no deja guardar datos. Prueba con Chrome y sin modo incógnito.');
      }
    })();
  }, []);

  const recargar = async () => setPendientes(await todas());
  const ir = (p: Paso) => { setError(''); setAviso(''); setPaso(p); requestAnimationFrame(() => document.getElementById('paso')?.focus()); };

  return (
    <div class="captura">
      {error && <p class="aviso alerta" role="alert">{error}</p>}
      {aviso && <p class="aviso" role="status">{aviso}</p>}
      {paso === 'inicio' && (
        <Inicio codigo={codigo} setCodigo={setCodigo} pendientes={pendientes}
          empezar={async () => {
            if (!codigoValido(codigo)) { setError('Escribe tu código de voluntario, por ejemplo UTP-07.'); return; }
            await guardarAjuste('codigo', codigo.trim().toUpperCase());
            ir('nueva');
          }}
          abrir={(c) => { setActual(c); ir('revisar'); }} />
      )}
      {paso === 'nueva' && (
        <Nueva cancelar={() => ir('inicio')} setError={setError}
          crear={async (datos) => {
            const ahora = isoLocal(new Date());
            const c: Captura = {
              id: `${Date.now()}`, estado: 'grabando', version: 1, voluntario: codigo.trim().toUpperCase(),
              ...datos, inicio: ahora, fin: ahora, puntos: [], paradas: [],
            };
            await guardar(c);
            setActual(c);
            ir('grabando');
          }} />
      )}
      {paso === 'grabando' && actual && (
        <Grabando captura={actual} terminar={async (c) => {
          const fin = { ...c, estado: 'terminada' as const, fin: isoLocal(new Date()) };
          await guardar(fin);
          setActual(fin);
          await recargar();
          ir('revisar');
        }} />
      )}
      {paso === 'revisar' && actual && (
        <Revisar captura={actual} cambiar={async (c) => { await guardar(c); setActual(c); }}
          seguir={() => ir('enviar')} volver={async () => { await recargar(); ir('inicio'); }} />
      )}
      {paso === 'enviar' && actual && (
        <Enviar captura={actual}
          enviada={async () => {
            await borrar(actual.id);
            await recargar();
            setActual(null);
            ir('inicio');
            setAviso('Captura enviada y borrada del teléfono. Gracias.');
          }}
          volver={() => ir('revisar')} />
      )}
    </div>
  );
}

function Inicio(p: {
  codigo: string; setCodigo: (c: string) => void; pendientes: Captura[];
  empezar: () => void; abrir: (c: Captura) => void;
}) {
  const [ios, setIos] = useState(false);
  useEffect(() => setIos(esIOS()), []);
  return (
    <section>
      <h2 id="paso" tabIndex={-1}>Cómo capturar una ruta</h2>
      <ol class="pasos">
        <li>Escribe tu código de voluntario.</li>
        <li>Súbete al busito o la chiva en su primera parada y llena los datos de la ruta.</li>
        <li>Toca «Empezar a grabar» cuando arranque.</li>
        <li>En cada parada donde suba o baje gente, toca «Parada aquí».</li>
        <li>En la última parada toca «Fin de ruta», revisa y envía el archivo por WhatsApp.</li>
      </ol>
      <p class="aviso alerta"><strong>Tu seguridad primero.</strong> Captura en pareja y de día. Guarda el teléfono entre paradas y no lo saques si no te sientes seguro.</p>
      {ios && (
        <p class="aviso">En iPhone, Safari deja de leer el GPS si apagas la pantalla o cambias de app. Deja esta página abierta y la pantalla encendida, o usa un teléfono Android.</p>
      )}
      <label class="campo">
        Código de voluntario
        <input value={p.codigo} onInput={(e) => p.setCodigo((e.target as HTMLInputElement).value)}
          autocomplete="off" autocapitalize="characters" placeholder="UTP-07" maxLength={20} />
      </label>
      <p><button class="boton" type="button" onClick={p.empezar}>Nueva captura</button></p>
      {p.pendientes.length > 0 && (
        <>
          <h2>Capturas sin enviar</h2>
          <ul class="pendientes">
            {p.pendientes.map((c) => (
              <li>
                <button class="boton secundario" type="button" onClick={() => p.abrir(c)}>
                  {c.ruta} ({c.sentido}), {c.inicio.slice(0, 10)}, {c.paradas.length} paradas
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

function Nueva(p: {
  cancelar: () => void; setError: (e: string) => void;
  crear: (d: { ruta: string; operador: string; tarifa_usd: number | null; sentido: Sentido; permiso: Permiso }) => void;
}) {
  const enviar = (e: Event) => {
    e.preventDefault();
    const f = new FormData(e.target as HTMLFormElement);
    const ruta = String(f.get('ruta') ?? '').trim();
    const tarifa = leerTarifa(String(f.get('tarifa') ?? ''));
    const sentido = f.get('sentido') as Sentido | null;
    const permiso = f.get('permiso') as Permiso | null;
    if (!ruta) return p.setError('Escribe el nombre de la ruta.');
    if (tarifa === 'invalida') return p.setError('La tarifa debe ser un número, por ejemplo 0,50.');
    if (!sentido || !permiso) return p.setError('Elige el sentido y si la ruta tiene permiso.');
    p.crear({ ruta, operador: String(f.get('operador') ?? '').trim(), tarifa_usd: tarifa, sentido, permiso });
  };
  return (
    <form onSubmit={enviar}>
      <h2 id="paso" tabIndex={-1}>Nueva captura</h2>
      <label class="campo">Nombre de la ruta, como la llama la gente<input name="ruta" required maxLength={80} /></label>
      <label class="campo">Operador o cooperativa<input name="operador" maxLength={80} /></label>
      <label class="campo">Tarifa en dólares<input name="tarifa" inputMode="decimal" placeholder="0,50" /></label>
      <fieldset class="opciones">
        <legend>Sentido</legend>
        <label><input type="radio" name="sentido" value="ida" required /> Ida</label>
        <label><input type="radio" name="sentido" value="vuelta" /> Vuelta</label>
      </fieldset>
      <fieldset class="opciones">
        <legend>¿Tiene permiso de la ATTT?</legend>
        <label><input type="radio" name="permiso" value="si" required /> Sí</label>
        <label><input type="radio" name="permiso" value="no" /> No</label>
        <label><input type="radio" name="permiso" value="no-se" /> No sé</label>
      </fieldset>
      <p class="acciones">
        <button class="boton" type="submit">Empezar a grabar</button>
        <button class="boton secundario" type="button" onClick={p.cancelar}>Cancelar</button>
      </p>
    </form>
  );
}

function Grabando({ captura, terminar }: { captura: Captura; terminar: (c: Captura) => void }) {
  const [c, setC] = useState(captura);
  const ref = useRef(c);
  ref.current = c;
  const ultima = useRef<GeolocationPosition | null>(null);
  const [precision, setPrecision] = useState<number | null>(null);
  const [sinGps, setSinGps] = useState('');
  const [ahora, setAhora] = useState(Date.now());

  const actualizar = (n: Captura) => { ref.current = n; setC(n); void guardar(n); };

  useEffect(() => {
    if (!('geolocation' in navigator)) { setSinGps('Este teléfono no tiene GPS disponible en el navegador.'); return; }
    const id = navigator.geolocation.watchPosition(
      (pos) => { ultima.current = pos; setPrecision(pos.coords.accuracy); setSinGps(''); },
      (err) => setSinGps(err.code === err.PERMISSION_DENIED
        ? 'Da permiso de ubicación a esta página para grabar la ruta.'
        : 'Buscando señal de GPS…'),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 },
    );
    // Cada 5 segundos se guarda la última lectura del GPS, si llegó una nueva desde el punto anterior.
    // La hora del punto es la del muestreo: así dos puntos nunca comparten hora.
    let usada: GeolocationPosition | null = null;
    const reloj = setInterval(() => {
      setAhora(Date.now());
      const pos = ultima.current;
      if (!pos || pos === usada) return;
      usada = pos;
      const ahoraIso = isoLocal(new Date());
      const pt = { ...punto(pos), t: ahoraIso };
      actualizar({ ...ref.current, puntos: [...ref.current.puntos, pt], fin: ahoraIso });
    }, INTERVALO_MS);
    // Pantalla encendida mientras se graba.
    let bloqueo: WakeLockSentinel | null = null;
    const pedir = async () => { try { bloqueo = await navigator.wakeLock?.request('screen'); } catch { /* sin permiso */ } };
    const visible = () => { if (document.visibilityState === 'visible') void pedir(); };
    void pedir();
    document.addEventListener('visibilitychange', visible);
    return () => {
      navigator.geolocation.clearWatch(id);
      clearInterval(reloj);
      document.removeEventListener('visibilitychange', visible);
      void bloqueo?.release();
    };
  }, []);

  const parada = () => {
    const pos = ultima.current;
    if (!pos) { setSinGps('Todavía no hay señal de GPS. Espera unos segundos y vuelve a tocar.'); return; }
    const pt: Punto = punto(pos);
    actualizar({ ...ref.current, paradas: [...ref.current.paradas, { t: isoLocal(new Date()), lat: pt.lat, lon: pt.lon, nombre: '' }] });
  };

  const mala = precision !== null && precision > PRECISION_MAX_M;
  return (
    <section>
      <h2 id="paso" tabIndex={-1}>Grabando: {c.ruta}</h2>
      <p class="contadores" aria-live="polite">
        <span><strong class="num">{c.paradas.length}</strong> paradas</span>
        <span><strong class="num">{minutos(c.inicio, isoLocal(new Date(ahora)))}</strong> minutos</span>
        <span><strong class="num">{c.puntos.length}</strong> puntos</span>
      </p>
      {sinGps && <p class="aviso alerta" role="alert">{sinGps}</p>}
      {mala && <p class="aviso alerta" role="alert">La precisión del GPS es de {Math.round(precision)} m. Acércate a una ventana o espera a salir de zonas techadas.</p>}
      <button class="boton boton-parada" type="button" onClick={parada}>Parada aquí</button>
      <p><button class="boton secundario" type="button" onClick={() => terminar(ref.current)}>Fin de ruta</button></p>
      <p class="nota">Deja esta página abierta. La pantalla se queda encendida mientras grabas.</p>
    </section>
  );
}

function Revisar({ captura: c, cambiar, seguir, volver }: {
  captura: Captura; cambiar: (c: Captura) => void; seguir: () => void; volver: () => void;
}) {
  const W = 320, H = 240;
  const pr = proyectar([...c.puntos, ...c.paradas], W, H);
  const linea = c.puntos.map((p) => pr.a(p).join(',')).join(' ');
  return (
    <section>
      <h2 id="paso" tabIndex={-1}>Revisa la captura</h2>
      <p>{c.ruta}, {c.sentido}. {minutos(c.inicio, c.fin)} minutos, {c.puntos.length} puntos y {c.paradas.length} paradas.</p>
      <svg class="traza" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Traza de la ruta con ${c.paradas.length} paradas numeradas`}>
        {c.puntos.length > 1 && <polyline points={linea} fill="none" stroke="var(--terracota)" stroke-width="3" stroke-linejoin="round" />}
        {c.paradas.map((p, i) => {
          const [x, y] = pr.a(p);
          return (
            <g>
              <circle cx={x} cy={y} r="8" fill="var(--superficie)" stroke="var(--hierro)" stroke-width="2" />
              <text x={x} y={y + 4} text-anchor="middle" font-size="10" fill="var(--hierro)">{i + 1}</text>
            </g>
          );
        })}
      </svg>
      {c.paradas.length === 0 ? <p>No marcaste paradas.</p> : (
        <ol class="lista-paradas">
          {c.paradas.map((p, i) => (
            <li>
              <label class="campo">Nombre de la parada {i + 1}
                <input value={p.nombre} placeholder="Por ejemplo: frente al súper" maxLength={60}
                  onChange={(e) => cambiar({ ...c, paradas: c.paradas.map((x, j) => (j === i ? { ...x, nombre: (e.target as HTMLInputElement).value } : x)) })} />
              </label>
              <button class="boton secundario" type="button" aria-label={`Borrar la parada ${i + 1}`}
                onClick={() => cambiar({ ...c, paradas: c.paradas.filter((_, j) => j !== i) })}>Borrar</button>
            </li>
          ))}
        </ol>
      )}
      <p class="acciones">
        <button class="boton" type="button" onClick={seguir}>Listo, enviar</button>
        <button class="boton secundario" type="button" onClick={volver}>Volver al inicio</button>
      </p>
    </section>
  );
}

function Enviar({ captura: c, enviada, volver }: { captura: Captura; enviada: () => void; volver: () => void }) {
  const [descargada, setDescargada] = useState(false);
  const [msg, setMsg] = useState('');
  const json = JSON.stringify(archivo(c), null, 1);
  const nombre = nombreArchivo(c);
  const archivoFile = () => new File([json], nombre, { type: 'application/json' });
  const puedeCompartir = typeof navigator.canShare === 'function' && navigator.canShare({ files: [archivoFile()] });

  const compartir = async () => {
    try {
      await navigator.share({ files: [archivoFile()], title: `Ruta ${c.ruta}`, text: `Captura de la ruta ${c.ruta} (${c.sentido}) para Palante.` });
      enviada();
    } catch (e) {
      if ((e as DOMException).name !== 'AbortError') setMsg('No se pudo compartir. Descarga el archivo y envíalo por WhatsApp.');
    }
  };
  const descargar = () => {
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url; a.download = nombre; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    setDescargada(true);
  };
  return (
    <section>
      <h2 id="paso" tabIndex={-1}>Enviar la captura</h2>
      <p>El archivo {nombre} queda guardado en tu teléfono hasta que lo envíes.</p>
      {msg && <p class="aviso alerta" role="alert">{msg}</p>}
      <p class="acciones">
        {puedeCompartir && <button class="boton" type="button" onClick={compartir}>Enviar por WhatsApp</button>}
        <button class={puedeCompartir ? 'boton secundario' : 'boton'} type="button" onClick={descargar}>Descargar el archivo</button>
      </p>
      {descargada && (
        <p>Envía el archivo descargado por WhatsApp al coordinador. Cuando lo hayas enviado, bórralo de aquí.{' '}
          <button class="boton secundario" type="button" onClick={enviada}>Ya lo envié, borrar del teléfono</button></p>
      )}
      <p><button class="boton secundario" type="button" onClick={volver}>Volver a revisar</button></p>
    </section>
  );
}
