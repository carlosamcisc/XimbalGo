const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function cargar(archivo, modulos = {}, extras = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(archivo, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText, { exports, require: nombre => {
    assert.ok(modulos[nombre], nombre);
    return modulos[nombre];
  }, ...extras });
  return exports;
}
const api = cargar('src/infrastructure/notifications/aperturaPush.ts');
const ID = '11111111-1111-4111-8111-111111111111';
const RESERVA = '22222222-2222-4222-8222-222222222222';
const OTRA = '33333333-3333-4333-8333-333333333333';
const datos = { notificacionId: ID, reservaId: RESERVA, tipo: 'reserva_aceptada' };
const tick = () => new Promise(resolve => setImmediate(resolve));
function diferida() {
  let resolver;
  const promesa = new Promise(resolve => { resolver = resolve; });
  return { promesa, resolver };
}
function entorno(opciones = {}) {
  let contexto = { usuarioId: 'cliente', rol: 'cliente', disponible: true };
  let lista = true;
  const aberturas = [], lecturas = [], consumidos = [], avisos = [], consultas = [];
  const controlador = api.crearControladorAperturaPush({
    contexto: () => contexto, navegacionLista: () => lista,
    consultar: async (usuario, id) => {
      consultas.push([usuario, id]);
      return opciones.consultar ? opciones.consultar(usuario, id) : datos;
    },
    abrir: (...args) => aberturas.push(args), marcarLeida: async (...args) => {
      lecturas.push(args);
      if (opciones.falloLectura) throw Error('red');
    },
    consumir: id => consumidos.push(id), avisar: (...args) => avisos.push(args),
  });
  return { controlador, aberturas, lecturas, consumidos, avisos, consultas,
    contexto: valor => { contexto = { ...contexto, ...valor }; },
    lista: valor => { lista = valor; } };
}

test('push: rechaza payloads malformados y enlaces arbitrarios', () => {
  for (const valor of [null, [], 'ximbalgo://algo', {}, { ...datos, notificacionId: 'x' },
    { ...datos, reservaId: 'url' }, { ...datos, tipo: 'desconocido' }, { url: 'https://example.org' }]) {
    assert.equal(api.interpretarDatosPush(valor), null);
  }
  assert.equal(api.interpretarDatosPush({ ...datos, reservaId: null }).reservaId, null);
  assert.equal(api.interpretarDatosPush(datos).reservaId, RESERVA);
});

test('push: espera la restauración de sesión y el stack del rol', async () => {
  const e = entorno();
  e.contexto({ usuarioId: null, rol: null, disponible: false }); e.lista(false);
  e.controlador.recibir('arranque', datos);
  await tick(); assert.equal(e.consultas.length, 0);
  e.contexto({ usuarioId: 'cliente', rol: 'cliente', disponible: true });
  e.controlador.actualizar(); await tick(); assert.equal(e.consultas.length, 0);
  e.lista(true); e.controlador.actualizar(); await tick();
  assert.deepEqual(e.aberturas, [['cliente', RESERVA, ID]]);
  assert.deepEqual(e.lecturas, [['cliente', ID]]);
});

test('push: abre el destino de Supabase y no el reservaId manipulado', async () => {
  const e = entorno(); e.controlador.recibir('toque', { ...datos, reservaId: OTRA }); await tick();
  assert.equal(e.aberturas[0][1], RESERVA);
});

test('push: cliente y taxista usan su rol actual', async () => {
  const e = entorno(); e.contexto({ usuarioId: 'taxista', rol: 'taxista' });
  e.controlador.recibir('toque', datos); await tick();
  assert.deepEqual(e.aberturas, [['taxista', RESERVA, ID]]);
});

test('push: no duplica el evento inicial y el listener para el mismo toque', async () => {
  const e = entorno(); e.controlador.recibir('igual', datos); e.controlador.recibir('igual', datos);
  await tick(); e.controlador.recibir('igual', datos); await tick();
  assert.equal(e.aberturas.length, 1); assert.equal(e.lecturas.length, 1);
});

