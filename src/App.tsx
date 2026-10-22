import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, Layers, Locate, LocateFixed, LocateOff, Moon, Settings, Sun, WifiOff } from 'lucide-react';
import Mapa, { type Capa, type Seguimiento } from './components/Mapa';
import Explorar from './components/Explorar';
import Ficha from './components/Ficha';
import PanelRuta from './components/PanelRuta';
import Navegacion from './components/Navegacion';
import Admin from './components/Admin';
import Placas from './components/Placas';
import { cargarCatalogo } from './lib/api';
import { calcularRuta, corregirRodeo, MODOS, type Modo, type Ruta } from './lib/rutas';
import { perfilAltitud, tiempoTobler, type Perfil } from './lib/elevacion';
import { coordenadas, distancia } from './lib/geo';
import { ir, useRutaHash } from './hooks/useRutaHash';
import { useUbicacion } from './hooks/useUbicacion';
import { useTema } from './hooks/useTema';
import type { Catalogo, Categoria, LngLat } from './tipos';

const PARQUE: LngLat = [-72.664824, 7.138207];
const esModo = (m: string | null): m is Modo => !!m && m in MODOS;
const useEsAncho = () => {
    const [ancho, setAncho] = useState(() => matchMedia('(min-width: 900px)').matches);
    useEffect(() => {
        const mq = matchMedia('(min-width: 900px)');
        const f = () => setAncho(mq.matches);
        mq.addEventListener('change', f);
        return () => mq.removeEventListener('change', f);
    }, []);
    return ancho;
};

