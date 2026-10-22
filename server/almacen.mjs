// Almacén de lugares en un archivo JSON con escritura atómica.
// Si no existe, se genera desde los atractivos curados + los datos de OpenStreetMap.
import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname } from 'node:path';

const ARCHIVO = process.env.DATA_FILE ?? new URL('../data/lugares.json', import.meta.url).pathname;
const ATRACTIVOS = new URL('./atractivos.json', import.meta.url);
const OSM = new URL('../public/data/osm.json', import.meta.url);

export const CATEGORIAS = ['turismo', 'naturaleza', 'salud', 'educacion', 'transporte', 'comida', 'hospedaje', 'servicios', 'poblado'];
export const VERIFICACIONES = ['verificada', 'osm', 'aproximada', 'pendiente'];
const DIFICULTADES = ['facil', 'moderada', 'dificil'];

// Región amplia alrededor de Chitagá: evita coordenadas mal digitadas (p. ej. signo invertido)
const REGION = { minLat: 6.7, maxLat: 7.5, minLon: -73.1, maxLon: -72.1 };

let cache = null;
let cola = Promise.resolve();

function desdeOsm(l) {
    return {
        id: l.id,
        nombre: l.nombre,
        categoria: l.categoria,
        tipo: l.tipo,
        sinNombre: l.sinNombre || undefined,
        altitud: l.altitud,
        descripcion: {},
        ubicacion: { latitud: l.lat, longitud: l.lon, verificacion: 'osm' },
        horario: l.horario,
        telefono: l.telefono,
        web: l.web,
        fuentes: [{ nombre: 'OpenStreetMap', url: l.fuente.url }],
    };
}

async function semilla() {
    const atractivos = JSON.parse(await readFile(ATRACTIVOS, 'utf8'));
    const osm = existsSync(OSM) ? JSON.parse(await readFile(OSM, 'utf8')) : { lugares: [] };
    const reemplazados = new Set(atractivos.map((a) => a.osmId).filter(Boolean));
    const ahora = new Date().toISOString();
    const lugares = [
        ...atractivos.map((a) => ({ ...a, osmId: undefined, actualizado: ahora })),
        ...osm.lugares.filter((l) => !reemplazados.has(l.id)).map((l) => ({ ...desdeOsm(l), actualizado: osm.generado })),
    ];
    return { version: 1, actualizado: ahora, lugares };
}

async function cargar() {
    if (cache) return cache;
    if (existsSync(ARCHIVO)) {
        cache = JSON.parse(await readFile(ARCHIVO, 'utf8'));
    } else {
        cache = await semilla();
        await guardar(cache);
    }
    return cache;
}

async function guardar(datos) {
    await mkdir(dirname(ARCHIVO), { recursive: true });
    const tmp = `${ARCHIVO}.${process.pid}.tmp`;
    await writeFile(tmp, JSON.stringify(datos, null, 2));
    await rename(tmp, ARCHIVO);
}

// Las escrituras se encolan para que dos peticiones simultáneas no se pisen
function mutar(fn) {
    const tarea = cola.then(async () => {
        const datos = await cargar();
        const resultado = fn(datos);
        datos.actualizado = new Date().toISOString();
        await guardar(datos);
        return resultado;
    });
    cola = tarea.catch(() => {});
    return tarea;
}

export class ErrorValidacion extends Error {}

function texto(v, max, campo, requerido = false) {
    if (v == null || v === '') {
        if (requerido) throw new ErrorValidacion(`El campo "${campo}" es obligatorio`);
        return undefined;
    }
    if (typeof v !== 'string') throw new ErrorValidacion(`El campo "${campo}" debe ser texto`);
    const t = v.trim();
    if (t.length > max) throw new ErrorValidacion(`El campo "${campo}" supera ${max} caracteres`);
    return t || undefined;
}

function lista(v, max, campo) {
    if (v == null) return undefined;
    if (!Array.isArray(v)) throw new ErrorValidacion(`El campo "${campo}" debe ser una lista`);
    return v.map((x, i) => texto(x, max, `${campo}[${i}]`)).filter(Boolean);
}

function url(v, campo) {
    const t = texto(v, 500, campo);
    if (!t) return undefined;
    try {
        const u = new URL(t);
        if (!/^https?:$/.test(u.protocol)) throw new Error();
        return u.toString();
    } catch {
        throw new ErrorValidacion(`El campo "${campo}" debe ser una URL http(s)`);
    }
}

function coordenada(v, min, max, campo) {
    if (v == null || v === '') return undefined;
    const n = Number(v);
    if (!Number.isFinite(n) || n < min || n > max) {
        throw new ErrorValidacion(`El campo "${campo}" está fuera de la región de Chitagá (${min} a ${max})`);
    }
    return +n.toFixed(6);
}

