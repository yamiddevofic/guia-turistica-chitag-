// Cálculo de rutas con OSRM sobre datos de OpenStreetMap (servidores públicos de FOSSGIS).
import { acumular } from './geo';
import type { LngLat } from '../tipos';

export type Modo = 'pie' | 'carro' | 'bici';

export const MODOS: Record<Modo, { nombre: string; perfil: string }> = {
    pie: { nombre: 'A pie', perfil: 'routed-foot' },
    carro: { nombre: 'En carro', perfil: 'routed-car' },
    bici: { nombre: 'En bici', perfil: 'routed-bike' },
};

export interface Paso {
    texto: string;
    tipo: string;
    modificador?: string;
    distancia: number;
    duracion: number;
    /** Punto donde ocurre la maniobra */
    ubicacion: LngLat;
    /** Distancia recorrida desde el inicio hasta la maniobra */
    inicio: number;
}

export interface Ruta {
    modo: Modo;
    distancia: number;
    duracion: number;
    via: string;
    linea: LngLat[];
    acumulado: number[];
    pasos: Paso[];
    /** Metros entre tu posición y el inicio de la vía más cercana */
    brechaInicio: number;
    /** Metros entre el final de la vía y el lugar (tramo sin camino mapeado) */
    brechaFinal: number;
    destino: LngLat;
    /** El trazado se tomó de la ruta en carro porque la del modo era un rodeo desproporcionado */
    derivada?: boolean;
    /** El tiempo se calculó con la pendiente del terreno (función de Tobler) */
    conPendiente?: boolean;
}

const VELOCIDAD_BASE: Record<Modo, number> = { pie: 4.5, bici: 12, carro: 40 }; // km/h

/**
 * Los perfiles a pie y en bici de OSRM a veces evitan la troncal y dan rodeos enormes por la montaña.
 * Si la ruta del modo es mucho más larga que la vehicular, se usa el trazado vehicular (caminando por la berma).
 */
export function corregirRodeo(ruta: Ruta, carro: Ruta | null): Ruta {
    if (!carro || ruta.modo === 'carro') return ruta;
    const rodeo = ruta.distancia > Math.max(carro.distancia * 1.6, carro.distancia + 2000);
    if (!rodeo) return ruta;
    return {
        ...carro,
        modo: ruta.modo,
        duracion: (carro.distancia / 1000 / VELOCIDAD_BASE[ruta.modo]) * 3600,
        derivada: true,
    };
}

const GIROS: Record<string, string> = {
    left: 'a la izquierda', right: 'a la derecha',
    'slight left': 'levemente a la izquierda', 'slight right': 'levemente a la derecha',
    'sharp left': 'cerrado a la izquierda', 'sharp right': 'cerrado a la derecha',
    straight: 'recto', uturn: 'en U',
};
const LADOS: Record<string, string> = { left: 'izquierda', right: 'derecha', 'slight left': 'izquierda', 'slight right': 'derecha', 'sharp left': 'izquierda', 'sharp right': 'derecha' };
const ORDINAL = ['primera', 'segunda', 'tercera', 'cuarta', 'quinta', 'sexta'];

interface ManiobraOsrm { type: string; modifier?: string; exit?: number; location: LngLat; bearing_after: number }
interface PasoOsrm { name: string; ref?: string; distance: number; duration: number; maneuver: ManiobraOsrm }

function instruccion(p: PasoOsrm, ultimo: boolean): string {
    const { type, modifier, exit } = p.maneuver;
    const via = p.name || p.ref || '';
    const por = via ? ` por ${via}` : '';
    const giro = modifier ? GIROS[modifier] ?? '' : '';
    switch (type) {
        case 'depart': return via ? `Sal por ${via}` : 'Inicia el recorrido';
        case 'arrive': return ultimo ? 'Llegas al final de la vía' : `Llegas a ${via || 'un punto intermedio'}`;
        case 'turn':
        case 'end of road':
            if (modifier === 'straight') return `Continúa recto${por}`;
            if (modifier === 'uturn') return `Da la vuelta${por}`;
            return `${type === 'end of road' ? 'Al final de la vía, gira' : 'Gira'} ${giro}${por}`;
        case 'new name':
        case 'continue': return modifier && modifier !== 'straight' ? `Sigue ${giro}${por}` : `Continúa${por}`;
        case 'merge': return `Incorpórate${por}`;
        case 'on ramp': return `Toma la entrada${por}`;
        case 'off ramp': return `Toma la salida${por}`;
        case 'fork': return `En la bifurcación, mantente a la ${LADOS[modifier ?? ''] ?? 'derecha'}${por}`;
        case 'roundabout':
        case 'rotary':
        case 'roundabout turn': return exit ? `En la glorieta, toma la ${ORDINAL[exit - 1] ?? `${exit}.ª`} salida${por}` : `Entra a la glorieta${por}`;
        case 'exit roundabout':
        case 'exit rotary': return `Sal de la glorieta${por}`;
        default: return giro ? `Gira ${giro}${por}` : `Continúa${por}`;
    }
}

export async function calcularRuta(modo: Modo, desde: LngLat, hasta: LngLat, signal?: AbortSignal): Promise<Ruta> {
    const puntos = `${desde.join(',')};${hasta.join(',')}`;
    const url = `https://routing.openstreetmap.de/${MODOS[modo].perfil}/route/v1/driving/${puntos}?overview=full&geometries=geojson&steps=true`;
    // Límite de 25 s: en zona rural la señal es débil y no conviene quedarse esperando
    const limite = AbortSignal.timeout(25_000);
    const res = await fetch(url, { signal: signal ? AbortSignal.any([signal, limite]) : limite }).catch((e) => {
        if (limite.aborted) throw new Error('El servicio de rutas no respondió a tiempo');
        throw e;
    });
    if (!res.ok) throw new Error(`El servicio de rutas respondió ${res.status}`);
    const json = await res.json();
    if (json.code !== 'Ok' || !json.routes?.length) {
        throw new Error(json.code === 'NoRoute' ? 'No hay un camino mapeado hasta este lugar' : 'No se pudo calcular la ruta');
    }

    const r = json.routes[0];
    const linea = r.geometry.coordinates as LngLat[];
    const acumulado = acumular(linea);
    const crudos = r.legs[0].steps as PasoOsrm[];
    let recorrido = 0;
    const pasos: Paso[] = crudos.map((p, i) => {
        const paso: Paso = {
            texto: instruccion(p, i === crudos.length - 1),
            tipo: p.maneuver.type,
            modificador: p.maneuver.modifier,
            distancia: p.distance,
            duracion: p.duration,
            ubicacion: p.maneuver.location,
            inicio: recorrido,
        };
        recorrido += p.distance;
        return paso;
    });

    return {
        modo,
        distancia: r.distance,
        duracion: r.duration,
        via: r.legs[0].summary || '',
        linea,
        acumulado,
        pasos,
        brechaInicio: json.waypoints[0].distance ?? 0,
        brechaFinal: json.waypoints[1].distance ?? 0,
        destino: hasta,
    };
}
