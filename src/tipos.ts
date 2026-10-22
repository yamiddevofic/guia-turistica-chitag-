export type Categoria =
    | 'turismo' | 'naturaleza' | 'salud' | 'educacion' | 'transporte'
    | 'comida' | 'hospedaje' | 'servicios' | 'poblado';

/**
 * Qué tan confiable es la coordenada:
 * - verificada: tomada en sitio por un administrador
 * - osm: proviene de OpenStreetMap
 * - aproximada: deducida (p. ej. final de un camino); puede tener decenas de metros de error
 * - pendiente: sin coordenada; no se puede trazar ruta
 */
export type Verificacion = 'verificada' | 'osm' | 'aproximada' | 'pendiente';
export type Dificultad = 'facil' | 'moderada' | 'dificil';

export interface Enlace { nombre: string; url?: string }

export interface Lugar {
    id: string;
    nombre: string;
    categoria: Categoria;
    tipo: string;
    sinNombre?: boolean;
    destacado?: boolean;
    altitud?: number;
    descripcion?: { general?: string; historia?: string };
    ubicacion: { latitud?: number; longitud?: number; descripcion?: string; verificacion: Verificacion; precision?: number };
    acceso?: { desde?: string; tiempo?: string; dificultad?: Dificultad };
    horario?: string;
    telefono?: string;
    web?: string;
    imagen?: string;
    consejos?: string[];
    datosCuriosos?: string[];
    enlaces?: Enlace[];
    fuentes?: Enlace[];
    actualizado?: string;
}

export interface Catalogo { version: number; actualizado: string; lugares: Lugar[] }

export interface Posicion {
    lat: number;
    lon: number;
    precision: number;
    rumbo: number | null;
    velocidad: number | null;
    altitud: number | null;
    t: number;
}

export type LngLat = [number, number];
