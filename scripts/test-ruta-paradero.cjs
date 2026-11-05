const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function servidor({ destino, falloRpc = false, falloProveedor = false, geometria, entorno = {} } = {}) {
  let handler;
  const consultas = [];
  const peticiones = [];
  const codigo = fs.readFileSync('supabase/functions/distancias-paraderos/index.ts', 'utf8')
    .replace(/import \{ createClient \} from [^;]+;/, '');
  vm.runInNewContext(ts.transpileModule(codigo, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText, {
    exports: {}, Response, URLSearchParams, AbortSignal, console,
    Deno: { env: { get: (nombre) => entorno[nombre] }, serve: (fn) => { handler = fn; } },
    createClient: (_url, _key, opciones) => ({ rpc: async (nombre, args) => {
      consultas.push({ nombre, args, opciones });
      return { data: destino === null ? [] : [destino ?? { id: 'paradero', nombre: 'Paradero', distancia_metros: 700, latitud: 20.98, longitud: -89.63 }], error: falloRpc ? { code: '42501' } : null };
    } }),
    fetch: async (url) => {
      peticiones.push(new URL(url));
      return new Response(JSON.stringify({ paths: [{ distance: 800, time: 600000, points: geometria ?? { type: 'LineString', coordinates: [[-89.62, 20.97], [-89.63, 20.98]] } }] }), { status: falloProveedor ? 429 : 200 });
    },
  });
  return { consultas, peticiones, llamar: (body, autorizado = true) => handler(new Request('https://ejemplo.test', { method: 'POST', headers: autorizado ? { Authorization: 'Bearer sesion' } : {}, body: JSON.stringify(body) })) };
}

const body = { paraderoId: '12345678-1234-1234-1234-123456789012', latitud: 20.97, longitud: -89.62 };

const seguimientoTaxi = {
  en_servicio: true, taxi_latitud: 20.95, taxi_longitud: -89.60,
  paradero_latitud: 20.98, paradero_longitud: -89.63,
  punto_latitud: 20.97, punto_longitud: -89.62,
};

test('las métricas y el trazo de abordaje usan el mismo destino aunque haya un paradero distinto', async () => {
  const s = servidor({ destino: seguimientoTaxi });
  const res = await s.llamar({ reservaId: body.paraderoId, destino: 'abordaje' });
  assert.equal(res.status, 200);
  const datos = await res.json();
  assert.equal(datos.destino, 'abordaje');
  assert.equal(datos.metros, 800);
  assert.equal(datos.segundos, 600);
  assert.deepEqual(s.peticiones[0].searchParams.getAll('point'), ['20.95,-89.6', '20.97,-89.62']);
});

test('rechaza un destino arbitrario en la reserva antes de consultar al proveedor', async () => {
  const s = servidor({ destino: seguimientoTaxi });
  assert.equal((await s.llamar({ reservaId: body.paraderoId, destino: 'otro' })).status, 400);
  assert.equal(s.peticiones.length, 0);
});

test('el destino paradero mantiene trazo y métricas hacia el paradero aunque el taxi esté junto al cliente', async () => {
  const s = servidor({ destino: { ...seguimientoTaxi, punto_latitud: seguimientoTaxi.taxi_latitud, punto_longitud: seguimientoTaxi.taxi_longitud } });
  const res = await s.llamar({ reservaId: body.paraderoId, destino: 'paradero' });
  assert.equal(res.status, 200);
  const datos = await res.json();
  assert.equal(datos.destino, 'paradero');
  assert.equal(datos.metros, 800);
  assert.equal(datos.segundos, 600);
  assert.deepEqual(s.peticiones[0].searchParams.getAll('point'), ['20.95,-89.6', '20.98,-89.63']);
});

test('un paradero que deja de estar disponible no se sustituye silenciosamente por el cliente', async () => {
  const s = servidor({ destino: { ...seguimientoTaxi, paradero_latitud: null, paradero_longitud: null } });
  assert.equal((await s.llamar({ reservaId: body.paraderoId, destino: 'paradero' })).status, 404);
  assert.equal(s.peticiones.length, 0);
});

test('el trazo del taxi consulta la reserva con la sesión y usa auto y coordenadas del servidor', async () => {
  const s = servidor({ destino: seguimientoTaxi });
  const res = await s.llamar({ reservaId: body.paraderoId, latitud: 0, longitud: 0, modo: 'caminando' });
  assert.equal(res.status, 200);
  assert.equal((await res.json()).modo, 'auto');
  assert.equal(s.consultas[0].nombre, 'obtener_seguimiento_reserva');
  assert.equal(s.consultas[0].args.p_reserva_id, body.paraderoId);
  assert.equal(s.consultas[0].opciones.global.headers.Authorization, 'Bearer sesion');
  assert.equal(s.peticiones[0].searchParams.get('profile'), 'car');
  assert.deepEqual(s.peticiones[0].searchParams.getAll('point'), ['20.95,-89.6', '20.98,-89.63']);
});

test('sin paradero traza hasta el abordaje y no requiere coordenadas del cliente', async () => {
  const s = servidor({ destino: { ...seguimientoTaxi, paradero_latitud: null, paradero_longitud: null } });
  assert.equal((await s.llamar({ reservaId: body.paraderoId })).status, 200);
  assert.deepEqual(s.peticiones[0].searchParams.getAll('point'), ['20.95,-89.6', '20.97,-89.62']);
});

test('no consulta al proveedor con reserva ajena, ubicación ausente o taxi fuera de servicio', async () => {
  for (const opciones of [
    { falloRpc: true, destino: seguimientoTaxi },
    { destino: { ...seguimientoTaxi, en_servicio: false } },
    { destino: { ...seguimientoTaxi, taxi_latitud: null } },
    { destino: { ...seguimientoTaxi, taxi_latitud: null, taxi_longitud: null } },
    { destino: null },
  ]) {
    const s = servidor(opciones);
    assert.ok((await s.llamar({ reservaId: body.paraderoId })).status >= 400);
    assert.equal(s.peticiones.length, 0);
  }
});

test('la ruta usa el destino real con RLS y devuelve GeoJSON sin intercambiar ejes', async () => {
  const s = servidor();
  const res = await s.llamar(body);
  assert.equal(res.status, 200);
  const datos = await res.json();
  assert.equal(datos.segundos, 600);
  assert.equal(datos.modo, 'caminando');
  assert.equal(datos.aproximada, false);
  assert.equal(s.peticiones[0].searchParams.get('profile'), 'foot');
  assert.deepEqual(datos.geometria.coordinates[0], [-89.62, 20.97]);
  assert.equal(s.consultas[0].nombre, 'obtener_paradero');
  assert.equal(s.consultas[0].opciones.global.headers.Authorization, 'Bearer sesion');
  assert.deepEqual(s.peticiones[0].searchParams.getAll('point'), ['20.97,-89.62', '20.98,-89.63']);
  assert.equal(s.peticiones[0].searchParams.get('points_encoded'), 'false');
});

test('el modo moto usa el perfil configurado para vehículos y avisa si se aproxima con auto', async () => {
  const s = servidor();
  const res = await s.llamar({ ...body, modo: 'moto' });
  assert.equal(res.status, 200);
  const datos = await res.json();
  assert.equal(datos.modo, 'moto');
  assert.equal(datos.aproximada, true);
  assert.equal(s.peticiones[0].searchParams.get('profile'), 'car');
  assert.equal(datos.geometria.type, 'LineString');
});

test('respeta perfiles propios de moto y permite volver a caminar', async () => {
  const s = servidor({ entorno: { GRAPHHOPPER_PERFIL_MOTO: 'moto', GRAPHHOPPER_PERFIL_PIE: 'peaton' } });
  const enMoto = await s.llamar({ ...body, modo: 'moto' });
  const caminando = await s.llamar({ ...body, modo: 'caminando' });
  assert.equal((await enMoto.json()).aproximada, false);
  assert.equal((await caminando.json()).modo, 'caminando');
  assert.deepEqual(s.peticiones.map((url) => url.searchParams.get('profile')), ['moto', 'peaton']);
});

test('rechaza modos desconocidos antes de consultar el paradero o consumir rutas', async () => {
  for (const modo of ['car', 'bike', '', null, 1, {}]) {
    const s = servidor();
    const res = await s.llamar({ ...body, modo });
    assert.equal(res.status, 400);
    assert.equal(s.consultas.length, 0);
    assert.equal(s.peticiones.length, 0);
  }
});

test('un fallo en moto informa ese modo y no devuelve una ruta peatonal', async () => {
  const res = await servidor({ falloProveedor: true }).llamar({ ...body, modo: 'moto' });
  assert.equal(res.status, 502);
  const datos = await res.json();
  assert.match(datos.error, /en moto/);
  assert.equal(datos.geometria, undefined);
});

test('rechaza solicitudes sin sesión o coordenadas válidas antes de consumir rutas', async () => {
  const s = servidor();
  assert.equal((await s.llamar(body, false)).status, 401);
  assert.equal((await s.llamar({ ...body, latitud: 91 })).status, 400);
  assert.equal((await s.llamar({ ...body, paraderoId: 'incorrecto' })).status, 400);
  assert.equal(s.peticiones.length, 0);
});

test('no calcula rutas a paraderos inaccesibles o sin ubicación', async () => {
  for (const opciones of [{ destino: null }, { falloRpc: true }, { destino: { latitud: null, longitud: null } }]) {
    const s = servidor(opciones);
    assert.ok((await s.llamar(body)).status >= 400);
    assert.equal(s.peticiones.length, 0);
  }
});

test('un fallo del proveedor informa error y nunca inventa una línea recta', async () => {
  const res = await servidor({ falloProveedor: true }).llamar(body);
  assert.equal(res.status, 502);
  assert.equal((await res.json()).geometria, undefined);
});

test('rechaza geometrías incompletas o con coordenadas fuera de rango', async () => {
  for (const coordinates of [[], [[0, 0]], [[181, 0], [0, 0]], [[0, null], [0, 0]]]) {
    const res = await servidor({ geometria: { type: 'LineString', coordinates } }).llamar(body);
    assert.equal(res.status, 502);
  }
});

test('la consulta existente de cercanos mantiene los trayectos caminando y en moto', async () => {
  const s = servidor();
  const res = await s.llamar({ latitud: body.latitud, longitud: body.longitud });
  assert.equal(res.status, 200);
  const { paraderos } = await res.json();
  assert.equal(paraderos[0].caminando.metros, 800);
  assert.equal(paraderos[0].moto.segundos, 600);
  assert.equal(s.consultas[0].nombre, 'obtener_paraderos_cercanos');
  assert.equal(s.peticiones.length, 2);
});
