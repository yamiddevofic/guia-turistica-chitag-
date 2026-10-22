# Changelog

Todos los cambios notables de este proyecto se documentan en este archivo.

El formato sigue [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y el proyecto usa [Versionado semántico](https://semver.org/lang/es/).

## [Sin publicar]

### Pendiente
- Restaurar la última ruta mientras se recalcula durante la navegación.
- Usar `NetworkFirst` para `/api/lugares` en el service worker, para que los cambios del administrador se vean al guardar.
- Conservar `precision` y `sinNombre` al editar un lugar.
- Evitar que el mapa se re-encuadre cuando llega el perfil de altitud.
- Agregar `app.set('trust proxy', 'loopback')` si la API va detrás de un proxy.
- Completar la vista `#/acerca`, que hoy no tiene contenido.

## [0.1.0]

Primera versión de la guía.

### Añadido
- Mapa con MapLibre, vista de mapa o satélite y botón de ubicación con tres estados.
- Catálogo de lugares por categoría, con búsqueda y orden por cercanía.
- Fichas con descripción, historia, horario, teléfono, altitud, dificultad, consejos, datos curiosos, enlaces y fuentes.
- Indicador de confiabilidad de la coordenada: verificada, OpenStreetMap, aproximada o pendiente.
- Rutas a pie, en carro y en bici con OSRM, con corrección de rodeos y tramos sin camino mapeado punteados.
- Perfil de altitud con subida, bajada y tiempo a pie según la función de Tobler.
- Navegación paso a paso con recálculo al desviarse y aviso de llegada.
- PWA con service worker: catálogo y teselas del mapa disponibles sin conexión.
- Tema claro y oscuro.
- API Express con lugares en `data/lugares.json` y escritura atómica en cola.
- Gestión de lugares protegida con `ADMIN_PASSWORD`, con límite de 10 intentos por IP cada 15 minutos.
- Validación de campos y de coordenadas dentro de la región de Chitagá.
- Códigos QR por lugar y hoja imprimible de placas.
- Script `npm run datos` para descargar puntos de interés de OpenStreetMap.
- 13 atractivos curados en `server/atractivos.json`.
