import type { Catalogo, Lugar } from '../tipos';

const BASE = '/api';
const CLAVE_OFFLINE = 'chitaga:catalogo-offline:v1';
const CLAVE_ADMIN = 'chitaga:admin';

async function error(res: Response, porDefecto: string): Promise<Error> {
    try {
        const j = await res.json();
        if (j?.error) return new Error(j.error);
    } catch { /* respuesta sin JSON */ }
    return new Error(porDefecto);
}

export function catalogoGuardado(): Catalogo | null {
    try {
        return JSON.parse(localStorage.getItem(CLAVE_OFFLINE) ?? 'null');
    } catch {
        return null;
    }
}

/** Trae el catálogo; si no hay red usa la última copia guardada en el dispositivo. */
export async function cargarCatalogo(): Promise<{ catalogo: Catalogo; sinConexion: boolean }> {
    try {
        const res = await fetch(`${BASE}/lugares`);
        if (!res.ok) throw await error(res, 'No se pudo cargar el catálogo');
        const catalogo = (await res.json()) as Catalogo;
        try { localStorage.setItem(CLAVE_OFFLINE, JSON.stringify(catalogo)); } catch { /* sin espacio */ }
        return { catalogo, sinConexion: false };
    } catch (e) {
        const guardado = catalogoGuardado();
        if (guardado) return { catalogo: guardado, sinConexion: true };
        throw e;
    }
}

// --- Gestión (requiere contraseña de administrador) -----------------------------

export function claveAdmin(): string | null {
    try { return sessionStorage.getItem(CLAVE_ADMIN); } catch { return null; }
}

export function cerrarAdmin() {
    try { sessionStorage.removeItem(CLAVE_ADMIN); } catch { /* nada */ }
}

export async function verificarAdmin(password: string) {
    const res = await fetch(`${BASE}/admin/verificar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
    });
    if (!res.ok) throw await error(res, 'Contraseña incorrecta');
    try { sessionStorage.setItem(CLAVE_ADMIN, password); } catch { /* nada */ }
}

async function admin<T>(ruta: string, metodo: string, cuerpo: unknown, porDefecto: string): Promise<T> {
    const res = await fetch(`${BASE}${ruta}`, {
        method: metodo,
        headers: { 'Content-Type': 'application/json', 'X-Admin-Password': claveAdmin() ?? '' },
        body: cuerpo == null ? undefined : JSON.stringify(cuerpo),
    });
    if (!res.ok) throw await error(res, porDefecto);
    return res.status === 204 ? (undefined as T) : res.json();
}

export const crearLugar = (lugar: Partial<Lugar>) => admin<Lugar>('/lugares', 'POST', { lugar }, 'No se pudo crear el lugar');
export const actualizarLugar = (id: string, lugar: Partial<Lugar>) =>
    admin<Lugar>(`/lugares/${encodeURIComponent(id)}`, 'PUT', { lugar }, 'No se pudo guardar el lugar');
export const eliminarLugar = (id: string) => admin<void>(`/lugares/${encodeURIComponent(id)}`, 'DELETE', null, 'No se pudo eliminar el lugar');
export const fijarUbicacion = (id: string, latitud: number, longitud: number, precision: number) =>
    admin<Lugar>(`/lugares/${encodeURIComponent(id)}/ubicacion`, 'PATCH', { latitud, longitud, precision }, 'No se pudo guardar la ubicación');

export const urlQr = (id: string) => `${BASE}/qr/${encodeURIComponent(id)}`;
