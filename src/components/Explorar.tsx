import { useMemo } from 'react';
import { Search, X } from 'lucide-react';
import { CATEGORIAS } from '../categorias';
import { coordenadas, distancia, formatoDistancia } from '../lib/geo';
import { ir } from '../hooks/useRutaHash';
import { IconoCategoria, InsigniaVerificacion } from './Insignias';
import type { Categoria, LngLat, Lugar } from '../tipos';

interface Props {
    lugares: Lugar[];
    categoria: Categoria | null;
    q: string;
    referencia: { punto: LngLat; esUsuario: boolean };
}

const normalizar = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

function hash(categoria: string | null, q: string) {
    const p = new URLSearchParams();
    if (categoria) p.set('categoria', categoria);
    if (q) p.set('q', q);
    const s = p.toString();
    return s ? `#/?${s}` : '#/';
}

// Al escribir no se agrega una entrada al historial por cada tecla
function reemplazar(nuevo: string) {
    history.replaceState(null, '', nuevo);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
}

export default function Explorar({ lugares, categoria, q, referencia }: Props) {
    const conteo = useMemo(() => {
        const c: Partial<Record<Categoria, number>> = {};
        for (const l of lugares) c[l.categoria] = (c[l.categoria] ?? 0) + 1;
        return c;
    }, [lugares]);

    const resultados = useMemo(() => {
        const t = normalizar(q.trim());
        return lugares
            .filter((l) => !categoria || l.categoria === categoria)
            .filter((l) => !t || normalizar(`${l.nombre} ${l.tipo} ${l.descripcion?.general ?? ''}`).includes(t))
            .map((l) => {
                const c = coordenadas(l);
                return { l, d: c ? distancia(referencia.punto, c) : Infinity };
            })
            // Destacados primero cuando no hay filtro; luego por cercanía
            .sort((a, b) => (!categoria && !t ? Number(!!b.l.destacado) - Number(!!a.l.destacado) : 0) || a.d - b.d);
    }, [lugares, categoria, q, referencia.punto]);

    return (
        <div className="explorar">
            <form className="buscador" role="search" onSubmit={(e) => e.preventDefault()}>
                <Search size={18} aria-hidden="true" />
                <input
                    type="search"
                    value={q}
                    placeholder="Buscar en Chitagá"
                    aria-label="Buscar un lugar por nombre o tipo"
                    onChange={(e) => reemplazar(hash(categoria, e.target.value))}
                />
                {q && <button type="button" className="boton-icono" aria-label="Borrar búsqueda" onClick={() => ir(hash(categoria, ''))}><X size={18} /></button>}
            </form>

            <div className="chips" role="tablist" aria-label="Categorías">
                {CATEGORIAS.filter((c) => conteo[c.id]).map((c) => (
                    <button
                        key={c.id}
                        role="tab"
                        aria-selected={categoria === c.id}
                        className="chip"
                        style={{ '--color': c.color } as React.CSSProperties}
                        onClick={() => ir(hash(categoria === c.id ? null : c.id, q))}
                    >
                        <c.Icono size={15} aria-hidden="true" />
                        {c.nombre}
                        <span className="chip_n">{conteo[c.id]}</span>
                    </button>
                ))}
            </div>

            <p className="explorar_resumen" aria-live="polite">
                {resultados.length} {resultados.length === 1 ? 'lugar' : 'lugares'}
                {' · '}distancias desde {referencia.esUsuario ? 'tu ubicación' : 'el Parque Principal'}
            </p>

            <ul className="lista">
                {resultados.map(({ l, d }) => (
                    <li key={l.id}>
                        <a className="fila" href={`#/lugar/${encodeURIComponent(l.id)}`}>
                            <IconoCategoria categoria={l.categoria} />
                            <span className="fila_texto">
                                <strong>{l.nombre}</strong>
                                <span>{l.tipo}{l.altitud ? ` · ${l.altitud.toLocaleString('es-CO')} m` : ''}</span>
                                {(l.ubicacion.verificacion === 'pendiente' || l.ubicacion.verificacion === 'aproximada') && (
                                    <InsigniaVerificacion v={l.ubicacion.verificacion} />
                                )}
                            </span>
                            <span className="fila_dist">{Number.isFinite(d) ? formatoDistancia(d) : '—'}</span>
                        </a>
                    </li>
                ))}
            </ul>
            {!resultados.length && <p className="vacio">No encontramos lugares con ese criterio.</p>}
        </div>
    );
}
