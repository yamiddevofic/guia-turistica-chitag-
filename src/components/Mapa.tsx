import { useEffect, useRef } from 'react';
import * as maplibregl from 'maplibre-gl';
import type { GeoJSONSource, Map as MapaLibre } from 'maplibre-gl';
import type { Feature } from 'geojson';
import 'maplibre-gl/dist/maplibre-gl.css';
// MapLibre 6 carga su worker como módulo aparte; Vite lo empaqueta y nos da la URL
import urlWorker from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import { CATEGORIAS } from '../categorias';
import { circulo, coordenadas } from '../lib/geo';
import type { Ruta } from '../lib/rutas';
import type { LngLat, Lugar, Posicion } from '../tipos';

export type Capa = 'mapa' | 'satelite';
export type Seguimiento = 'libre' | 'centrar' | 'navegar';

interface Props {
    lugares: Lugar[];
    seleccionado: Lugar | null;
    ruta: Ruta | null;
    pos: Posicion | null;
    capa: Capa;
    seguimiento: Seguimiento;
    /** Espacio que ocupa el panel, para encuadrar sin quedar debajo de él */
    margen: { left: number; bottom: number };
    onSeleccionar: (id: string) => void;
    onMoverManual: () => void;
}

maplibregl.setWorkerUrl(urlWorker);

const CENTRO: LngLat = [-72.664824, 7.138207];
const ESTILO = 'https://tiles.openfreemap.org/styles/liberty';
const vacio = { type: 'FeatureCollection' as const, features: [] };

const colorPorCategoria = ['match', ['get', 'categoria'], ...CATEGORIAS.flatMap((c) => [c.id, c.color]), '#5b6b66'];