test('push: recibir un payload inválido no navega ni marca leído', async () => {
  const e = entorno(); e.controlador.recibir('invalido', {}); await tick();
  assert.equal(e.aberturas.length, 0); assert.equal(e.lecturas.length, 0);
  assert.deepEqual(e.consumidos, ['invalido']);
});

test('push: aviso eliminado, ajeno o sin reserva muestra un mensaje', async () => {
  for (const aviso of [null, { ...datos, reservaId: null }]) {
    const e = entorno({ consultar: async () => aviso });
    e.controlador.recibir('antiguo', datos); await tick();
    assert.equal(e.aberturas.length, 0); assert.equal(e.lecturas.length, 0);
    assert.equal(e.avisos.length, 1); assert.deepEqual(e.consumidos, ['antiguo']);
  }
});

test('push: mantiene el toque durante recuperación de contraseña', async () => {
  const e = entorno(); e.contexto({ disponible: false });
  e.controlador.recibir('recovery', datos); await tick(); assert.equal(e.consultas.length, 0);
  e.contexto({ disponible: true }); e.controlador.actualizar(); await tick();
  assert.equal(e.aberturas.length, 1);
});

test('push: descarta un toque pendiente al cambiar de cuenta', async () => {
  const e = entorno(); e.lista(false); e.controlador.recibir('viejo', datos);
  e.contexto({ usuarioId: 'otro' }); e.lista(true); e.controlador.actualizar(); await tick();
  assert.equal(e.consultas.length, 0); assert.equal(e.aberturas.length, 0);
});

test('push: una consulta tardía no abre ni marca avisos de una cuenta anterior', async () => {
  const lenta = diferida(), e = entorno({ consultar: () => lenta.promesa });
  e.controlador.recibir('viejo', datos); e.contexto({ usuarioId: null, rol: null });
  e.controlador.actualizar(); lenta.resolver(datos); await tick();
  assert.equal(e.aberturas.length, 0); assert.equal(e.lecturas.length, 0);
});

test('push: volver a la misma cuenta después del logout no revive una consulta vieja', async () => {
  const lenta = diferida(), e = entorno({ consultar: () => lenta.promesa });
  e.controlador.recibir('viejo', datos);
  e.contexto({ usuarioId: null, rol: null }); e.controlador.actualizar();
  e.contexto({ usuarioId: 'cliente', rol: 'cliente' }); e.controlador.actualizar();
  lenta.resolver(datos); await tick();
  assert.equal(e.aberturas.length, 0); assert.equal(e.lecturas.length, 0);
});

test('push: el último toque gana si una consulta anterior sigue en curso', async () => {
  const lenta = diferida();
  const e = entorno({ consultar: (_usuario, id) => id === ID ? lenta.promesa : { ...datos, notificacionId: OTRA, reservaId: OTRA } });
  e.controlador.recibir('primero', datos);
  e.controlador.recibir('segundo', { ...datos, notificacionId: OTRA });
  lenta.resolver(datos); await tick();
  assert.deepEqual(e.aberturas, [['cliente', OTRA, OTRA]]);
});

test('push: un fallo de red permite reintentar sin navegación ni lectura prematuras', async () => {
  let fallar = true;
  const e = entorno({ consultar: async () => { if (fallar) throw Error('red'); return datos; } });
  e.controlador.recibir('toque', datos); await tick();
  assert.equal(e.aberturas.length, 0); assert.equal(e.lecturas.length, 0);
  e.controlador.actualizar(); await tick(); assert.equal(e.consultas.length, 1);
  fallar = false; e.avisos[0][1](); await tick(); assert.equal(e.aberturas.length, 1);
});

test('push: no retrasa abrir la reserva si falla marcar como leído', async () => {
  const e = entorno({ falloLectura: true }); e.controlador.recibir('toque', datos); await tick();
  assert.equal(e.aberturas.length, 1); assert.equal(e.avisos.length, 1);
});

