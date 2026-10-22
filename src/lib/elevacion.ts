// Perfil de altitud de una ruta con la API de elevación de Open-Meteo (modelo Copernicus DEM, ~90 m)
import type { LngLat } from '../tipos';

export interface Perfil {
    puntos: { distancia: number; altitud: number }[];
    subida: number;
    bajada: number;
    min: number;
    max: number;
}

const MUESTRAS = 100; // máximo de coordenadas por petición que acepta la API

export async function perfilAltitud(linea: LngLat[], acumulado: number[], signal?: AbortSignal): Promise<Perfil> {
    const total = acumulado[acumulado.length - 1];
    const n = Math.min(MUESTRAS, linea.length);
    const muestras: { distancia: number; punto: LngLat }[] = [];
    let j = 0;
    for (let i = 0; i < n; i++) {
        const d = (total * i) / Math.max(1, n - 1);
        while (j < acumulado.length - 2 && acumulado[j + 1] < d) j++;
        const tramo = acumulado[j + 1] - acumulado[j] || 1;
        const t = Math.min(1, Math.max(0, (d - acumulado[j]) / tramo));
        const [ax, ay] = linea[j];
        const [bx, by] = linea[Math.min(j + 1, linea.length - 1)];
        muestras.push({ distancia: d, punto: [ax + (bx - ax) * t, ay + (by - ay) * t] });
    }

    const lat = muestras.map((m) => m.punto[1].toFixed(5)).join(',');
    const lon = muestras.map((m) => m.punto[0].toFixed(5)).join(',');
    const res = await fetch(`https://api.open-meteo.com/v1/elevation?latitude=${lat}&longitude=${lon}`, { signal });
    if (!res.ok) throw new Error('No se pudo obtener la altitud');
    const { elevation } = (await res.json()) as { elevation: number[] };

    let subida = 0;
    let bajada = 0;
    for (let i = 1; i < elevation.length; i++) {
        const d = elevation[i] - elevation[i - 1];
        // Umbral de 2 m para no sumar ruido del modelo de terreno
        if (d > 2) subida += d;
        else if (d < -2) bajada -= d;
    }
    return {
        puntos: muestras.map((m, i) => ({ distancia: m.distancia, altitud: elevation[i] })),
        subida: Math.round(subida),
        bajada: Math.round(bajada),
        min: Math.round(Math.min(...elevation)),
        max: Math.round(Math.max(...elevation)),
    };
}

/**
 * Tiempo a pie según la función de senderismo de Tobler: v = 6·e^(−3,5·|pendiente + 0,05|) km/h.
 * Es más realista en montaña que una velocidad constante.
 */
export function tiempoTobler(perfil: Perfil): number {
    let segundos = 0;
    for (let i = 1; i < perfil.puntos.length; i++) {
        const dx = perfil.puntos[i].distancia - perfil.puntos[i - 1].distancia;
        if (dx <= 0) continue;
        const pendiente = (perfil.puntos[i].altitud - perfil.puntos[i - 1].altitud) / dx;
        const kmh = 6 * Math.exp(-3.5 * Math.abs(pendiente + 0.05));
        segundos += (dx / 1000 / kmh) * 3600;
    }
    return segundos;
}
