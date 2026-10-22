// Descarga de OpenStreetMap los puntos de interés del municipio de Chitagá
// y los guarda normalizados en public/data/osm.json.
// Uso: npm run datos
import { writeFile } from 'node:fs/promises';

const SERVIDORES = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.private.coffee/api/interpreter',
    'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
];
const MUNICIPIO = 1423503; // relación OSM del municipio de Chitagá (admin_level 6)

const query = `
[out:json][timeout:120];
rel(${MUNICIPIO});map_to_area->.m;
(
  nwr(area.m)[amenity~"^(school|college|university|kindergarten|bus_station|restaurant|cafe|fast_food|bar|hospital|clinic|doctors|pharmacy|police|fuel|bank|atm|townhall|post_office|marketplace|place_of_worship)$"];
  nwr(area.m)[healthcare];
  nwr(area.m)[tourism~"^(hotel|hostel|guest_house|motel|camp_site|chalet|information|museum|attraction|viewpoint|artwork|picnic_site)$"];
  nwr(area.m)[public_transport=station];
  nwr(area.m)[highway=bus_stop][name];
  nwr(area.m)[historic];
  nwr(area.m)[leisure~"^(park|nature_reserve)$"][name];
  nwr(area.m)[natural~"^(peak|water|waterfall|spring|cave_entrance)$"][name];
  nwr(area.m)[place~"^(town|village|hamlet)$"][name];
);
out center tags;`;

// Orden importa: la primera regla que coincide define la categoría
const REGLAS = [
    ['salud', (t) => /^(hospital|clinic|doctors|pharmacy)$/.test(t.amenity) || t.healthcare],
    ['educacion', (t) => /^(school|college|university|kindergarten)$/.test(t.amenity)],
    ['transporte', (t) => t.amenity === 'bus_station' || t.public_transport === 'station' || t.highway === 'bus_stop' || t.amenity === 'fuel'],
    ['comida', (t) => /^(restaurant|cafe|fast_food|bar)$/.test(t.amenity)],
    ['hospedaje', (t) => /^(hotel|hostel|guest_house|motel|camp_site|chalet)$/.test(t.tourism)],
    ['naturaleza', (t) => t.natural || t.leisure === 'nature_reserve'],
    ['turismo', (t) => t.tourism || t.historic || t.leisure === 'park' || t.amenity === 'place_of_worship'],
    ['servicios', (t) => /^(police|bank|atm|townhall|post_office|marketplace)$/.test(t.amenity)],
    ['poblado', (t) => t.place],
];

const TIPOS = {
    hospital: 'Hospital', clinic: 'Centro de salud', doctors: 'Consultorio', pharmacy: 'Droguería',
    school: 'Institución educativa', college: 'Educación superior', university: 'Universidad', kindergarten: 'Jardín infantil',
    bus_station: 'Terminal de transporte', bus_stop: 'Parada de bus', fuel: 'Estación de servicio',
    restaurant: 'Restaurante', cafe: 'Cafetería', fast_food: 'Comidas rápidas', bar: 'Bar',
    hotel: 'Hotel', hostel: 'Hostal', guest_house: 'Hospedaje', motel: 'Motel', camp_site: 'Zona de camping', chalet: 'Cabaña',
    police: 'Policía', bank: 'Banco', atm: 'Cajero', townhall: 'Alcaldía', post_office: 'Correo', marketplace: 'Plaza de mercado',
    place_of_worship: 'Templo', museum: 'Museo', viewpoint: 'Mirador', attraction: 'Atractivo', artwork: 'Obra de arte',
    information: 'Información turística', picnic_site: 'Zona de pícnic', park: 'Parque', nature_reserve: 'Reserva natural',
    peak: 'Cerro / pico', water: 'Laguna / cuerpo de agua', waterfall: 'Cascada', spring: 'Nacimiento de agua', cave_entrance: 'Cueva',
    town: 'Cabecera municipal', village: 'Corregimiento / centro poblado', hamlet: 'Caserío', monument: 'Monumento', memorial: 'Memorial',
};

function tipo(t) {
    for (const k of ['amenity', 'tourism', 'natural', 'leisure', 'historic', 'place', 'highway']) {
        if (t[k] && TIPOS[t[k]]) return TIPOS[t[k]];
    }
    if (t.healthcare) return 'Salud';
    if (t.historic) return 'Sitio histórico';
    return 'Punto de interés';
}

// Overpass suele saturarse: se reintenta y se alterna entre servidores espejo
async function consultar() {
    let ultimoError;
    for (let intento = 0; intento < 6; intento++) {
        const servidor = SERVIDORES[intento % SERVIDORES.length];
        try {
            const res = await fetch(servidor, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'guia-turistica-chitaga/0.1' },
                body: new URLSearchParams({ data: query }),
            });
            if (!res.ok) throw new Error(`${servidor} respondió ${res.status}`);
            const json = await res.json();
            if (json.remark) throw new Error(`${servidor}: ${json.remark}`);
            return json;
        } catch (err) {
            ultimoError = err;
            console.warn(`Intento ${intento + 1} falló: ${err.message}`);
            await new Promise((r) => setTimeout(r, 5000 * (intento + 1)));
        }
    }
    throw ultimoError;
}

const json = await consultar();

const lugares = [];
for (const e of json.elements) {
    const t = e.tags ?? {};
    const lat = e.lat ?? e.center?.lat;
    const lon = e.lon ?? e.center?.lon;
    if (lat == null) continue;
    const regla = REGLAS.find(([, fn]) => fn(t));
    if (!regla) continue;
    const t2 = tipo(t);
    lugares.push({
        id: `osm-${e.type}-${e.id}`,
        nombre: t.name ?? t2,
        sinNombre: !t.name,
        categoria: regla[0],
        tipo: t2,
        lat: +lat.toFixed(6),
        lon: +lon.toFixed(6),
        altitud: t.ele ? Number.parseFloat(t.ele) : undefined,
        horario: t.opening_hours,
        telefono: t.phone ?? t['contact:phone'],
        web: t.website ?? t['contact:website'],
        fuente: { tipo: 'osm', url: `https://www.openstreetmap.org/${e.type}/${e.id}` },
    });
}

lugares.sort((a, b) => a.categoria.localeCompare(b.categoria) || a.nombre.localeCompare(b.nombre, 'es'));
const salida = {
    generado: new Date().toISOString(),
    fuente: 'OpenStreetMap (ODbL) vía Overpass API',
    municipio: `https://www.openstreetmap.org/relation/${MUNICIPIO}`,
    total: lugares.length,
    lugares,
};
await writeFile(new URL('../public/data/osm.json', import.meta.url), JSON.stringify(salida));

const conteo = Object.groupBy(lugares, (l) => l.categoria);
console.log(`✔ ${lugares.length} lugares guardados en public/data/osm.json`);
for (const [c, l] of Object.entries(conteo)) console.log(`  ${c.padEnd(11)} ${l.length}`);
