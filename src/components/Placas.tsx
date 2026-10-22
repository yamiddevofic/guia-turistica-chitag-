import { ArrowLeft, Printer } from 'lucide-react';
import { CATEGORIA } from '../categorias';
import { urlQr } from '../lib/api';
import type { Lugar } from '../tipos';

/** Hoja imprimible con una placa QR por lugar (como las placas de los árboles en PlantasQR). */
export default function Placas({ lugares }: { lugares: Lugar[] }) {
    const imprimibles = lugares
        .filter((l) => l.categoria === 'turismo' || l.categoria === 'naturaleza' || l.destacado)
        .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
    return (
        <div className="placas">
            <div className="placas_barra no-imprimir">
                <a className="volver" href="#/admin"><ArrowLeft size={18} /> Gestión</a>
                <button className="boton boton--primario" onClick={() => print()}><Printer size={18} /> Imprimir</button>
            </div>
            <p className="no-imprimir">{imprimibles.length} placas de lugares turísticos y naturales. Cada código abre la ficha del lugar.</p>
            <div className="placas_grilla">
                {imprimibles.map((l) => (
                    <figure key={l.id} className="placa" style={{ '--color': CATEGORIA[l.categoria].color } as React.CSSProperties}>
                        <img src={urlQr(l.id)} alt="" width={150} height={150} />
                        <figcaption>
                            <strong>{l.nombre}</strong>
                            <span>{l.tipo}</span>
                            <small>Guía Turística de Chitagá · Escanea para ver la ficha y cómo llegar</small>
                        </figcaption>
                    </figure>
                ))}
            </div>
        </div>
    );
}
