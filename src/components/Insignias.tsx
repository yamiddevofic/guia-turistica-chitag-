import { BadgeCheck, CircleDashed, Info, TriangleAlert } from 'lucide-react';
import { CATEGORIA, VERIFICACION } from '../categorias';
import type { Categoria, Verificacion } from '../tipos';

export function IconoCategoria({ categoria, tamano = 18 }: { categoria: Categoria; tamano?: number }) {
    const { Icono, color } = CATEGORIA[categoria];
    return (
        <span className="icono-cat" style={{ background: color }} aria-hidden="true">
            <Icono size={tamano} strokeWidth={2.2} />
        </span>
    );
}

const ICONOS = { ok: BadgeCheck, info: Info, aviso: TriangleAlert, pendiente: CircleDashed };

export function InsigniaVerificacion({ v, completa = false }: { v: Verificacion; completa?: boolean }) {
    const info = VERIFICACION[v];
    const Icono = ICONOS[info.tono];
    return (
        <span className={`insignia insignia--${info.tono}`} title={info.detalle}>
            <Icono size={14} aria-hidden="true" />
            {info.texto}
            {completa && <span className="insignia_detalle"> · {info.detalle}</span>}
        </span>
    );
}
