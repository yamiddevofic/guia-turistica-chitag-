import { ArrowLeft, Bike, Car, CircleDot, Footprints, LocateFixed, MapPin, Play, TriangleAlert, TrendingDown, TrendingUp } from 'lucide-react';
import { formatoDistancia, formatoDuracion, horaLlegada } from '../lib/geo';
import { MODOS, type Modo, type Ruta } from '../lib/rutas';
import type { Perfil } from '../lib/elevacion';
import type { EstadoUbicacion } from '../hooks/useUbicacion';
import type { Lugar } from '../tipos';
import IconoManiobra from './IconoManiobra';

interface Props {
    lugar: Lugar;
    modo: Modo;
    rutas: Partial<Record<Modo, Ruta | Error | 'cargando'>>;
    perfil: Perfil | null;
    origenEsUsuario: boolean;
    estadoUbicacion: EstadoUbicacion;
    onUsarUbicacion: () => void;
}

const ICONOS_MODO = { pie: Footprints, carro: Car, bici: Bike };

function Altimetria({ perfil }: { perfil: Perfil }) {
    const W = 320, H = 70;
    const total = perfil.puntos[perfil.puntos.length - 1].distancia || 1;
    const rango = Math.max(20, perfil.max - perfil.min);
    const x = (d: number) => (d / total) * W;
    const y = (a: number) => H - 6 - ((a - perfil.min) / rango) * (H - 14);
    const linea = perfil.puntos.map((p, i) => `${i ? 'L' : 'M'}${x(p.distancia).toFixed(1)},${y(p.altitud).toFixed(1)}`).join('');
    return (
        <figure className="altimetria">
            <figcaption>
                <span><TrendingUp size={14} /> {perfil.subida} m</span>
                <span><TrendingDown size={14} /> {perfil.bajada} m</span>
                <span className="altimetria_rango">{perfil.min.toLocaleString('es-CO')}–{perfil.max.toLocaleString('es-CO')} m</span>
            </figcaption>
            <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Perfil de altitud: sube ${perfil.subida} m y baja ${perfil.bajada} m`}>
                <path d={`${linea}L${W},${H}L0,${H}Z`} className="altimetria_area" />
                <path d={linea} className="altimetria_linea" />
            </svg>
        </figure>
    );
}

export default function PanelRuta({ lugar, modo, rutas, perfil, origenEsUsuario, estadoUbicacion, onUsarUbicacion }: Props) {
    const actual = rutas[modo];
    const ruta = actual && actual !== 'cargando' && !(actual instanceof Error) ? actual : null;
    const id = encodeURIComponent(lugar.id);

    return (
        <section className="panel-ruta" aria-labelledby="ruta-titulo">
            <a className="volver" href={`#/lugar/${id}`}><ArrowLeft size={18} /> {lugar.nombre}</a>
            <h1 id="ruta-titulo" className="oculto">Cómo llegar a {lugar.nombre}</h1>

            <div className="extremos">
                <div className="extremo">
                    <CircleDot size={18} className="extremo_icono extremo_icono--origen" />
                    <span>{origenEsUsuario ? 'Tu ubicación' : 'Parque Principal de Chitagá'}</span>
                    {!origenEsUsuario && (
                        <button className="enlace-boton" onClick={onUsarUbicacion} disabled={estadoUbicacion === 'buscando'}>
                            <LocateFixed size={15} /> {estadoUbicacion === 'buscando' ? 'Buscando…' : 'Usar mi ubicación'}
                        </button>
                    )}
                </div>
                <div className="extremo">
                    <MapPin size={18} className="extremo_icono extremo_icono--destino" />
                    <span>{lugar.nombre}</span>
                </div>
            </div>

            <div className="modos" role="radiogroup" aria-label="Medio de transporte">
                {(Object.keys(MODOS) as Modo[]).map((m) => {
                    const r = rutas[m];
                    const Icono = ICONOS_MODO[m];
                    return (
                        <a
                            key={m}
                            role="radio"
                            aria-checked={m === modo}
                            className="modo"
                            href={`#/ruta/${id}?modo=${m}`}
                            onClick={(e) => { e.preventDefault(); history.replaceState(null, '', `#/ruta/${id}?modo=${m}`); window.dispatchEvent(new HashChangeEvent('hashchange')); }}
                        >
                            <Icono size={20} aria-hidden="true" />
                            <span className="modo_nombre">{MODOS[m].nombre}</span>
                            <span className="modo_tiempo">
                                {r === 'cargando' || r === undefined ? '…' : r instanceof Error ? '—' : formatoDuracion(r.duracion)}
                            </span>
                        </a>
                    );
                })}
            </div>

            {actual === 'cargando' && <p className="cargando">Calculando la mejor ruta…</p>}
            {actual instanceof Error && <p className="alerta"><TriangleAlert size={16} /> {actual.message}</p>}

            {ruta && (
                <>
                    <div className="resumen-ruta">
                        <div>
                            <p className="resumen-ruta_tiempo">{formatoDuracion(ruta.duracion)}</p>
                            <p>{formatoDistancia(ruta.distancia)}{ruta.via ? ` · por ${ruta.via}` : ''}</p>
                            <p className="resumen-ruta_llegada">Llegada aprox. {horaLlegada(ruta.duracion)}</p>
                        </div>
                        {origenEsUsuario ? (
                            <a className="boton boton--primario" href={`#/navegar/${id}?modo=${modo}`}><Play size={18} /> Iniciar</a>
                        ) : (
                            <button className="boton" onClick={onUsarUbicacion}><LocateFixed size={18} /> Activar GPS</button>
                        )}
                    </div>

                    {perfil && <Altimetria perfil={perfil} />}
                    {ruta.conPendiente && <p className="nota">Tiempo a pie calculado con la pendiente del terreno.</p>}

                    {ruta.derivada && (
                        <p className="alerta">
                            <TriangleAlert size={16} />
                            No hay un camino {modo === 'pie' ? 'peatonal' : 'para bici'} directo mapeado: la ruta sigue la vía vehicular.
                            Camina por la berma, de frente al tráfico, y usa ropa visible.
                        </p>
                    )}

                    {ruta.brechaFinal > 30 && (
                        <p className="alerta">
                            <TriangleAlert size={16} />
                            Los últimos {formatoDistancia(ruta.brechaFinal)} no tienen camino mapeado (línea punteada gris).
                            Sigue senderos visibles o pregunta a alguien de la zona.
                        </p>
                    )}
                    {lugar.ubicacion.verificacion === 'aproximada' && (
                        <p className="alerta"><TriangleAlert size={16} /> El destino es aproximado: confirma al llegar.</p>
                    )}
                    {modo === 'pie' && (lugar.altitud ?? 0) > 3000 && (
                        <p className="alerta alerta--info">
                            El tiempo incluye la pendiente, pero no el cansancio por la altura del páramo. Calcula margen, sal temprano y lleva abrigo.
                        </p>
                    )}

                    <ol className="pasos">
                        {ruta.pasos.map((p, i) => (
                            <li key={i}>
                                <IconoManiobra tipo={p.tipo} modificador={p.modificador} />
                                <span className="pasos_texto">{i === ruta.pasos.length - 1 && ruta.brechaFinal <= 30 ? `Llegas a ${lugar.nombre}` : p.texto}</span>
                                {p.distancia > 0 && <span className="pasos_dist">{formatoDistancia(p.distancia)}</span>}
                            </li>
                        ))}
                    </ol>
                    <p className="nota">Rutas calculadas con OSRM sobre OpenStreetMap. Verifica las señales en la vía.</p>
                </>
            )}
        </section>
    );
}
