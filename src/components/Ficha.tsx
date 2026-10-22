import { useState } from 'react';
import { ArrowLeft, Clock, Copy, ExternalLink, Footprints, Mountain, Navigation, Phone, QrCode, Share2, Compass } from 'lucide-react';
import { DIFICULTAD } from '../categorias';
import { coordenadas, distancia, formatoDistancia, puntoCardinal, rumbo } from '../lib/geo';
import { urlQr } from '../lib/api';
import { IconoCategoria, InsigniaVerificacion } from './Insignias';
import type { Lugar, Posicion } from '../tipos';

interface Props { lugar: Lugar; pos: Posicion | null }

export default function Ficha({ lugar, pos }: Props) {
    const [aviso, setAviso] = useState<string | null>(null);
    const [verQr, setVerQr] = useState(false);
    const c = coordenadas(lugar);
    const desdeYo = pos && c ? { d: distancia([pos.lon, pos.lat], c), r: rumbo([pos.lon, pos.lat], c) } : null;
    const enlace = `${location.origin}${location.pathname}#/lugar/${encodeURIComponent(lugar.id)}`;

    const avisar = (t: string) => { setAviso(t); setTimeout(() => setAviso(null), 2200); };
    const compartir = async () => {
        try {
            if (navigator.share) await navigator.share({ title: lugar.nombre, text: `${lugar.nombre} · Chitagá`, url: enlace });
            else { await navigator.clipboard.writeText(enlace); avisar('Enlace copiado'); }
        } catch { /* la persona canceló */ }
    };
    const copiarCoordenadas = async () => {
        if (!c) return;
        try { await navigator.clipboard.writeText(`${c[1].toFixed(6)}, ${c[0].toFixed(6)}`); avisar('Coordenadas copiadas'); } catch { /* sin permiso */ }
    };

    return (
        <article className="ficha" aria-labelledby="ficha-titulo">
            <a className="volver" href="#/"><ArrowLeft size={18} /> Explorar</a>

            {lugar.imagen && <img className="ficha_imagen" src={lugar.imagen} alt={lugar.nombre} loading="lazy" />}

            <header className="ficha_cabecera">
                <IconoCategoria categoria={lugar.categoria} tamano={22} />
                <div>
                    <h1 id="ficha-titulo">{lugar.nombre}</h1>
                    <p className="ficha_tipo">{lugar.tipo}</p>
                </div>
            </header>

            <InsigniaVerificacion v={lugar.ubicacion.verificacion} completa />

            <div className="acciones">
                {c ? (
                    <a className="boton boton--primario" href={`#/ruta/${encodeURIComponent(lugar.id)}`}><Navigation size={18} /> Cómo llegar</a>
                ) : (
                    <span className="boton boton--deshabilitado" aria-disabled="true"><Navigation size={18} /> Sin ruta disponible</span>
                )}
                <button className="boton" onClick={compartir}><Share2 size={18} /> Compartir</button>
                <button className="boton" onClick={() => setVerQr((v) => !v)} aria-expanded={verQr}><QrCode size={18} /> QR</button>
            </div>
            {aviso && <p className="toast" role="status">{aviso}</p>}
            {verQr && (
                <figure className="ficha_qr">
                    <img src={urlQr(lugar.id)} alt={`Código QR de ${lugar.nombre}`} width={180} height={180} />
                    <figcaption>Escanéalo para abrir esta ficha en otro celular.</figcaption>
                </figure>
            )}

            <dl className="datos">
                {desdeYo && (
                    <div><dt><Compass size={16} /> Desde ti</dt><dd>{formatoDistancia(desdeYo.d)} al {puntoCardinal(desdeYo.r)} <small>(en línea recta)</small></dd></div>
                )}
                {lugar.altitud != null && <div><dt><Mountain size={16} /> Altitud</dt><dd>{lugar.altitud.toLocaleString('es-CO')} m s. n. m.</dd></div>}
                {lugar.acceso?.desde && <div><dt><Footprints size={16} /> Acceso</dt><dd>Desde {lugar.acceso.desde}{lugar.acceso.tiempo ? ` · ${lugar.acceso.tiempo}` : ''}</dd></div>}
                {lugar.acceso?.dificultad && <div><dt>Dificultad</dt><dd><span className={`dificultad dificultad--${lugar.acceso.dificultad}`}>{DIFICULTAD[lugar.acceso.dificultad]}</span></dd></div>}
                {lugar.horario && <div><dt><Clock size={16} /> Horario</dt><dd>{lugar.horario}</dd></div>}
                {lugar.telefono && <div><dt><Phone size={16} /> Teléfono</dt><dd><a href={`tel:${lugar.telefono.replace(/\s/g, '')}`}>{lugar.telefono}</a></dd></div>}
                {lugar.ubicacion.descripcion && <div><dt>Ubicación</dt><dd>{lugar.ubicacion.descripcion}</dd></div>}
                {c && (
                    <div>
                        <dt>Coordenadas</dt>
                        <dd>
                            <button className="enlace-boton" onClick={copiarCoordenadas}>{c[1].toFixed(5)}, {c[0].toFixed(5)} <Copy size={14} /></button>
                            {lugar.ubicacion.precision != null && <small> · ±{lugar.ubicacion.precision} m</small>}
                        </dd>
                    </div>
                )}
            </dl>

            {lugar.descripcion?.general && <section><h2>Sobre el lugar</h2><p>{lugar.descripcion.general}</p></section>}
            {lugar.descripcion?.historia && <section><h2>Historia</h2><p>{lugar.descripcion.historia}</p></section>}
            {!!lugar.consejos?.length && (
                <section><h2>Antes de ir</h2><ul className="viñetas">{lugar.consejos.map((t) => <li key={t}>{t}</li>)}</ul></section>
            )}
            {!!lugar.datosCuriosos?.length && (
                <section><h2>Datos curiosos</h2><ul className="viñetas">{lugar.datosCuriosos.map((t) => <li key={t}>{t}</li>)}</ul></section>
            )}
            {(!!lugar.enlaces?.length || lugar.web) && (
                <section>
                    <h2>Enlaces</h2>
                    <ul className="enlaces">
                        {lugar.web && <li><a href={lugar.web} target="_blank" rel="noopener">Sitio web <ExternalLink size={14} /></a></li>}
                        {lugar.enlaces?.map((e) => <li key={e.nombre}><a href={e.url} target="_blank" rel="noopener">{e.nombre} <ExternalLink size={14} /></a></li>)}
                    </ul>
                </section>
            )}
            {!!lugar.fuentes?.length && (
                <section className="fuentes">
                    <h2>Fuentes</h2>
                    <ul>
                        {lugar.fuentes.map((f) => (
                            <li key={f.nombre + f.url}>{f.url ? <a href={f.url} target="_blank" rel="noopener">{f.nombre} <ExternalLink size={12} /></a> : f.nombre}</li>
                        ))}
                    </ul>
                    {lugar.actualizado && <p>Actualizado el {new Date(lugar.actualizado).toLocaleDateString('es-CO', { dateStyle: 'long' })}.</p>}
                </section>
            )}
        </article>
    );
}