export default function Mapa({ lugares, seleccionado, ruta, pos, capa, seguimiento, margen, onSeleccionar, onMoverManual }: Props) {
    const contenedor = useRef<HTMLDivElement>(null);
    const mapa = useRef<MapaLibre | null>(null);
    const listo = useRef(false);
    const marcadorYo = useRef<maplibregl.Marker | null>(null);
    const marcadorDestino = useRef<maplibregl.Marker | null>(null);
    const callbacks = useRef({ onSeleccionar, onMoverManual });
    callbacks.current = { onSeleccionar, onMoverManual };
    const pendiente = useRef<() => void>(() => {});

    // --- Creación del mapa -----------------------------------------------------
    useEffect(() => {
        const m = new maplibregl.Map({
            container: contenedor.current!,
            style: ESTILO,
            center: CENTRO,
            zoom: 14,
            maxPitch: 65,
            attributionControl: { compact: true },
        });
        mapa.current = m;
        m.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'bottom-right');
        m.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-left');

        m.on('load', () => {
            const primeraEtiqueta = m.getStyle().layers.find((l) => l.type === 'symbol')?.id;

            // Satélite (mismo proveedor que usa PlantasQR), debajo de las etiquetas
            m.addSource('satelite', {
                type: 'raster',
                tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
                tileSize: 256,
                maxzoom: 19,
                attribution: 'Imágenes © Esri, Maxar, Earthstar Geographics',
            });
            m.addLayer({ id: 'satelite', type: 'raster', source: 'satelite', layout: { visibility: 'none' } }, primeraEtiqueta);

            m.addSource('precision', { type: 'geojson', data: vacio });
            m.addLayer({ id: 'precision', type: 'fill', source: 'precision', paint: { 'fill-color': '#1a73e8', 'fill-opacity': 0.12 } });
            m.addLayer({ id: 'precision-borde', type: 'line', source: 'precision', paint: { 'line-color': '#1a73e8', 'line-opacity': 0.35, 'line-width': 1 } });

            m.addSource('ruta', { type: 'geojson', data: vacio });
            m.addLayer({
                id: 'ruta-borde', type: 'line', source: 'ruta', filter: ['==', ['get', 'parte'], 'via'],
                layout: { 'line-cap': 'round', 'line-join': 'round' },
                paint: { 'line-color': '#0b3d91', 'line-width': ['interpolate', ['linear'], ['zoom'], 10, 6, 17, 13] },
            });
            m.addLayer({
                id: 'ruta', type: 'line', source: 'ruta', filter: ['==', ['get', 'parte'], 'via'],
                layout: { 'line-cap': 'round', 'line-join': 'round' },
                paint: { 'line-color': '#1a73e8', 'line-width': ['interpolate', ['linear'], ['zoom'], 10, 4, 17, 9] },
            });
            // Tramos sin camino mapeado: punteado gris, como un sendero a ojo
            m.addLayer({
                id: 'ruta-brecha', type: 'line', source: 'ruta', filter: ['==', ['get', 'parte'], 'brecha'],
                layout: { 'line-cap': 'round' },
                paint: { 'line-color': '#5f6368', 'line-width': 3, 'line-dasharray': [0.5, 2] },
            });

            m.addSource('lugares', { type: 'geojson', data: vacio });
            m.addLayer({
                id: 'lugares', type: 'circle', source: 'lugares',
                paint: {
                    'circle-color': colorPorCategoria as never,
                    'circle-radius': ['interpolate', ['linear'], ['zoom'], 9, ['case', ['get', 'destacado'], 6, 3.5], 15, ['case', ['get', 'destacado'], 11, 8]],
                    'circle-stroke-color': '#ffffff',
                    'circle-stroke-width': ['case', ['get', 'aproximada'], 1, 2],
                    'circle-opacity': ['case', ['get', 'aproximada'], 0.75, 1],
                },
            });
            m.addLayer({
                id: 'lugares-nombre', type: 'symbol', source: 'lugares',
                filter: ['any', ['get', 'destacado'], ['>=', ['zoom'], 15]],
                layout: {
                    'text-field': ['get', 'nombre'],
                    'text-font': ['Noto Sans Regular'],
                    'text-size': ['case', ['get', 'destacado'], 13, 11.5],
                    'text-offset': [0, 1.2],
                    'text-anchor': 'top',
                    'text-max-width': 9,
                    'text-optional': true,
                },
                paint: { 'text-color': '#1d2b24', 'text-halo-color': '#ffffff', 'text-halo-width': 1.6 },
            });

            m.on('click', 'lugares', (e) => {
                const id = e.features?.[0]?.properties?.id;
                if (id) callbacks.current.onSeleccionar(String(id));
            });
            m.on('mouseenter', 'lugares', () => { m.getCanvas().style.cursor = 'pointer'; });
            m.on('mouseleave', 'lugares', () => { m.getCanvas().style.cursor = ''; });

            listo.current = true;
            pendiente.current();
        });

        // Algunos íconos del estilo base no vienen en su sprite: se reemplazan por uno transparente
        m.on('styleimagemissing', (e) => {
            if (!m.hasImage(e.id)) m.addImage(e.id, { width: 1, height: 1, data: new Uint8Array(4) });
        });

        // Si la persona arrastra el mapa, se deja de seguir su posición (como en Google Maps)
        m.on('dragstart', (e) => { if ((e as { originalEvent?: Event }).originalEvent) callbacks.current.onMoverManual(); });

        return () => {
            listo.current = false;
            m.remove();
            mapa.current = null;
        };
    }, []);

    // Ejecuta cuando el estilo esté cargado
    const conMapa = (fn: (m: MapaLibre) => void) => {
        const m = mapa.current;
        if (!m) return;
        if (listo.current) fn(m);
        else {
            const previo = pendiente.current;
            pendiente.current = () => { previo(); fn(m); };
        }
    };

    // --- Capa base ---------------------------------------------------------------
    useEffect(() => {
        conMapa((m) => m.setLayoutProperty('satelite', 'visibility', capa === 'satelite' ? 'visible' : 'none'));
    }, [capa]);

    // --- Lugares -----------------------------------------------------------------
    useEffect(() => {
        conMapa((m) => {
            const features = lugares.flatMap((l) => {
                const c = coordenadas(l);
                if (!c) return [];
                return [{
                    type: 'Feature' as const,
                    geometry: { type: 'Point' as const, coordinates: c },
                    properties: {
                        id: l.id,
                        nombre: l.sinNombre ? '' : l.nombre,
                        categoria: l.categoria,
                        destacado: !!l.destacado,
                        aproximada: l.ubicacion.verificacion === 'aproximada',
                    },
                }];
            });
            (m.getSource('lugares') as GeoJSONSource).setData({ type: 'FeatureCollection', features });
        });
    }, [lugares]);

    // --- Destino seleccionado -------------------------------------------------------
    useEffect(() => {
        conMapa((m) => {
            marcadorDestino.current?.remove();
            marcadorDestino.current = null;
            const c = seleccionado && coordenadas(seleccionado);
            if (!c) return;
            const el = document.createElement('div');
            el.className = 'pin-destino';
            el.style.setProperty('--color', CATEGORIAS.find((x) => x.id === seleccionado.categoria)?.color ?? '#d6342f');
            marcadorDestino.current = new maplibregl.Marker({ element: el, anchor: 'bottom' }).setLngLat(c).addTo(m);
            if (!ruta && seguimiento !== 'navegar') {
                m.flyTo({ center: c, zoom: Math.max(m.getZoom(), 15), padding: { top: 60, right: 40, ...margen }, duration: 900 });
            }
        });
    }, [seleccionado?.id]);

    // --- Ruta --------------------------------------------------------------------
    useEffect(() => {
        conMapa((m) => {
            const fuente = m.getSource('ruta') as GeoJSONSource;
            if (!ruta) return fuente.setData(vacio);
            const { linea, destino } = ruta;
            const features: Feature[] = [
                { type: 'Feature', geometry: { type: 'LineString', coordinates: linea }, properties: { parte: 'via' } },
            ];
            if (ruta.brechaFinal > 15) {
                features.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: [linea[linea.length - 1], destino] }, properties: { parte: 'brecha' } });
            }
            if (pos && ruta.brechaInicio > 15) {
                features.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: [[pos.lon, pos.lat], linea[0]] }, properties: { parte: 'brecha' } });
            }
            fuente.setData({ type: 'FeatureCollection', features });
            m.setPaintProperty('ruta', 'line-dasharray', ruta.modo === 'pie' ? [0.1, 1.6] : [1, 0]);
            m.setPaintProperty('ruta-borde', 'line-opacity', ruta.modo === 'pie' ? 0 : 1);

            if (seguimiento !== 'navegar') {
                const caja = new maplibregl.LngLatBounds(linea[0], linea[0]);
                for (const p of linea) caja.extend(p);
                caja.extend(destino);
                m.fitBounds(caja, { padding: { top: 70, right: 60, left: margen.left + 50, bottom: margen.bottom + 50 }, duration: 900, maxZoom: 17 });
            }
        });
    }, [ruta]);

    // --- Mi ubicación ---------------------------------------------------------------
    useEffect(() => {
        conMapa((m) => {
            const fuente = m.getSource('precision') as GeoJSONSource;
            if (!pos) {
                marcadorYo.current?.remove();
                marcadorYo.current = null;
                return fuente.setData(vacio);
            }
            const c: LngLat = [pos.lon, pos.lat];
            fuente.setData({ type: 'Feature', geometry: { type: 'Polygon', coordinates: [circulo(c, pos.precision)] }, properties: {} });

            if (!marcadorYo.current) {
                const el = document.createElement('div');
                el.className = 'punto-yo';
                el.innerHTML = '<span class="punto-yo_cono"></span><span class="punto-yo_punto"></span>';
                marcadorYo.current = new maplibregl.Marker({ element: el, rotationAlignment: 'map', pitchAlignment: 'map' }).setLngLat(c).addTo(m);
            }
            marcadorYo.current.setLngLat(c);
            const el = marcadorYo.current.getElement();
            el.classList.toggle('con-rumbo', pos.rumbo != null);
            if (pos.rumbo != null) marcadorYo.current.setRotation(pos.rumbo);

            if (seguimiento === 'centrar') {
                m.easeTo({ center: c, zoom: Math.max(m.getZoom(), 16), padding: { top: 60, right: 40, ...margen }, duration: 600 });
            } else if (seguimiento === 'navegar') {
                m.easeTo({
                    center: c,
                    zoom: 17.5,
                    pitch: 55,
                    bearing: pos.rumbo ?? m.getBearing(),
                    padding: { top: 140, bottom: 220, left: 0, right: 0 },
                    duration: 900,
                });
            }
        });
    }, [pos, seguimiento]);

    // Al salir de la navegación, se vuelve a la vista cenital
    useEffect(() => {
        if (seguimiento !== 'navegar') conMapa((m) => { if (m.getPitch() > 0) m.easeTo({ pitch: 0, bearing: 0, duration: 600 }); });
    }, [seguimiento]);

    return <div ref={contenedor} className="mapa" role="application" aria-label="Mapa de Chitagá" />;
}
