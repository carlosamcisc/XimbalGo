const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const ts = require('typescript');

function entorno() {
  const valores = new Map();
  const eventos = [];
  let tarea;
  let iniciado = false;
  let usuario = 'usuario';
  let vigente = true;
  const cambios = new Set();
  const appState = {
    currentState: 'active',
    addEventListener: (_, fn) => { cambios.add(fn); return { remove: () => cambios.delete(fn) }; },
  };
  const storage = {
    getItem: async k => valores.get(k) ?? null,
    setItem: async (k, v) => valores.set(k, v),
    removeItem: async k => valores.delete(k),
  };
  const location = {
    Accuracy: { Balanced: 3 },
    getBackgroundPermissionsAsync: async () => ({ granted: true }),
    hasStartedLocationUpdatesAsync: async () => iniciado,
    startLocationUpdatesAsync: async () => { iniciado = true; eventos.push('iniciar'); },
    stopLocationUpdatesAsync: async () => { iniciado = false; eventos.push('detener'); },
  };
  const modulos = {
    '@react-native-async-storage/async-storage': storage,
    'expo-location': location,
    'expo-task-manager': { isTaskDefined: () => false, defineTask: (_, fn) => { tarea = fn; } },
    'react-native': { Platform: { OS: 'android' }, AppState: appState },
    '../supabase/client': { supabase: { auth: { getSession: async () => ({ data: { session: { user: { id: usuario } } } }) } } },
    '../supabase/repositories/taxista.repository': {
      obtenerPerfilTaxista: async () => ({ enServicio: vigente }),
      actualizarUbicacion: async punto => eventos.push(punto),
    },
    '../supabase/repositories/ubicacionCompartida.repository': {
      actualizarUbicacionCompartida: async () => { eventos.push('compartir'); return vigente; },
    },
  };
  const codigo = ts.transpileModule(fs.readFileSync('src/infrastructure/location/background-location.service.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const exports = {};
  vm.runInNewContext(codigo, { exports, setTimeout, clearTimeout, require: nombre => {
    assert.ok(modulos[nombre], nombre);
    return modulos[nombre];
  } });
  return { api: exports, eventos, valores, estado: estado => {
    appState.currentState = estado;
    for (const fn of cambios) fn(estado);
  }, ejecutar: () => tarea({ data: { locations: [
    { timestamp: 2, coords: { latitude: 20, longitude: -90 } },
    { timestamp: 1, coords: { latitude: 10, longitude: -80 } },
  ] } }), cambiarUsuario: () => { usuario = 'otro'; }, terminar: () => { vigente = false; } };
}

test('envía la posición más reciente sin depender de una pantalla', async () => {
  const e = entorno();
  await e.api.iniciarUbicacionSegundoPlano({ tipo: 'taxista', usuarioId: 'usuario' });
  await e.ejecutar();
  assert.equal(e.eventos[1].latitud, 20);
  assert.equal(e.eventos[1].longitud, -90);
});

for (const motivo of ['otra cuenta', 'fuera de servicio', 'enlace vencido', 'enlace terminado']) {
  test(`detiene el seguimiento: ${motivo}`, async () => {
    const e = entorno();
    await e.api.iniciarUbicacionSegundoPlano(motivo.startsWith('enlace')
      ? { tipo: 'cliente', usuarioId: 'usuario', compartidaId: 'enlace', expiraEn: motivo === 'enlace vencido' ? '2000-01-01' : '2099-01-01' }
      : { tipo: 'taxista', usuarioId: 'usuario' });
    if (motivo === 'otra cuenta') e.cambiarUsuario();
    if (motivo === 'fuera de servicio' || motivo === 'enlace terminado') e.terminar();
    await e.ejecutar();
    assert.equal(e.eventos.at(-1), 'detener');
    assert.equal(e.valores.size, 0);
  });
}

test('una baja seguida de un alta conserva el nuevo seguimiento', async () => {
  const e = entorno();
  const destino = { tipo: 'taxista', usuarioId: 'usuario' };
  await e.api.iniciarUbicacionSegundoPlano(destino);
  await Promise.all([e.api.detenerUbicacionSegundoPlano(), e.api.iniciarUbicacionSegundoPlano(destino)]);
  assert.deepEqual(e.eventos, ['iniciar', 'detener', 'iniciar']);
  assert.equal(e.valores.size, 1);
});

test('espera a que la app vuelva al primer plano antes de arrancar', async () => {
  const e = entorno();
  e.estado('background');
  const inicio = e.api.iniciarUbicacionSegundoPlano({ tipo: 'taxista', usuarioId: 'usuario' });
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(e.eventos, []);
  e.estado('active');
  await inicio;
  assert.deepEqual(e.eventos, ['iniciar']);
});

test('no reinicia el servicio confirmado cuando se abre el menú para compartir', async () => {
  const e = entorno();
  const destino = { tipo: 'cliente', usuarioId: 'usuario', compartidaId: 'enlace', expiraEn: '2099-01-01' };
  await e.api.iniciarUbicacionSegundoPlano(destino);
  e.estado('background');
  await e.api.iniciarUbicacionSegundoPlano(destino);
  assert.deepEqual(e.eventos, ['iniciar']);
});

test('la limpieza del enlace anterior no detiene el nuevo servicio', async () => {
  const e = entorno();
  const anterior = { tipo: 'cliente', usuarioId: 'usuario', compartidaId: 'anterior', expiraEn: '2099-01-01' };
  await e.api.iniciarUbicacionSegundoPlano(anterior);
  await e.api.iniciarUbicacionSegundoPlano({ ...anterior, compartidaId: 'nuevo' });
  await e.api.detenerUbicacionSegundoPlano(anterior);
  assert.deepEqual(e.eventos, ['iniciar', 'iniciar']);
  assert.equal(e.valores.size, 1);
});
