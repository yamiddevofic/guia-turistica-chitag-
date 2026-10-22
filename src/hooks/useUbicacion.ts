import { useCallback, useEffect, useRef, useState } from 'react';
import type { Posicion } from '../tipos';

export type EstadoUbicacion = 'inactivo' | 'buscando' | 'activo' | 'denegado' | 'no-disponible' | 'error';

/** Sigue la posición del dispositivo con GPS de alta precisión. */
export function useUbicacion() {
    const [pos, setPos] = useState<Posicion | null>(null);
    const [estado, setEstado] = useState<EstadoUbicacion>('inactivo');
    const [mensaje, setMensaje] = useState<string | null>(null);
    const vigilante = useRef<number | null>(null);

    const detener = useCallback(() => {
        if (vigilante.current != null) navigator.geolocation.clearWatch(vigilante.current);
        vigilante.current = null;
    }, []);

    const iniciar = useCallback(() => {
        if (!('geolocation' in navigator)) {
            setEstado('no-disponible');
            setMensaje('Este navegador no permite ubicar el dispositivo.');
            return;
        }
        if (!window.isSecureContext) {
            setEstado('no-disponible');
            setMensaje('La ubicación solo funciona con HTTPS o en localhost.');
            return;
        }
        if (vigilante.current != null) return;
        setEstado('buscando');
        setMensaje(null);
        vigilante.current = navigator.geolocation.watchPosition(
            (p) => {
                setPos({
                    lat: p.coords.latitude,
                    lon: p.coords.longitude,
                    precision: p.coords.accuracy,
                    rumbo: p.coords.heading != null && !Number.isNaN(p.coords.heading) ? p.coords.heading : null,
                    velocidad: p.coords.speed,
                    altitud: p.coords.altitude,
                    t: p.timestamp,
                });
                setEstado('activo');
            },
            (e) => {
                if (e.code === e.PERMISSION_DENIED) {
                    setEstado('denegado');
                    setMensaje('El permiso de ubicación está bloqueado. Actívalo en la configuración del navegador.');
                    detener();
                } else {
                    setEstado((s) => (s === 'activo' ? s : 'error'));
                    setMensaje(e.code === e.TIMEOUT ? 'El GPS tarda en responder. Sal a cielo abierto.' : 'No se pudo obtener tu ubicación.');
                }
            },
            { enableHighAccuracy: true, maximumAge: 0, timeout: 20_000 },
        );
    }, [detener]);

    // Si ya diste permiso antes, el GPS arranca solo (no se vuelve a preguntar)
    useEffect(() => {
        navigator.permissions?.query({ name: 'geolocation' })
            .then((p) => { if (p.state === 'granted') iniciar(); })
            .catch(() => {});
    }, [iniciar]);

    useEffect(() => detener, [detener]);

    return { pos, estado, mensaje, iniciar, detener };
}
