import { useEffect, useMemo, useRef } from 'react';
import { Flag, X } from 'lucide-react';
import { distancia, formatoDistancia, formatoDuracion, horaLlegada, proyectar } from '../lib/geo';
import type { Ruta } from '../lib/rutas';
import type { Lugar, Posicion } from '../tipos';
import IconoManiobra from './IconoManiobra';

interface Props {
    lugar: Lugar;
    ruta: Ruta;
    pos: Posicion | null;
    onRecalcular: () => void;
    onSalir: () => void;
}

const DESVIO_MAX = 45; // metros fuera de la ruta antes de recalcular
const LLEGADA = 25; // metros al destino para darlo por alcanzado

export default function Navegacion({ lugar, ruta, pos, onRecalcular, onSalir }: Props) {
    const desviosSeguidos = useRef(0);
    const ultimoRecalculo = useRef(0);

    const estado = useMemo(() => {
        if (!pos) return null;
        const yo: [number, number] = [pos.lon, pos.lat];
        const p = proyectar(yo, ruta.linea, ruta.acumulado);
        const restanteVia = Math.max(0, ruta.distancia - p.recorrido);
        const alDestino = distancia(yo, ruta.destino);
        const siguiente = ruta.pasos.find((s) => s.inicio > p.recorrido + 5) ?? ruta.pasos[ruta.pasos.length - 1];
        return {
            desvio: p.desvio,
            restante: restanteVia + ruta.brechaFinal,
            segundos: ruta.duracion * (restanteVia / (ruta.distancia || 1)),
            alDestino,
            siguiente,
            aSiguiente: Math.max(0, siguiente.inicio - p.recorrido),
            llego: alDestino < Math.max(LLEGADA, pos.precision),
        };
    }, [pos, ruta]);

    // Recalcula si te sales de la ruta en dos lecturas seguidas (evita saltos del GPS)
    useEffect(() => {
        if (!estado || !pos || estado.llego) return;
        if (estado.desvio > Math.max(DESVIO_MAX, pos.precision * 1.5)) desviosSeguidos.current++;
        else desviosSeguidos.current = 0;
        if (desviosSeguidos.current >= 2 && Date.now() - ultimoRecalculo.current > 15_000) {
            desviosSeguidos.current = 0;
            ultimoRecalculo.current = Date.now();
            onRecalcular();
        }
    }, [estado, pos, onRecalcular]);

    // Mantener la pantalla encendida mientras se navega, si el navegador lo permite
    useEffect(() => {
        let bloqueo: WakeLockSentinel | null = null;
        navigator.wakeLock?.request('screen').then((b) => { bloqueo = b; }).catch(() => {});
        return () => { bloqueo?.release().catch(() => {}); };
    }, []);

    if (!estado) {
        return (
            <div className="nav">
                <div className="nav_instruccion"><p>Esperando señal de GPS…</p></div>
                <div className="nav_barra"><button className="boton" onClick={onSalir}><X size={18} /> Salir</button></div>
            </div>
        );
    }

    const fueraDeVia = estado.aSiguiente === 0 && estado.siguiente.tipo === 'arrive' && ruta.brechaFinal > 30;

    return (
        <div className="nav">
            <div className={`nav_instruccion ${estado.llego ? 'nav_instruccion--llegada' : ''}`} aria-live="polite">
                {estado.llego ? (
                    <><Flag size={30} /><div><p className="nav_dist">Llegaste</p><p>{lugar.nombre}</p></div></>
                ) : fueraDeVia ? (
                    <><Flag size={30} /><div><p className="nav_dist">{formatoDistancia(estado.alDestino)}</p><p>Fin del camino mapeado. Sigue en línea recta hacia el destino.</p></div></>
                ) : (
                    <>
                        <IconoManiobra tipo={estado.siguiente.tipo} modificador={estado.siguiente.modificador} tamano={34} />
                        <div>
                            <p className="nav_dist">{formatoDistancia(estado.aSiguiente)}</p>
                            <p>{estado.siguiente.tipo === 'arrive' ? `Llegas a ${lugar.nombre}` : estado.siguiente.texto}</p>
                        </div>
                    </>
                )}
            </div>

            {pos && pos.precision > 50 && !estado.llego && (
                <p className="nav_aviso">Señal GPS débil (±{Math.round(pos.precision)} m). Las indicaciones pueden fallar.</p>
            )}

            <div className="nav_barra">
                {estado.llego ? (
                    <div><p className="nav_tiempo">Fin del recorrido</p><p>{lugar.tipo}</p></div>
                ) : (
                    <div>
                        <p className="nav_tiempo">{formatoDuracion(estado.segundos)}</p>
                        <p>{formatoDistancia(estado.restante)} · llegada {horaLlegada(estado.segundos)}</p>
                    </div>
                )}
                <button className={`boton ${estado.llego ? 'boton--primario' : 'boton--peligro'}`} onClick={onSalir}><X size={18} /> {estado.llego ? 'Terminar' : 'Salir'}</button>
            </div>
        </div>
    );
}
