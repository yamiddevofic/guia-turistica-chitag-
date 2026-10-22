// API de la guía turística (mismo esquema que PlantasQR: REST en /api, gestión con contraseña, QR por ficha)
import express from 'express';
import QRCode from 'qrcode';
import { createHash, timingSafeEqual } from 'node:crypto';
import { existsSync } from 'node:fs';
import * as almacen from './almacen.mjs';

const PUERTO = Number(process.env.PORT ?? 8787);
const HOST = process.env.HOST ?? '0.0.0.0';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? '';
const URL_PUBLICA = (process.env.PUBLIC_URL ?? 'http://127.0.0.1:5174').replace(/\/$/, '');
const DIST = new URL('../dist', import.meta.url).pathname;

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '200kb' }));

// --- Autenticación de administradores ---------------------------------------

const huella = (s) => createHash('sha256').update(String(s)).digest();
const intentos = new Map(); // ip -> { n, desde }

function limitarIntentos(req, res, next) {
    const ahora = Date.now();
    const r = intentos.get(req.ip) ?? { n: 0, desde: ahora };
    if (ahora - r.desde > 15 * 60_000) { r.n = 0; r.desde = ahora; }
    if (r.n >= 10) return res.status(429).json({ error: 'Demasiados intentos. Espera unos minutos.' });
    r.n++;
    intentos.set(req.ip, r);
    next();
}

function exigirAdmin(req, res, next) {
    if (!ADMIN_PASSWORD) return res.status(503).json({ error: 'La gestión está desactivada: define ADMIN_PASSWORD en el servidor.' });
    const clave = req.get('x-admin-password') ?? req.body?.password ?? '';
    if (!timingSafeEqual(huella(clave), huella(ADMIN_PASSWORD))) {
        return res.status(401).json({ error: 'Contraseña incorrecta' });
    }
    intentos.delete(req.ip);
    next();
}

app.post('/api/admin/verificar', limitarIntentos, exigirAdmin, (_req, res) => res.json({ ok: true }));

// --- Lugares --------------------------------------------------------------------

app.get('/api/lugares', async (_req, res) => {
    const datos = await almacen.listar();
    res.set('Cache-Control', 'no-cache').json(datos);
});

app.get('/api/lugares/:id', async (req, res) => {
    const lugar = await almacen.obtener(req.params.id);
    if (!lugar) return res.status(404).json({ error: 'Lugar no encontrado' });
    res.json(lugar);
});

app.post('/api/lugares', limitarIntentos, exigirAdmin, async (req, res) => {
    res.status(201).json(await almacen.crear(req.body.lugar));
});

app.put('/api/lugares/:id', limitarIntentos, exigirAdmin, async (req, res) => {
    const lugar = await almacen.actualizar(req.params.id, req.body.lugar);
    if (!lugar) return res.status(404).json({ error: 'Lugar no encontrado' });
    res.json(lugar);
});

app.patch('/api/lugares/:id/ubicacion', limitarIntentos, exigirAdmin, async (req, res) => {
    const lugar = await almacen.fijarUbicacion(req.params.id, req.body);
    if (!lugar) return res.status(404).json({ error: 'Lugar no encontrado' });
    res.json(lugar);
});

app.delete('/api/lugares/:id', limitarIntentos, exigirAdmin, async (req, res) => {
    const ok = await almacen.eliminar(req.params.id);
    if (!ok) return res.status(404).json({ error: 'Lugar no encontrado' });
    res.status(204).end();
});

// --- Códigos QR: cada placa abre la ficha del lugar ------------------------------

app.get('/api/qr/:id', async (req, res) => {
    const lugar = await almacen.obtener(req.params.id);
    if (!lugar) return res.status(404).json({ error: 'Lugar no encontrado' });
    const destino = `${URL_PUBLICA}/#/lugar/${encodeURIComponent(lugar.id)}`;
    const svg = await QRCode.toString(destino, { type: 'svg', errorCorrectionLevel: 'M', margin: 1, color: { dark: '#0f2a1f', light: '#ffffff' } });
    res.type('image/svg+xml').set('Cache-Control', 'public, max-age=86400').send(svg);
});

app.get('/api/configuracion/vista-mapa', (_req, res) => {
    res.json({ centro: [-72.664824, 7.138207], zoom: 14, municipio: 'https://www.openstreetmap.org/relation/1423503' });
});

// --- Errores y estáticos --------------------------------------------------------

app.use('/api', (_req, res) => res.status(404).json({ error: 'Ruta no encontrada' }));

app.use((err, _req, res, _next) => {
    if (err instanceof almacen.ErrorValidacion) return res.status(400).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: 'Error interno del servidor' });
});

if (existsSync(DIST)) {
    app.use(express.static(DIST, { index: false, maxAge: '1h' }));
    app.get(/^(?!\/api\/).*/, (_req, res) => res.sendFile(`${DIST}/index.html`));
}

app.listen(PUERTO, HOST, () => {
    console.log(`API en http://${HOST}:${PUERTO}`);
    if (!ADMIN_PASSWORD) console.warn('⚠ ADMIN_PASSWORD no definida: la gestión de lugares está desactivada.');
});
