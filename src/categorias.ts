import {
    Landmark, Mountain, HeartPulse, GraduationCap, Bus, UtensilsCrossed, BedDouble, Building2, Home,
    type LucideIcon,
} from 'lucide-react';
import type { Categoria, Verificacion } from './tipos';

export interface InfoCategoria { id: Categoria; nombre: string; color: string; Icono: LucideIcon }

export const CATEGORIAS: InfoCategoria[] = [
    { id: 'turismo', nombre: 'Turismo', color: '#c2653c', Icono: Landmark },
    { id: 'naturaleza', nombre: 'Naturaleza', color: '#2d8a5f', Icono: Mountain },
    { id: 'salud', nombre: 'Salud', color: '#d6342f', Icono: HeartPulse },
    { id: 'educacion', nombre: 'Educación', color: '#3d6fd1', Icono: GraduationCap },
    { id: 'transporte', nombre: 'Transporte', color: '#6b5bd2', Icono: Bus },
    { id: 'comida', nombre: 'Restaurantes', color: '#e8a512', Icono: UtensilsCrossed },
    { id: 'hospedaje', nombre: 'Hoteles', color: '#b0457a', Icono: BedDouble },
    { id: 'servicios', nombre: 'Servicios', color: '#5b6b66', Icono: Building2 },
    { id: 'poblado', nombre: 'Poblados', color: '#7a6a4f', Icono: Home },
];

export const CATEGORIA = Object.fromEntries(CATEGORIAS.map((c) => [c.id, c])) as Record<Categoria, InfoCategoria>;

export const VERIFICACION: Record<Verificacion, { texto: string; detalle: string; tono: 'ok' | 'info' | 'aviso' | 'pendiente' }> = {
    verificada: { texto: 'Ubicación verificada', detalle: 'Tomada en sitio con GPS.', tono: 'ok' },
    osm: { texto: 'OpenStreetMap', detalle: 'Coordenada de OpenStreetMap, mapeada por la comunidad.', tono: 'info' },
    aproximada: { texto: 'Ubicación aproximada', detalle: 'Deducida de un camino cercano; puede variar decenas de metros.', tono: 'aviso' },
    pendiente: { texto: 'Ubicación por confirmar', detalle: 'Aún no tenemos coordenadas confiables, por eso no se traza ruta.', tono: 'pendiente' },
};

export const DIFICULTAD = { facil: 'Fácil', moderada: 'Moderada', dificil: 'Exigente' } as const;