test('push: desmontar invalida la consulta en curso', async () => {
  const lenta = diferida(), e = entorno({ consultar: () => lenta.promesa });
  e.controlador.recibir('toque', datos); e.controlador.detener(); lenta.resolver(datos); await tick();
  assert.equal(e.aberturas.length, 0); assert.equal(e.lecturas.length, 0);
});

test('push: repositorio filtra por propietario y marca solo el aviso abierto', async () => {
  const operaciones = [];
  const consulta = {
    select: x => { operaciones.push(['select', x]); return consulta; },
    update: x => { operaciones.push(['update', x]); return consulta; },
    eq: (...args) => { operaciones.push(['eq', ...args]); return consulta; },
    abortSignal: () => consulta,
    maybeSingle: async () => ({ data: { id: ID, reserva_id: RESERVA, tipo: datos.tipo }, error: null }),
    then: (ok, error) => Promise.resolve({ error: null }).then(ok, error),
  };
  const repo = cargar('src/infrastructure/supabase/repositories/aperturaPush.repository.ts', {
    '../client': { supabase: { from: tabla => { assert.equal(tabla, 'notificaciones'); return consulta; } } },
    '../../notifications/aperturaPush': api,
  }, { AbortController, setTimeout, clearTimeout });
  await repo.obtenerAvisoPushPropio('propietario', ID);
  await repo.marcarAvisoPushLeido('propietario', ID);
  assert.equal(operaciones.filter(x => x[0] === 'eq' && x[1] === 'usuario_id' && x[2] === 'propietario').length, 2);
  assert.equal(operaciones.filter(x => x[0] === 'eq' && x[1] === 'id' && x[2] === ID).length, 2);
  assert.equal(operaciones.filter(x => x[0] === 'update').length, 1);
});

test('push: captura toque inicial y posterior, ignora acciones y limpia listeners', async () => {
  const efectos = [], listeners = [], aberturas = [], marcas = [];
  const respuesta = { actionIdentifier: 'DEFAULT', notification: { request: { identifier: 'inicial', content: { data: datos } } } };
  let ultima = respuesta, quitados = 0, auth = { usuario: { id: 'cliente' }, rol: 'cliente' };
  const nav = { isReady: () => true, getRootState: () => ({ routeNames: ['ClienteReserva'] }),
    navigate: (...args) => aberturas.push(args) };
  const hook = cargar('src/infrastructure/notifications/useAperturaPush.ts', {
    react: { useEffect: fn => efectos.push(fn), useMemo: fn => fn() },
    '@react-navigation/native': { createNavigationContainerRef: () => nav },
    'react-native': { Platform: { OS: 'android' }, Alert: { alert: () => assert.fail('alerta inesperada') } },
    'expo-constants': { appOwnership: null },
    'expo-notifications': {
      DEFAULT_ACTION_IDENTIFIER: 'DEFAULT', getLastNotificationResponse: () => ultima,
      clearLastNotificationResponse: () => { ultima = null; },
      addNotificationResponseReceivedListener: fn => { listeners.push(fn); return { remove: () => { quitados++; } }; },
    },
    '../../store/autenticacionStore': { obtenerEstadoAutenticacion: () => auth, useAutenticacionStore: () => auth },
    '../supabase/repositories/aperturaPush.repository': {
      obtenerAvisoPushPropio: async () => datos, marcarAvisoPushLeido: async (...args) => marcas.push(args),
    },
    './aperturaPush': api,
  });
  const actualizar = hook.useAperturaPush();
  const cleanups = efectos.map(fn => fn()); await tick();
  assert.equal(aberturas.length, 1); assert.equal(ultima, null);
  listeners[0]({ ...respuesta, actionIdentifier: 'OTRA' }); await tick(); assert.equal(aberturas.length, 1);
  listeners[0]({ ...respuesta, notification: { request: { ...respuesta.notification.request, identifier: 'nuevo' } } });
  actualizar(); await tick(); assert.equal(aberturas.length, 2); assert.equal(marcas.length, 2);
  cleanups.filter(Boolean).forEach(fn => fn()); assert.equal(quitados, 1);
});

