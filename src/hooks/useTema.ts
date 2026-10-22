import { useEffect, useState } from 'react';

export type Tema = 'claro' | 'oscuro';
const CLAVE = 'chitaga-tema';

function inicial(): Tema {
    try {
        const t = localStorage.getItem(CLAVE);
        if (t === 'claro' || t === 'oscuro') return t;
    } catch { /* sin almacenamiento */ }
    return matchMedia('(prefers-color-scheme: dark)').matches ? 'oscuro' : 'claro';
}

export function useTema() {
    const [tema, setTema] = useState<Tema>(inicial);
    useEffect(() => {
        document.documentElement.dataset.tema = tema;
        document.querySelector('meta[name=theme-color]')?.setAttribute('content', tema === 'oscuro' ? '#0f1612' : '#173f2f');
        try { localStorage.setItem(CLAVE, tema); } catch { /* sin almacenamiento */ }
    }, [tema]);
    return { tema, alternar: () => setTema((t) => (t === 'claro' ? 'oscuro' : 'claro')) };
}