export function validarLugar(entrada, id) {
    if (!entrada || typeof entrada !== 'object') throw new ErrorValidacion('Datos del lugar inválidos');
    const categoria = texto(entrada.categoria, 20, 'categoria', true);
    if (!CATEGORIAS.includes(categoria)) throw new ErrorValidacion(`Categoría desconocida: ${categoria}`);

    const u = entrada.ubicacion ?? {};
    const latitud = coordenada(u.latitud, REGION.minLat, REGION.maxLat, 'latitud');
    const longitud = coordenada(u.longitud, REGION.minLon, REGION.maxLon, 'longitud');
    if ((latitud == null) !== (longitud == null)) throw new ErrorValidacion('Indica latitud y longitud juntas');
    let verificacion = texto(u.verificacion, 20, 'verificacion') ?? (latitud == null ? 'pendiente' : 'verificada');
    if (!VERIFICACIONES.includes(verificacion)) throw new ErrorValidacion(`Verificación desconocida: ${verificacion}`);
    if (latitud == null) verificacion = 'pendiente';

    const a = entrada.acceso ?? {};
    const dificultad = texto(a.dificultad, 20, 'dificultad');
    if (dificultad && !DIFICULTADES.includes(dificultad)) throw new ErrorValidacion(`Dificultad desconocida: ${dificultad}`);

    const altitud = entrada.altitud == null || entrada.altitud === '' ? undefined : Number(entrada.altitud);
    if (altitud != null && (!Number.isFinite(altitud) || altitud < 0 || altitud > 6000)) throw new ErrorValidacion('Altitud inválida');

    const fuentes = (entrada.fuentes ?? []).map((f, i) => ({
        nombre: texto(f?.nombre, 120, `fuentes[${i}].nombre`, true),
        url: url(f?.url, `fuentes[${i}].url`),
    }));
    const enlaces = (entrada.enlaces ?? []).map((f, i) => ({
        nombre: texto(f?.nombre, 120, `enlaces[${i}].nombre`, true),
        url: url(f?.url, `enlaces[${i}].url`) ?? '',
    }));

    return {
        id,
        nombre: texto(entrada.nombre, 120, 'nombre', true),
        categoria,
        tipo: texto(entrada.tipo, 80, 'tipo') ?? 'Punto de interés',
        destacado: entrada.destacado === true || undefined,
        altitud: altitud == null ? undefined : Math.round(altitud),
        descripcion: {
            general: texto(entrada.descripcion?.general, 2000, 'descripción general'),
            historia: texto(entrada.descripcion?.historia, 2000, 'historia'),
        },
        ubicacion: { latitud, longitud, descripcion: texto(u.descripcion, 300, 'descripción de la ubicación'), verificacion },
        acceso: { desde: texto(a.desde, 120, 'acceso desde'), tiempo: texto(a.tiempo, 120, 'tiempo de acceso'), dificultad },
        horario: texto(entrada.horario, 200, 'horario'),
        telefono: texto(entrada.telefono, 40, 'teléfono'),
        web: url(entrada.web, 'web'),
        imagen: url(entrada.imagen, 'imagen'),
        consejos: lista(entrada.consejos, 300, 'consejos'),
        datosCuriosos: lista(entrada.datosCuriosos, 300, 'datos curiosos'),
        enlaces: enlaces.length ? enlaces : undefined,
        fuentes: fuentes.length ? fuentes : undefined,
    };
}

function slug(nombre) {
    return nombre.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
        .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'lugar';
}

export async function listar() {
    return cargar();
}

export async function obtener(id) {
    const { lugares } = await cargar();
    return lugares.find((l) => l.id === id) ?? null;
}

export function crear(entrada) {
    return mutar((datos) => {
        const base = slug(String(entrada?.nombre ?? ''));
        let id = base;
        for (let i = 2; datos.lugares.some((l) => l.id === id); i++) id = `${base}-${i}`;
        const lugar = { ...validarLugar(entrada, id), actualizado: new Date().toISOString() };
        datos.lugares.push(lugar);
        return lugar;
    });
}

export function actualizar(id, entrada) {
    return mutar((datos) => {
        const i = datos.lugares.findIndex((l) => l.id === id);
        if (i < 0) return null;
        datos.lugares[i] = { ...validarLugar(entrada, id), actualizado: new Date().toISOString() };
        return datos.lugares[i];
    });
}

// Marca la ubicación tomada en sitio (por ejemplo con el GPS del celular del administrador)
export function fijarUbicacion(id, { latitud, longitud, precision }) {
    return mutar((datos) => {
        const lugar = datos.lugares.find((l) => l.id === id);
        if (!lugar) return null;
        const lat = coordenada(latitud, REGION.minLat, REGION.maxLat, 'latitud');
        const lon = coordenada(longitud, REGION.minLon, REGION.maxLon, 'longitud');
        if (lat == null || lon == null) throw new ErrorValidacion('Faltan latitud y longitud');
        const p = Number(precision);
        lugar.ubicacion = {
            ...lugar.ubicacion,
            latitud: lat,
            longitud: lon,
            verificacion: 'verificada',
            precision: Number.isFinite(p) ? Math.round(p) : undefined,
        };
        lugar.actualizado = new Date().toISOString();
        return lugar;
    });
}

export function eliminar(id) {
    return mutar((datos) => {
        const antes = datos.lugares.length;
        datos.lugares = datos.lugares.filter((l) => l.id !== id);
        return datos.lugares.length < antes;
    });
}