export default function App() {
    const vista = useRutaHash();
    const { tema, alternar } = useTema();
    const ubicacion = useUbicacion();
    const { pos } = ubicacion;
    const ancho = useEsAncho();

    const [catalogo, setCatalogo] = useState<Catalogo | null>(null);
    const [sinConexion, setSinConexion] = useState(false);
    const [errorCarga, setErrorCarga] = useState<string | null>(null);
    const [capa, setCapa] = useState<Capa>('mapa');
    const [seguimiento, setSeguimiento] = useState<Seguimiento>('libre');
    const [hojaAbierta, setHojaAbierta] = useState(true);

    const recargar = useCallback(() => {
        cargarCatalogo()
            .then(({ catalogo, sinConexion }) => { setCatalogo(catalogo); setSinConexion(sinConexion); setErrorCarga(null); })
            .catch((e) => setErrorCarga((e as Error).message));
    }, []);
    useEffect(recargar, [recargar]);

    const lugares = catalogo?.lugares ?? [];
    const idLugar = 'id' in vista ? vista.id : null;
    const lugar = useMemo(() => (idLugar ? lugares.find((l) => l.id === idLugar) ?? null : null), [lugares, idLugar]);
    const destino = lugar ? coordenadas(lugar) : null;
    const enRuta = vista.nombre === 'ruta' || vista.nombre === 'navegar';
    const modo: Modo = enRuta && esModo(vista.modo) ? vista.modo : 'pie';

    // --- Origen de la ruta: tu posición si hay GPS, si no el Parque Principal ---
    const [origen, setOrigen] = useState<{ punto: LngLat; esUsuario: boolean }>({ punto: PARQUE, esUsuario: false });
    const fijarOrigenDesdeGps = useCallback(() => {
        if (pos) setOrigen({ punto: [pos.lon, pos.lat], esUsuario: true });
    }, [pos]);
    // La primera vez que llega el GPS (o si te moviste >100 m fuera de la navegación) se actualiza el origen
    useEffect(() => {
        if (!pos || vista.nombre === 'navegar') return;
        if (!origen.esUsuario || distancia(origen.punto, [pos.lon, pos.lat]) > 100) fijarOrigenDesdeGps();
    }, [pos, vista.nombre, origen, fijarOrigenDesdeGps]);

    // --- Rutas por modo ------------------------------------------------------------
    const [rutas, setRutas] = useState<Partial<Record<Modo, Ruta | Error | 'cargando'>>>({});
    const claveRutas = enRuta && destino ? `${lugar!.id}|${origen.punto.join(',')}` : null;
    const claveActual = useRef<string | null>(null);

    useEffect(() => {
        claveActual.current = claveRutas;
        setRutas({});
        if (!claveRutas || !destino) return;
        const ctrl = new AbortController();
        // Primero el modo elegido, luego los demás para mostrar sus tiempos
        const orden: Modo[] = [modo, ...(Object.keys(MODOS) as Modo[]).filter((m) => m !== modo)];
        for (const m of orden) {
            setRutas((r) => ({ ...r, [m]: 'cargando' }));
            calcularRuta(m, origen.punto, destino, ctrl.signal)
                .then((ruta) => { if (claveActual.current === claveRutas) setRutas((r) => ({ ...r, [m]: ruta })); })
                .catch((e) => { if (!ctrl.signal.aborted) setRutas((r) => ({ ...r, [m]: e as Error })); });
        }
        return () => ctrl.abort();
    }, [claveRutas]);

    // Altitud de cada ruta: sirve para el perfil y para el tiempo a pie con pendiente.
    // Se guarda por geometría para no repetir la petición cuando llega otra ruta.
    const cachePerfiles = useRef(new Map<string, Perfil>());
    const [versionPerfiles, setVersionPerfiles] = useState(0);
    const firma = (r: Ruta) => `${r.linea.length}:${r.linea[0].join(',')}:${r.distancia.toFixed(0)}`;
    const carro = rutas.carro && rutas.carro !== 'cargando' && !(rutas.carro instanceof Error) ? rutas.carro : null;

    // Rutas finales: se corrigen los rodeos y el tiempo a pie usa la pendiente
    const rutasFinales = useMemo(() => {
        const r: typeof rutas = {};
        for (const m of Object.keys(MODOS) as Modo[]) {
            const x = rutas[m];
            if (!x || x === 'cargando' || x instanceof Error) { r[m] = x; continue; }
            // Mientras llega la ruta en carro no se puede saber si la otra es un rodeo
            if (m !== 'carro' && rutas.carro === 'cargando') { r[m] = 'cargando'; continue; }
            let final = corregirRodeo(x, carro);
            const p = cachePerfiles.current.get(firma(final));
            if (m === 'pie' && p) final = { ...final, duracion: tiempoTobler(p), conPendiente: true };
            r[m] = final;
        }
        return r;
    }, [rutas, carro, versionPerfiles]);

    const rutaActual = rutasFinales[modo];
    const ruta = rutaActual && rutaActual !== 'cargando' && !(rutaActual instanceof Error) ? rutaActual : null;
    const perfil = ruta ? cachePerfiles.current.get(firma(ruta)) ?? null : null;

    // Pide la altitud de las geometrías que aún no la tienen (sin cancelar las que van en curso)
    const enCurso = useRef(new Set<string>());
    const abortoPerfiles = useRef(new AbortController());
    useEffect(() => () => abortoPerfiles.current.abort(), []);
    useEffect(() => {
        for (const x of Object.values(rutasFinales)) {
            if (!x || x === 'cargando' || x instanceof Error) continue;
            const k = firma(x);
            if (cachePerfiles.current.has(k) || enCurso.current.has(k)) continue;
            enCurso.current.add(k);
            perfilAltitud(x.linea, x.acumulado, abortoPerfiles.current.signal)
                .then((p) => { cachePerfiles.current.set(k, p); setVersionPerfiles((v) => v + 1); })
                .catch(() => {})
                .finally(() => enCurso.current.delete(k));
        }
    }, [rutasFinales]);

    // --- Navegación ---------------------------------------------------------------
    useEffect(() => {
        if (vista.nombre === 'navegar') {
            ubicacion.iniciar();
            setSeguimiento('navegar');
        } else if (seguimiento === 'navegar') {
            setSeguimiento('libre');
        }
    }, [vista.nombre]);

    const recalcular = useCallback(() => {
        if (pos) setOrigen({ punto: [pos.lon, pos.lat], esUsuario: true });
    }, [pos]);

    // --- Botón "Mi ubicación" (tres estados, como en Google Maps) ---------------------
    const alPulsarUbicacion = () => {
        if (ubicacion.estado !== 'activo' && ubicacion.estado !== 'buscando') ubicacion.iniciar();
        setSeguimiento((s) => (s === 'centrar' ? 'libre' : 'centrar'));
    };
    const IconoUbicacion = ubicacion.estado === 'denegado' || ubicacion.estado === 'no-disponible'
        ? LocateOff : seguimiento === 'centrar' ? LocateFixed : Locate;

    const margen = ancho ? { left: 420, bottom: 0 } : { left: 0, bottom: hojaAbierta ? Math.round(innerHeight * 0.5) : 120 };
    const referencia = pos ? { punto: [pos.lon, pos.lat] as LngLat, esUsuario: true } : { punto: PARQUE, esUsuario: false };

    // --- Vistas de página completa ---------------------------------------------------
    if (vista.nombre === 'admin') {
        return <Admin lugares={lugares} idEditando={vista.id} pos={pos} onIniciarGps={ubicacion.iniciar} onCambio={recargar} />;
    }
    if (vista.nombre === 'placas') return <Placas lugares={lugares} />;

    const navegando = vista.nombre === 'navegar' && lugar && ruta;

    return (
        <div className={`app ${navegando ? 'app--navegando' : ''}`}>
            <Mapa
                lugares={lugares}
                seleccionado={lugar}
                ruta={enRuta ? ruta : null}
                pos={pos}
                capa={capa}
                seguimiento={navegando ? 'navegar' : seguimiento === 'navegar' ? 'libre' : seguimiento}
                margen={margen}
                onSeleccionar={(id) => ir(`#/lugar/${encodeURIComponent(id)}`)}
                onMoverManual={() => { if (!navegando) setSeguimiento('libre'); }}
            />

            {sinConexion && <p className="banda-offline"><WifiOff size={16} /> Sin conexión: mostrando la última copia guardada</p>}

            <div className="controles">
                <button className="control" onClick={() => setCapa((c) => (c === 'mapa' ? 'satelite' : 'mapa'))} aria-label={capa === 'mapa' ? 'Ver satélite' : 'Ver mapa'} title="Capas">
                    <Layers size={20} /><span>{capa === 'mapa' ? 'Satélite' : 'Mapa'}</span>
                </button>
                <button
                    className={`control control--ubicacion ${seguimiento === 'centrar' ? 'activo' : ''}`}
                    onClick={alPulsarUbicacion}
                    aria-label="Mostrar tu ubicación"
                    title={ubicacion.mensaje ?? 'Mostrar tu ubicación'}
                    aria-pressed={seguimiento === 'centrar'}
                >
                    <IconoUbicacion size={22} className={ubicacion.estado === 'buscando' ? 'girando' : ''} />
                </button>
            </div>
            {ubicacion.mensaje && ubicacion.estado !== 'activo' && <p className="toast toast--flotante" role="status">{ubicacion.mensaje}</p>}

            {navegando ? (
                <Navegacion lugar={lugar} ruta={ruta} pos={pos} onRecalcular={recalcular} onSalir={() => ir(`#/ruta/${encodeURIComponent(lugar.id)}?modo=${modo}`)} />
            ) : (
                <aside className={`panel ${hojaAbierta ? '' : 'panel--plegado'}`} aria-label="Panel de lugares">
                    <button className="panel_asa" onClick={() => setHojaAbierta((a) => !a)} aria-label={hojaAbierta ? 'Plegar panel' : 'Desplegar panel'}>
                        {hojaAbierta ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
                    </button>
                    <header className="panel_cabecera">
                        <a href="#/" className="marca">
                            <img src="/icono.svg" alt="" width={30} height={30} />
                            <span><strong>Chitagá</strong><em>Guía turística</em></span>
                        </a>
                        <button className="boton-icono" onClick={alternar} aria-label={tema === 'claro' ? 'Tema oscuro' : 'Tema claro'}>
                            {tema === 'claro' ? <Moon size={18} /> : <Sun size={18} />}
                        </button>
                    </header>

                    <div className="panel_contenido">
                        {errorCarga && !catalogo && (
                            <div className="alerta" role="alert">{errorCarga} <button className="enlace-boton" onClick={recargar}>Reintentar</button></div>
                        )}
                        {!catalogo && !errorCarga && <p className="cargando">Cargando lugares…</p>}

                        {catalogo && vista.nombre === 'explorar' && (
                            <Explorar lugares={lugares} categoria={vista.categoria as Categoria | null} q={vista.q} referencia={referencia} />
                        )}
                        {catalogo && idLugar && !lugar && (
                            <div className="vacio"><p>No encontramos este lugar.</p><a className="boton" href="#/">Ver todos</a></div>
                        )}
                        {lugar && vista.nombre === 'lugar' && <Ficha lugar={lugar} pos={pos} />}
                        {lugar && enRuta && (
                            <PanelRuta
                                lugar={lugar}
                                modo={modo}
                                rutas={rutasFinales}
                                perfil={perfil}
                                origenEsUsuario={origen.esUsuario}
                                estadoUbicacion={ubicacion.estado}
                                onUsarUbicacion={ubicacion.iniciar}
                            />
                        )}
                    </div>

                    <footer className="panel_pie">
                        <span>Datos: <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">© OpenStreetMap</a> · rutas OSRM</span>
                        <a href="#/admin" className="enlace-discreto"><Settings size={14} /> Gestionar</a>
                    </footer>
                </aside>
            )}
        </div>
    );
}
