import { ArrowUp, CornerUpLeft, CornerUpRight, Flag, MoveUpLeft, MoveUpRight, Navigation, RotateCcw, RefreshCw, Split } from 'lucide-react';

export default function IconoManiobra({ tipo, modificador, tamano = 20 }: { tipo: string; modificador?: string; tamano?: number }) {
    let Icono = ArrowUp;
    if (tipo === 'depart') Icono = Navigation;
    else if (tipo === 'arrive') Icono = Flag;
    else if (tipo.includes('roundabout') || tipo.includes('rotary')) Icono = RefreshCw;
    else if (tipo === 'fork') Icono = Split;
    else if (modificador === 'uturn') Icono = RotateCcw;
    else if (modificador === 'left' || modificador === 'sharp left') Icono = CornerUpLeft;
    else if (modificador === 'right' || modificador === 'sharp right') Icono = CornerUpRight;
    else if (modificador === 'slight left') Icono = MoveUpLeft;
    else if (modificador === 'slight right') Icono = MoveUpRight;
    return <span className="maniobra" aria-hidden="true"><Icono size={tamano} /></span>;
}
