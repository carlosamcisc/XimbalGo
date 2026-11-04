const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function cargar(archivo, contexto = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(archivo, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { exports, ...contexto });
  return exports;
}

function reloj() {
  const timers = new Map();
  let id = 0;
  const modulo = cargar('src/modules/cliente/tiempoLimite.ts', {
    setTimeout: (fn, ms) => { timers.set(++id, { fn, ms }); return id; },
    clearTimeout: (clave) => timers.delete(clave),
  });
  return { ...modulo, timers, vencer: () => [...timers.values()][0].fn() };
}

test('una respuesta rápida limpia el temporizador', async () => {
  const r = reloj();
  assert.equal(await r.conTiempoLimite(Promise.resolve('ruta'), 15000, 'Tiempo agotado'), 'ruta');
  assert.equal(r.timers.size, 0);
});

test('una consulta que no termina vence y aborta una sola vez', async () => {
  const r = reloj();
  let abortos = 0;
  const pendiente = r.conTiempoLimite(new Promise(() => {}), 15000, 'Tiempo agotado', () => abortos++);
  const rechazo = assert.rejects(pendiente, /Tiempo agotado/);
  r.vencer();
  await rechazo;
  assert.equal(abortos, 1);
  assert.equal(r.timers.size, 0);
});

test('una respuesta tardía no reemplaza el error y permite reintentar', async () => {
  const r = reloj();
  let responder;
  const pendiente = r.conTiempoLimite(new Promise((resolve) => { responder = resolve; }), 15000, 'Tiempo agotado');
  const rechazo = assert.rejects(pendiente, /Tiempo agotado/);
  r.vencer();
  await rechazo;
  responder('posición anterior');
  assert.equal(await r.conTiempoLimite(Promise.resolve('posición nueva'), 15000, 'Tiempo agotado'), 'posición nueva');
  assert.equal(r.timers.size, 0);
});

test('un error original se conserva y limpia la espera', async () => {
  const r = reloj();
  await assert.rejects(r.conTiempoLimite(Promise.reject(new Error('Sin permiso')), 15000, 'Tiempo agotado'), /Sin permiso/);
  assert.equal(r.timers.size, 0);
});

function servicioUbicacion(r, getCurrentPositionAsync) {
  return cargar('src/infrastructure/location/location.service.ts', {
    require: (nombre) => {
      if (nombre === 'expo-location') return {
        getForegroundPermissionsAsync: async () => ({ granted: true }),
        requestForegroundPermissionsAsync: async () => { throw new Error('No debe volver a solicitar un permiso ya concedido'); },
        hasServicesEnabledAsync: async () => true,
        getCurrentPositionAsync,
        Accuracy: { Balanced: 3 },
      };
      if (nombre.endsWith('tiempoLimite')) return r;
      if (nombre === 'react-native') return { Platform: {} };
      if (nombre === 'expo-linking') return {};
      throw new Error(`Importación inesperada: ${nombre}`);
    },
  });
}

test('la ruta puede limitar explícitamente la espera de GPS a 15 segundos', async () => {
  const r = reloj();
  const servicio = servicioUbicacion(r, () => new Promise(() => {}));
  const pendiente = servicio.obtenerUbicacionActual(undefined, true, { tiempoEsperaMs: 15000 });
  const rechazo = assert.rejects(pendiente, /Está tardando en obtenerse tu ubicación/);
  await new Promise(setImmediate);
  assert.equal([...r.timers.values()][0].ms, 15000);
  r.vencer();
  await rechazo;
  assert.equal(r.timers.size, 0);
});

test('Inicio y los demás consumidores no heredan el límite de la ruta', async () => {
  const r = reloj();
  let responder;
  let resuelto = false;
  const servicio = servicioUbicacion(r, () => new Promise((resolve) => { responder = resolve; }));
  const pendiente = servicio.obtenerUbicacionActual().then((ubicacion) => {
    resuelto = true;
    return ubicacion;
  });
  await new Promise(setImmediate);
  assert.equal(typeof responder, 'function');
  assert.equal(resuelto, false);
  // No existe ningún temporizador que convierta una posición lenta en error.
  assert.equal(r.timers.size, 0);
  responder({ coords: { latitude: 20.97, longitude: -89.62 } });
  const ubicacion = await pendiente;
  assert.equal(ubicacion.latitud, 20.97);
  assert.equal(ubicacion.longitud, -89.62);
});
