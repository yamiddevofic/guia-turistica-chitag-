import { useMemo, useState } from 'react';
import { ArrowLeft, Crosshair, LogOut, Pencil, Plus, Printer, Save, Search, Trash2 } from 'lucide-react';
import { CATEGORIAS, DIFICULTAD, VERIFICACION } from '../categorias';
import * as api from '../lib/api';
import { ir } from '../hooks/useRutaHash';
import { IconoCategoria, InsigniaVerificacion } from './Insignias';
import type { Dificultad, Lugar, Posicion, Verificacion } from '../tipos';

interface Props {
    lugares: Lugar[];
    idEditando: string | null;
    pos: Posicion | null;
    onIniciarGps: () => void;
    onCambio: () => void;
}

// --- Formulario (texto plano para que sea fácil de llenar desde el celular) -----

interface Form {
    nombre: string; categoria: string; tipo: string; destacado: boolean; altitud: string;
    general: string; historia: string;
    latitud: string; longitud: string; ubicacionDescripcion: string; verificacion: Verificacion;
    accesoDesde: string; accesoTiempo: string; dificultad: string;
    horario: string; telefono: string; web: string; imagen: string;
    consejos: string; datosCuriosos: string; fuentes: string;
}

const lineas = (t: string) => t.split('\n').map((s) => s.trim()).filter(Boolean);

function aForm(l?: Lugar): Form {
    return {
        nombre: l?.nombre ?? '', categoria: l?.categoria ?? 'turismo', tipo: l?.tipo ?? '', destacado: !!l?.destacado,
        altitud: l?.altitud?.toString() ?? '',
        general: l?.descripcion?.general ?? '', historia: l?.descripcion?.historia ?? '',
        latitud: l?.ubicacion.latitud?.toString() ?? '', longitud: l?.ubicacion.longitud?.toString() ?? '',
        ubicacionDescripcion: l?.ubicacion.descripcion ?? '', verificacion: l?.ubicacion.verificacion ?? 'pendiente',
        accesoDesde: l?.acceso?.desde ?? '', accesoTiempo: l?.acceso?.tiempo ?? '', dificultad: l?.acceso?.dificultad ?? '',
        horario: l?.horario ?? '', telefono: l?.telefono ?? '', web: l?.web ?? '', imagen: l?.imagen ?? '',
        consejos: (l?.consejos ?? []).join('\n'), datosCuriosos: (l?.datosCuriosos ?? []).join('\n'),
        // Una fuente por línea: "Nombre | https://url"
        fuentes: (l?.fuentes ?? []).map((f) => (f.url ? `${f.nombre} | ${f.url}` : f.nombre)).join('\n'),
    };
}

function desdeForm(f: Form, original?: Lugar): Partial<Lugar> {
    return {
        nombre: f.nombre, categoria: f.categoria as Lugar['categoria'], tipo: f.tipo, destacado: f.destacado,
        altitud: f.altitud ? Number(f.altitud) : undefined,
        descripcion: { general: f.general, historia: f.historia },
        ubicacion: {
            latitud: f.latitud ? Number(f.latitud) : undefined,
            longitud: f.longitud ? Number(f.longitud) : undefined,
            descripcion: f.ubicacionDescripcion,
            verificacion: f.verificacion,
        },
        acceso: { desde: f.accesoDesde, tiempo: f.accesoTiempo, dificultad: (f.dificultad || undefined) as Dificultad | undefined },
        horario: f.horario, telefono: f.telefono, web: f.web, imagen: f.imagen,
        consejos: lineas(f.consejos), datosCuriosos: lineas(f.datosCuriosos),
        fuentes: lineas(f.fuentes).map((s) => {
            const [nombre, url] = s.split('|').map((x) => x.trim());
            return { nombre, url: url || undefined };
        }),
        enlaces: original?.enlaces,
    };
}