function entornoDetalle(rol, consultar) {
  const estados = [], focos = [], efectos = [];
  let suscripciones = 0, bajas = 0;
  const escucharReserva = () => { suscripciones++; return () => { bajas++; }; };
  const modulos = {
    react: {
      useState: inicial => {
        const indice = estados.length; estados.push(inicial);
        return [inicial, valor => { estados[indice] = typeof valor === 'function' ? valor(estados[indice]) : valor; }];
      },
      useRef: current => ({ current }), useCallback: fn => fn, useEffect: fn => efectos.push(fn),
    },
    '@react-navigation/native': { useFocusEffect: fn => focos.push(fn) },
    'react-native': { AppState: { addEventListener: () => ({ remove() {} }) } },
    '../../infrastructure/supabase/repositories/reservas.repository': {
      escucharReserva, obtenerReservaCliente: consultar, obtenerSeguimientoReserva: async () => null,
    },
    '../../infrastructure/supabase/repositories/taxista.repository': { obtenerReservaTaxista: consultar },
    '../../modules/cliente/reservas': { esReservaActiva: () => false },
    '../../modules/cliente/seguimiento': {},
    './useClienteInicio': { mensajeError: e => e.message },
  };
  const archivo = rol === 'cliente' ? 'src/screens/cliente/useClienteReserva.ts' : 'src/screens/taxista/useReservaTaxista.ts';
  const exports = cargar(archivo, modulos, { setTimeout, clearTimeout });
  const detalle = rol === 'cliente' ? exports.useClienteReserva(RESERVA, ID) : exports.useReservaTaxista(RESERVA, ID, null);
  return { estados, detalle, enfocar: () => focos[0](), efectos,
    suscripciones: () => ({ altas: suscripciones, bajas }) };
}

test('detalle cliente: al tocar otro aviso actualiza y no muestra una reserva que dejó de existir', async () => {
  let existe = true;
  const e = entornoDetalle('cliente', async () => { if (!existe) throw Error('No se encontró la reservación.'); return { id: RESERVA }; });
  const desenfocar = e.enfocar(); await tick(); assert.equal(e.estados[0].id, RESERVA);
  desenfocar(); existe = false; e.enfocar(); await tick();
  assert.equal(e.estados[0], null); assert.equal(e.estados[4], 'No se encontró la reservación.');
});

test('detalle cliente: descarta respuestas anteriores después de volver a enfocar', async () => {
  const lenta = diferida(); let llamadas = 0;
  const e = entornoDetalle('cliente', () => ++llamadas === 1 ? lenta.promesa : { id: RESERVA, estado: 'completada' });
  const desenfocar = e.enfocar(); desenfocar(); e.enfocar(); await tick();
  lenta.resolver({ id: RESERVA, estado: 'pendiente' }); await tick();
  assert.equal(e.estados[0].estado, 'completada');
});

test('detalle taxista: revalida al volver y muestra que una reserva dejó de estar disponible', async () => {
  let existe = true;
  const e = entornoDetalle('taxista', async () => existe ? { id: RESERVA } : null);
  const desenfocar = e.enfocar(); await tick(); assert.equal(e.estados[0].id, RESERVA);
  desenfocar(); existe = false; const cerrar = e.enfocar(); await tick();
  assert.equal(e.estados[0], null); assert.match(e.estados[2], /no est/);
  cerrar(); assert.deepEqual(e.suscripciones(), { altas: 2, bajas: 2 });
});

test('detalle taxista: no revive datos anteriores tras desmontarse', async () => {
  const lenta = diferida(), e = entornoDetalle('taxista', () => lenta.promesa);
  const cerrar = e.enfocar(); cerrar(); lenta.resolver({ id: RESERVA }); await tick();
  assert.equal(e.estados[0], null);
});
