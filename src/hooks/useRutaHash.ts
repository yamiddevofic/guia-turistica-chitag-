import { useEffect, useState } from 'react';

// Navegación por hash, igual que PlantasQR: funciona en cualquier hosting estático
// y los códigos QR pueden apuntar directo a una ficha (#/lugar/:id).
export type Vista =
    | { nombre: 'explorar'; categoria: string | null; q: string }
    | { nombre: 'lugar'; id: string }
    | { nombre: 'ruta'; id: string; modo: string | null }
    | { nombre: 'navegar'; id: string; modo: string | null }
    | { nombre: 'admin'; id: string | null }
    | { nombre: 'placas' }
    | { nombre: 'acerca' };

export function leerHash(hash: string): Vista {
    const [ruta, query = ''] = hash.replace(/^#/, '').split('?');
    const p = new URLSearchParams(query);
    const partes = ruta.split('/').filter(Boolean).map(decodeURIComponent);
    switch (partes[0]) {
        case 'lugar': if (partes[1]) return { nombre: 'lugar', id: partes[1] }; break;
        case 'ruta': if (partes[1]) return { nombre: 'ruta', id: partes[1], modo: p.get('modo') }; break;
        case 'navegar': if (partes[1]) return { nombre: 'navegar', id: partes[1], modo: p.get('modo') }; break;
        case 'admin': return { nombre: 'admin', id: partes[1] ?? null };
        case 'placas': return { nombre: 'placas' };
        case 'acerca': return { nombre: 'acerca' };
    }
    return { nombre: 'explorar', categoria: p.get('categoria'), q: p.get('q') ?? '' };
}

export const ir = (hash: string) => { window.location.hash = hash; };

export function useRutaHash(): Vista {
    const [vista, setVista] = useState(() => leerHash(window.location.hash));
    useEffect(() => {
        const alCambiar = () => setVista(leerHash(window.location.hash));
        window.addEventListener('hashchange', alCambiar);
        return () => window.removeEventListener('hashchange', alCambiar);
    }, []);
    return vista;
}
