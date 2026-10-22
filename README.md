# Guía Turística de Chitagá

Aplicación web progresiva (PWA) con la guía turística del municipio de Chitagá, Norte de Santander (Colombia). Muestra un mapa con los lugares de interés, la ficha de cada uno, la ruta para llegar desde tu ubicación y la navegación paso a paso. Funciona con poca señal, como en el páramo.

## Funciones

- **Mapa** con los lugares por categoría, vista de mapa o satélite y tu ubicación en tiempo real.
- **Fichas** con descripción, historia, horario, teléfono, altitud, dificultad de acceso, consejos y fuentes.
- **Rutas** a pie, en carro o en bici sobre OpenStreetMap, con perfil de altitud y tiempo calculado con la pendiente.
- **Navegación** con instrucciones paso a paso, recálculo al desviarse y aviso de llegada.
- **Sin conexión**: el mapa base y el catálogo quedan guardados en el dispositivo.
- **Gestión** protegida con contraseña para crear, editar y eliminar lugares, y fijar coordenadas con el GPS.
- **Placas QR** imprimibles: cada código abre la ficha del lugar.

## Requisitos

- Node.js 20 o superior.
- npm.

## Instalación

```bash
npm ci
```

## Desarrollo

Necesitas dos procesos: la API y el frontend.

Terminal 1, la API en `http://127.0.0.1:8787`:

```bash
ADMIN_PASSWORD='tu-clave' npm run api
```

Terminal 2, el frontend en `http://localhost:5174`:

```bash
npm run dev
```

Vite redirige `/api` hacia la API, así que el frontend no necesita configuración extra.

## Producción

Compila el frontend y arranca el servidor. El servidor de Express sirve también los archivos de `dist/`, así que basta un solo proceso:

```bash
npm run build
ADMIN_PASSWORD='tu-clave-larga' PUBLIC_URL='https://guia.tudominio.com' npm start
```

El servidor no tiene HTTPS propio. Para que el GPS del celular funcione, colócalo detrás de un proxy con HTTPS, por ejemplo Caddy o Nginx.

## Variables de entorno

| Variable | Por defecto | Descripción |
|---|---|---|
| `ADMIN_PASSWORD` | *(vacía)* | Contraseña de la gestión. Si no se define, la gestión queda desactivada (503). |
| `PUBLIC_URL` | `http://127.0.0.1:5174` | URL pública de la guía. Los códigos QR apuntan a `PUBLIC_URL/#/lugar/<id>`. Defínela antes de imprimir las placas. |
| `DATA_FILE` | `data/lugares.json` | Ruta del archivo donde se guardan los lugares. En producción apúntala a un disco persistente. |
| `HOST` | `0.0.0.0` | Interfaz de escucha de la API. Usa `127.0.0.1` si hay un proxy delante. |
| `PORT` | `8787` | Puerto de la API. |

## Datos

Los lugares viven en `data/lugares.json`. Si el archivo no existe, el servidor lo crea a partir de:

- [`server/atractivos.json`](server/atractivos.json): lugares curados a mano.
- [`public/data/osm.json`](public/data/osm.json): puntos de interés de OpenStreetMap.

Para actualizar los datos de OpenStreetMap desde Overpass:

```bash
npm run datos
```

Este comando reescribe `public/data/osm.json`. No modifica `data/lugares.json`, así que los cambios hechos desde la gestión se conservan.

Cada lugar tiene una **confiabilidad** de la coordenada:

| Valor | Significado |
|---|---|
| `verificada` | Tomada en sitio con GPS por un administrador. |
| `osm` | Proviene de OpenStreetMap. |
| `aproximada` | Deducida de un camino cercano; puede variar decenas de metros. |
| `pendiente` | Sin coordenada confiable. No se traza ruta. |

## Gestión de lugares

1. Entra a `#/admin` e ingresa la contraseña de `ADMIN_PASSWORD`.
2. Crea, edita o elimina lugares. Para fijar una ubicación, pulsa el botón de GPS en la lista o en el formulario.
3. Imprime las placas QR desde `#/placas`.

La contraseña se guarda solo durante la sesión del navegador (`sessionStorage`). Hay un límite de 10 intentos fallidos por IP cada 15 minutos.

## API

Todas las rutas están bajo `/api`.

| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| `GET` | `/api/lugares` | Público | Catálogo completo. |
| `GET` | `/api/lugares/:id` | Público | Un lugar. |
| `GET` | `/api/qr/:id` | Público | Código QR en SVG que apunta a la ficha. |
| `GET` | `/api/configuracion/vista-mapa` | Público | Centro y zoom iniciales del mapa. |
| `POST` | `/api/admin/verificar` | Contraseña | Comprueba la contraseña. |
| `POST` | `/api/lugares` | Contraseña | Crea un lugar. |
| `PUT` | `/api/lugares/:id` | Contraseña | Reemplaza un lugar. |
| `PATCH` | `/api/lugares/:id/ubicacion` | Contraseña | Fija latitud, longitud y precisión con verificación `verificada`. |
| `DELETE` | `/api/lugares/:id` | Contraseña | Elimina un lugar. |

La contraseña va en el encabezado `X-Admin-Password`. Las coordenadas deben estar dentro de la región de Chitagá (lat 6.7 a 7.5, lon -73.1 a -72.1).

## Estructura

```
├── src/
│   ├── App.tsx              Rutas por hash, origen de la ruta y estado general
│   ├── components/          Mapa, fichas, rutas, navegación, gestión y placas
│   ├── hooks/               Ubicación GPS, tema y navegación por hash
│   ├── lib/                 API, rutas OSRM, altimetría y geometría
│   └── tipos.ts             Tipos del catálogo
├── server/
│   ├── index.mjs            API Express y estáticos de dist/
│   ├── almacen.mjs          Almacén JSON con escritura atómica y validación
│   └── atractivos.json      Lugares curados
├── scripts/
│   └── actualizar-osm.mjs   Descarga de OpenStreetMap (npm run datos)
├── data/lugares.json        Base de datos de lugares
├── public/                  Íconos y datos estáticos
└── vite.config.ts           Configuración de Vite y de la PWA
```

## Servicios externos

La app depende de servicios públicos gratuitos. Revisa sus políticas de uso si el tráfico crece:

- **OpenFreeMap**: teselas del mapa base.
- **Esri**: imágenes satelitales.
- **OSRM de FOSSGIS**: cálculo de rutas.
- **Open-Meteo**: altitud de las rutas.
- **Overpass API**: solo para `npm run datos`.

## Scripts

| Comando | Qué hace |
|---|---|
| `npm run dev` | Frontend en modo desarrollo. |
| `npm run api` | API con recarga automática al cambiar archivos. |
| `npm run build` | Revisa tipos con TypeScript y compila el frontend a `dist/`. |
| `npm start` | Arranca la API y sirve `dist/`. Requiere `npm run build` antes. |
| `npm run datos` | Actualiza `public/data/osm.json` desde OpenStreetMap. |

## Créditos

Datos de © OpenStreetMap contributors (ODbL). Imágenes satelitales © Esri, Maxar, Earthstar Geographics.
