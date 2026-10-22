import type { LngLat, Lugar } from '../tipos';

const R = 6_371_008.8; // radio medio terrestre en metros
const rad = (g: number) => (g * Math.PI) / 180;
const grados = (r: number) => (r * 180) / Math.PI;

/** Distancia geodésica (haversine) en metros entre dos puntos [lon, lat]. */
export function distancia([lon1, lat1]: LngLat, [lon2, lat2]: LngLat): number {
    const dLat = rad(lat2 - lat1);
    const dLon = rad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** Rumbo inicial en grados (0 = norte, sentido horario). */
export function rumbo([lon1, lat1]: LngLat, [lon2, lat2]: LngLat): number {
    const y = Math.sin(rad(lon2 - lon1)) * Math.cos(rad(lat2));
    const x = Math.cos(rad(lat1)) * Math.sin(rad(lat2)) - Math.sin(rad(lat1)) * Math.cos(rad(lat2)) * Math.cos(rad(lon2 - lon1));
    return (grados(Math.atan2(y, x)) + 360) % 360;
}

const PUNTOS = ['norte', 'noreste', 'este', 'sureste', 'sur', 'suroeste', 'oeste', 'noroeste'];
export const puntoCardinal = (g: number) => PUNTOS[Math.round(g / 45) % 8];

export function coordenadas(l: Lugar): LngLat | null {
    const { latitud, longitud } = l.ubicacion;
    return latitud == null || longitud == null ? null : [longitud, latitud];
}

export function formatoDistancia(m: number): string {
    if (m < 50) return `${Math.round(m / 5) * 5} m`;
    if (m < 1000) return `${Math.round(m / 10) * 10} m`;
    if (m < 10_000) return `${(m / 1000).toFixed(1).replace('.', ',')} km`;
    return `${Math.round(m / 1000)} km`;
}

export function formatoDuracion(s: number): string {
    const min = Math.max(1, Math.round(s / 60));
    if (min < 60) return `${min} min`;
    const h = Math.floor(min / 60);
    const r = min % 60;
    return r ? `${h} h ${r} min` : `${h} h`;
}

export const horaLlegada = (s: number) =>
    new Date(Date.now() + s * 1000).toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' });

/** Polígono aproximado de un círculo (para dibujar la precisión del GPS). */
export function circulo([lon, lat]: LngLat, radio: number, lados = 48): LngLat[] {
    const d = radio / R;
    const pts: LngLat[] = [];
    for (let i = 0; i <= lados; i++) {
        const b = (2 * Math.PI * i) / lados;
        const lat2 = Math.asin(Math.sin(rad(lat)) * Math.cos(d) + Math.cos(rad(lat)) * Math.sin(d) * Math.cos(b));
        const lon2 = rad(lon) + Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(rad(lat)), Math.cos(d) - Math.sin(rad(lat)) * Math.sin(lat2));
        pts.push([grados(lon2), grados(lat2)]);
    }
    return pts;
}

export interface Proyeccion {
    /** Punto de la línea más cercano a la posición */
    punto: LngLat;
    /** Distancia (m) desde la posición a la línea */
    desvio: number;
    /** Distancia (m) recorrida sobre la línea hasta el punto */
    recorrido: number;
    /** Índice del segmento donde cae */
    segmento: number;
}

/**
 * Proyecta una posición sobre una polilínea. Usa una proyección equirrectangular local,
 * suficientemente precisa para tramos de pocos kilómetros.
 */
export function proyectar(pos: LngLat, linea: LngLat[], acumulado: number[]): Proyeccion {
    const k = Math.cos(rad(pos[1]));
    let mejor: Proyeccion = { punto: linea[0], desvio: Infinity, recorrido: 0, segmento: 0 };
    for (let i = 0; i < linea.length - 1; i++) {
        const [ax, ay] = linea[i];
        const [bx, by] = linea[i + 1];
        const dx = (bx - ax) * k;
        const dy = by - ay;
        const len2 = dx * dx + dy * dy;
        let t = len2 ? (((pos[0] - ax) * k) * dx + (pos[1] - ay) * dy) / len2 : 0;
        t = Math.max(0, Math.min(1, t));
        const p: LngLat = [ax + (bx - ax) * t, ay + (by - ay) * t];
        const d = distancia(pos, p);
        if (d < mejor.desvio) {
            mejor = { punto: p, desvio: d, recorrido: acumulado[i] + distancia(linea[i], p), segmento: i };
        }
    }
    return mejor;
}

/** Distancias acumuladas a lo largo de una polilínea. */
export function acumular(linea: LngLat[]): number[] {
    const acc = [0];
    for (let i = 1; i < linea.length; i++) acc.push(acc[i - 1] + distancia(linea[i - 1], linea[i]));
    return acc;
}
