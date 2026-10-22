import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
    plugins: [
        react(),
        VitePWA({
            registerType: 'autoUpdate',
            includeAssets: ['icono.svg'],
            manifest: {
                name: 'Guía Turística de Chitagá',
                short_name: 'Chitagá',
                description: 'Tu ubicación, los lugares de Chitagá y la ruta para llegar. Funciona también sin conexión.',
                lang: 'es-CO',
                start_url: '/',
                scope: '/',
                display: 'standalone',
                background_color: '#0f1612',
                theme_color: '#173f2f',
                icons: [{ src: '/icono.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }],
            },
            workbox: {
                navigateFallbackDenylist: [/^\/api\//],
                runtimeCaching: [
                    // Catálogo: se sirve rápido desde caché y se actualiza en segundo plano
                    { urlPattern: /\/api\/lugares/, handler: 'StaleWhileRevalidate', options: { cacheName: 'chitaga-api-v1' } },
                    // Mapa base: lo ya visto queda disponible sin señal (útil en el páramo)
                    {
                        urlPattern: /^https:\/\/tiles\.openfreemap\.org\//,
                        handler: 'CacheFirst',
                        options: { cacheName: 'chitaga-mapa-v1', expiration: { maxEntries: 3000, maxAgeSeconds: 60 * 60 * 24 * 30 } },
                    },
                    {
                        urlPattern: /^https:\/\/server\.arcgisonline\.com\//,
                        handler: 'CacheFirst',
                        options: { cacheName: 'chitaga-satelite-v1', expiration: { maxEntries: 1500, maxAgeSeconds: 60 * 60 * 24 * 30 } },
                    },
                ],
            },
        }),
    ],
    worker: { format: 'es' },
    server: { proxy: { '/api': 'http://127.0.0.1:8787' } },
    preview: { proxy: { '/api': 'http://127.0.0.1:8787' } },
});