function Campo({ etiqueta, children, ayuda }: { etiqueta: string; children: React.ReactNode; ayuda?: string }) {
    return <label className="campo"><span>{etiqueta}</span>{children}{ayuda && <small>{ayuda}</small>}</label>;
}

function Formulario({ lugar, pos, onIniciarGps, onGuardado }: { lugar?: Lugar; pos: Posicion | null; onIniciarGps: () => void; onGuardado: (l: Lugar) => void }) {
    const [f, setF] = useState(() => aForm(lugar));
    const [guardando, setGuardando] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const set = <K extends keyof Form>(k: K) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
        setF((x) => ({ ...x, [k]: e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value }));

    const usarGps = () => {
        if (!pos) return onIniciarGps();
        setF((x) => ({ ...x, latitud: pos.lat.toFixed(6), longitud: pos.lon.toFixed(6), verificacion: 'verificada' }));
    };

    const guardar = async (e: React.FormEvent) => {
        e.preventDefault();
        setGuardando(true);
        setError(null);
        try {
            const datos = desdeForm(f, lugar);
            onGuardado(lugar ? await api.actualizarLugar(lugar.id, datos) : await api.crearLugar(datos));
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setGuardando(false);
        }
    };

    return (
        <form className="formulario" onSubmit={guardar}>
            <fieldset>
                <legend>Identificación</legend>
                <Campo etiqueta="Nombre *"><input required maxLength={120} value={f.nombre} onChange={set('nombre')} /></Campo>
                <div className="fila-campos">
                    <Campo etiqueta="Categoría *">
                        <select value={f.categoria} onChange={set('categoria')}>
                            {CATEGORIAS.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                        </select>
                    </Campo>
                    <Campo etiqueta="Tipo"><input maxLength={80} value={f.tipo} onChange={set('tipo')} placeholder="Ej: Restaurante, Mirador" /></Campo>
                </div>
                <label className="check"><input type="checkbox" checked={f.destacado} onChange={set('destacado')} /> Destacado en el mapa</label>
            </fieldset>

            <fieldset>
                <legend>Ubicación</legend>
                <div className="fila-campos">
                    <Campo etiqueta="Latitud"><input inputMode="decimal" value={f.latitud} onChange={set('latitud')} placeholder="7.138207" /></Campo>
                    <Campo etiqueta="Longitud"><input inputMode="decimal" value={f.longitud} onChange={set('longitud')} placeholder="-72.664824" /></Campo>
                </div>
                <button type="button" className="boton" onClick={usarGps}>
                    <Crosshair size={18} /> {pos ? `Usar mi posición actual (±${Math.round(pos.precision)} m)` : 'Activar GPS'}
                </button>
                {pos && pos.precision > 25 && <p className="alerta">La precisión es baja. Espera a cielo abierto antes de guardar.</p>}
                <Campo etiqueta="Confiabilidad">
                    <select value={f.verificacion} onChange={set('verificacion')}>
                        {(Object.keys(VERIFICACION) as Verificacion[]).map((v) => <option key={v} value={v}>{VERIFICACION[v].texto}</option>)}
                    </select>
                </Campo>
                <Campo etiqueta="Referencia"><input maxLength={300} value={f.ubicacionDescripcion} onChange={set('ubicacionDescripcion')} placeholder="Ej: Calle 5 con carrera 4, frente al parque" /></Campo>
                <div className="fila-campos">
                    <Campo etiqueta="Altitud (m)"><input inputMode="numeric" value={f.altitud} onChange={set('altitud')} /></Campo>
                    <Campo etiqueta="Dificultad">
                        <select value={f.dificultad} onChange={set('dificultad')}>
                            <option value="">—</option>
                            {Object.entries(DIFICULTAD).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                        </select>
                    </Campo>
                </div>
                <div className="fila-campos">
                    <Campo etiqueta="Acceso desde"><input value={f.accesoDesde} onChange={set('accesoDesde')} /></Campo>
                    <Campo etiqueta="Tiempo de acceso"><input value={f.accesoTiempo} onChange={set('accesoTiempo')} /></Campo>
                </div>
            </fieldset>

            <fieldset>
                <legend>Contenido</legend>
                <Campo etiqueta="Descripción"><textarea rows={4} maxLength={2000} value={f.general} onChange={set('general')} /></Campo>
                <Campo etiqueta="Historia"><textarea rows={3} maxLength={2000} value={f.historia} onChange={set('historia')} /></Campo>
                <Campo etiqueta="Consejos" ayuda="Uno por línea"><textarea rows={3} value={f.consejos} onChange={set('consejos')} /></Campo>
                <Campo etiqueta="Datos curiosos" ayuda="Uno por línea"><textarea rows={2} value={f.datosCuriosos} onChange={set('datosCuriosos')} /></Campo>
            </fieldset>

            <fieldset>
                <legend>Contacto y fuentes</legend>
                <div className="fila-campos">
                    <Campo etiqueta="Horario"><input value={f.horario} onChange={set('horario')} placeholder="Lun–Sáb 7:00–19:00" /></Campo>
                    <Campo etiqueta="Teléfono"><input inputMode="tel" value={f.telefono} onChange={set('telefono')} /></Campo>
                </div>
                <Campo etiqueta="Sitio web"><input type="url" value={f.web} onChange={set('web')} placeholder="https://" /></Campo>
                <Campo etiqueta="Imagen (URL)"><input type="url" value={f.imagen} onChange={set('imagen')} placeholder="https://" /></Campo>
                <Campo etiqueta="Fuentes" ayuda='Una por línea: "Nombre | https://enlace"'><textarea rows={3} value={f.fuentes} onChange={set('fuentes')} /></Campo>
            </fieldset>

            {error && <p className="alerta" role="alert">{error}</p>}
            <div className="acciones acciones--fijas">
                <button className="boton boton--primario" disabled={guardando}><Save size={18} /> {guardando ? 'Guardando…' : 'Guardar'}</button>
                <a className="boton" href="#/admin">Cancelar</a>
            </div>
        </form>
    );
}

// --- Acceso ------------------------------------------------------------------

function Acceso({ onEntrar }: { onEntrar: () => void }) {
    const [clave, setClave] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [enviando, setEnviando] = useState(false);
    const entrar = async (e: React.FormEvent) => {
        e.preventDefault();
        setEnviando(true);
        setError(null);
        try { await api.verificarAdmin(clave); onEntrar(); } catch (err) { setError((err as Error).message); } finally { setEnviando(false); }
    };
    return (
        <form className="formulario formulario--acceso" onSubmit={entrar}>
            <h1>Gestión de lugares</h1>
            <p>Solo para administradores de la guía.</p>
            <Campo etiqueta="Contraseña"><input type="password" autoComplete="current-password" required value={clave} onChange={(e) => setClave(e.target.value)} /></Campo>
            {error && <p className="alerta" role="alert">{error}</p>}
            <button className="boton boton--primario" disabled={enviando}>{enviando ? 'Verificando…' : 'Entrar'}</button>
        </form>
    );
}

// --- Panel -------------------------------------------------------------------

export default function Admin({ lugares, idEditando, pos, onIniciarGps, onCambio }: Props) {
    const [dentro, setDentro] = useState(() => !!api.claveAdmin());
    const [filtro, setFiltro] = useState<'todos' | 'pendiente' | 'aproximada'>('todos');
    const [q, setQ] = useState('');
    const [mensaje, setMensaje] = useState<string | null>(null);

    const lista = useMemo(() => lugares
        .filter((l) => filtro === 'todos' || l.ubicacion.verificacion === filtro)
        .filter((l) => !q || l.nombre.toLowerCase().includes(q.toLowerCase()))
        .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')), [lugares, filtro, q]);

    if (!dentro) return <div className="admin"><a className="volver" href="#/"><ArrowLeft size={18} /> Volver al mapa</a><Acceso onEntrar={() => setDentro(true)} /></div>;

    const editando = idEditando && idEditando !== 'nuevo' ? lugares.find((l) => l.id === idEditando) : undefined;
    if (idEditando) {
        return (
            <div className="admin">
                <a className="volver" href="#/admin"><ArrowLeft size={18} /> Lugares</a>
                <h1>{editando ? `Editar: ${editando.nombre}` : 'Nuevo lugar'}</h1>
                <Formulario
                    key={idEditando}
                    lugar={editando}
                    pos={pos}
                    onIniciarGps={onIniciarGps}
                    onGuardado={(l) => { onCambio(); ir(`#/lugar/${encodeURIComponent(l.id)}`); }}
                />
            </div>
        );
    }

    const borrar = async (l: Lugar) => {
        if (!confirm(`¿Eliminar "${l.nombre}"? Esta acción no se puede deshacer.`)) return;
        try { await api.eliminarLugar(l.id); onCambio(); setMensaje(`"${l.nombre}" eliminado`); } catch (e) { setMensaje((e as Error).message); }
    };

    const fijarAqui = async (l: Lugar) => {
        if (!pos) return onIniciarGps();
        if (!confirm(`¿Guardar tu posición actual (±${Math.round(pos.precision)} m) como ubicación verificada de "${l.nombre}"?`)) return;
        try { await api.fijarUbicacion(l.id, pos.lat, pos.lon, pos.precision); onCambio(); setMensaje(`Ubicación de "${l.nombre}" verificada`); } catch (e) { setMensaje((e as Error).message); }
    };

    const pendientes = lugares.filter((l) => l.ubicacion.verificacion === 'pendiente').length;

    return (
        <div className="admin">
            <div className="admin_barra">
                <a className="volver" href="#/"><ArrowLeft size={18} /> Mapa</a>
                <button className="enlace-boton" onClick={() => { api.cerrarAdmin(); setDentro(false); }}><LogOut size={16} /> Salir</button>
            </div>
            <h1>Gestión de lugares</h1>
            <p>{lugares.length} lugares · {pendientes} sin ubicación confirmada</p>
            <div className="acciones">
                <a className="boton boton--primario" href="#/admin/nuevo"><Plus size={18} /> Nuevo lugar</a>
                <a className="boton" href="#/placas"><Printer size={18} /> Placas QR</a>
            </div>
            {mensaje && <p className="toast" role="status">{mensaje}</p>}

            <div className="admin_filtros">
                <label className="buscador"><Search size={16} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar" aria-label="Buscar lugar" /></label>
                <select value={filtro} onChange={(e) => setFiltro(e.target.value as typeof filtro)} aria-label="Filtrar por confiabilidad">
                    <option value="todos">Todos</option>
                    <option value="pendiente">Por confirmar</option>
                    <option value="aproximada">Aproximados</option>
                </select>
            </div>

            <ul className="lista">
                {lista.map((l) => (
                    <li key={l.id} className="fila fila--admin">
                        <IconoCategoria categoria={l.categoria} />
                        <span className="fila_texto">
                            <strong>{l.nombre}</strong>
                            <span>{l.tipo}</span>
                            <InsigniaVerificacion v={l.ubicacion.verificacion} />
                        </span>
                        <span className="fila_acciones">
                            <button className="boton-icono" title="Fijar con mi GPS" aria-label={`Fijar ubicación de ${l.nombre} con mi GPS`} onClick={() => fijarAqui(l)}><Crosshair size={18} /></button>
                            <a className="boton-icono" title="Editar" aria-label={`Editar ${l.nombre}`} href={`#/admin/${encodeURIComponent(l.id)}`}><Pencil size={18} /></a>
                            <button className="boton-icono boton-icono--peligro" title="Eliminar" aria-label={`Eliminar ${l.nombre}`} onClick={() => borrar(l)}><Trash2 size={18} /></button>
                        </span>
                    </li>
                ))}
            </ul>
        </div>
    );
}
