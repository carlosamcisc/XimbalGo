const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const tick = () => new Promise(resolve => setImmediate(resolve));
const normalizar = valor => JSON.parse(JSON.stringify(valor));
function cargar(archivo, modulos, extras = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(archivo, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText, { exports, require: nombre => {
    assert.ok(modulos[nombre], nombre); return modulos[nombre];
  }, ...extras });
  return exports;
}
function diferida() {
  let resolver; const promesa = new Promise(resolve => { resolver = resolve; });
  return { promesa, resolver };
}
// Ejecuta las transiciones de los hooks sin cargar módulos nativos en Node.
function runtime() {
  let cursor = 0, pendientes = [], resultado, ejecutar;
  const slots = [];
  const mismos = (a, b) => a && b && a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
  const react = {
    useState: inicial => {
      const i = cursor++;
      if (!slots[i]) slots[i] = { valor: typeof inicial === 'function' ? inicial() : inicial };
      return [slots[i].valor, valor => { slots[i].valor = typeof valor === 'function' ? valor(slots[i].valor) : valor; }];
    },
    useRef: current => { const i = cursor++; return (slots[i] ??= { current }); },
    useCallback: (fn, deps) => {
      const i = cursor++;
      if (!mismos(slots[i]?.deps, deps)) slots[i] = { deps, valor: fn };
      return slots[i].valor;
    },
    useEffect: (fn, deps) => {
      const i = cursor++;
      if (!mismos(slots[i]?.deps, deps)) {
        pendientes.push(() => { slots[i]?.limpiar?.(); slots[i] = { deps, limpiar: fn() }; });
      }
    },
  };
  const render = () => {
    cursor = 0; pendientes = []; resultado = ejecutar(); pendientes.forEach(fn => fn()); return resultado;
  };
  return { react, navegar: { useFocusEffect: fn => react.useEffect(fn, [fn]) },
    montar: fn => { ejecutar = fn; return render(); }, render,
    blur: () => { for (const s of slots) if (s && Object.hasOwn(s, 'limpiar')) { s.limpiar?.(); s.deps = null; s.limpiar = null; } },
  };
}
const defaults = { push_habilitado: true, reservas: true, llegada: true, viajes: true };

function preferencias(opciones = {}) {
  const h = runtime(), eventos = [], avisos = [];
  let auth = { usuario: { id: 'cliente' }, rol: 'cliente' };
  let datos = { ...defaults }, permiso = 'permitido', app;
  const api = cargar('src/screens/compartidas/usePreferenciasNotificaciones.ts', {
    react: h.react, '@react-navigation/native': h.navegar,
    'react-native': { AppState: { addEventListener: (_evento, fn) => { app = fn; return { remove: () => { app = null; } }; } },
      Linking: { openSettings: async () => { eventos.push('ajustes'); if (opciones.errorAjustes) throw Error('error'); } } },
    '../../store/autenticacionStore': { useAutenticacionStore: () => auth, obtenerEstadoAutenticacion: () => auth },
    '../../infrastructure/supabase/repositories/preferenciasNotificaciones.repository': {
      obtenerPreferenciasNotificaciones: async id => {
        eventos.push(['leer', id]); if (opciones.leer) return opciones.leer(); return { ...datos };
      },
      guardarPreferenciaNotificaciones: async (id, campo, valor) => {
        eventos.push(['guardar', id, campo, valor]);
        if (opciones.guardar) return opciones.guardar(id, campo, valor);
        datos = { ...datos, [campo]: valor }; return datos;
      },
    },
    '../../infrastructure/notifications/permisoPush': { obtenerPermisoPush: async () => permiso },
    '../../infrastructure/notifications/registroPush.service': { sincronizarDispositivoPush: async (...args) => {
      eventos.push(['activar', ...args]); if (opciones.activar) await opciones.activar();
    } },
    '../../components/ToastMessaje': { ToastMessage: { show: mensaje => avisos.push(mensaje) } },
  });
  h.montar(() => api.usePreferenciasNotificaciones());
  return { ...h, eventos, avisos,
    cambiarCuenta: id => { auth = { ...auth, usuario: { id } }; },
    permiso: valor => { permiso = valor; }, app: estado => app?.(estado) };
}

test('preferencias: carga las elecciones del usuario y el permiso del teléfono', async () => {
  const e = preferencias(); await tick(); const estado = e.render();
  assert.deepEqual(normalizar(estado.preferencias), defaults);
  assert.equal(estado.permiso, 'permitido'); assert.equal(estado.cargando, false);
});

test('preferencias: guarda un solo campo y conserva las otras elecciones', async () => {
  const e = preferencias(); await tick();
  await e.render().cambiar('llegada', false); const estado = e.render();
  assert.deepEqual(normalizar(estado.preferencias), { ...defaults, llegada: false });
  assert.deepEqual(e.eventos.find(x => x[0] === 'guardar'), ['guardar', 'cliente', 'llegada', false]);
});

test('preferencias: no acepta dos cambios simultáneos', async () => {
  const lenta = diferida(), e = preferencias({ guardar: () => lenta.promesa }); await tick();
  const estado = e.render(), primera = estado.cambiar('llegada', false);
  await estado.cambiar('reservas', false);
  assert.equal(e.eventos.filter(x => x[0] === 'guardar').length, 1);
  lenta.resolver({ ...defaults, llegada: false }); await primera;
  assert.equal(e.render().ocupado, false);
});

test('preferencias: un fallo de red vuelve a consultar el estado real sin fingir éxito', async () => {
  const e = preferencias({ guardar: async () => { throw Error('red'); } }); await tick();
  await e.render().cambiar('push_habilitado', false);
  assert.equal(e.render().preferencias.push_habilitado, true); assert.equal(e.avisos.length, 1);
  assert.equal(e.eventos.filter(x => x[0] === 'leer').length, 2);
});

test('preferencias: no permite guardar si falla la carga inicial', async () => {
  const e = preferencias({ leer: async () => { throw Error('sin red'); } }); await tick();
  const estado = e.render(); assert.equal(estado.preferencias, null); assert.ok(estado.error);
  await estado.cambiar('llegada', false); assert.equal(e.eventos.filter(x => x[0] === 'guardar').length, 0);
});

test('preferencias: descarta lecturas que terminan después de cambiar de cuenta', async () => {
  const lenta = diferida(), e = preferencias({ leer: () => lenta.promesa });
  e.cambiarCuenta('otro'); lenta.resolver(defaults); await tick();
  assert.equal(e.render().preferencias, null);
});

test('preferencias: un callback anterior no guarda en una cuenta nueva', async () => {
  const e = preferencias(); await tick(); const anterior = e.render();
  e.cambiarCuenta('otro'); await anterior.cambiar('reservas', false);
  assert.equal(e.eventos.filter(x => x[0] === 'guardar').length, 0);
});

test('preferencias: salir y volver durante una escritura no deja los controles bloqueados', async () => {
  const lenta = diferida(), e = preferencias({ guardar: () => lenta.promesa }); await tick();
  const pendiente = e.render().cambiar('llegada', false); e.blur();
  lenta.resolver({ ...defaults, llegada: false }); await pendiente;
  e.render(); await tick(); assert.equal(e.render().ocupado, false);
});

test('preferencias: la activación es explícita y actualiza el permiso tras volver de Ajustes', async () => {
  const e = preferencias(); await tick(); await e.render().activar();
  const llamada = e.eventos.find(x => x[0] === 'activar');
  assert.deepEqual(llamada, ['activar', 'cliente', true, undefined, true]);
  await e.render().abrirAjustes(); e.permiso('bloqueado'); e.app('active'); await tick();
  assert.equal(e.render().permiso, 'bloqueado'); assert.ok(e.eventos.includes('ajustes'));
});

test('preferencias: informa si falla activar o abrir ajustes y libera los controles', async () => {
  const e = preferencias({ activar: async () => { throw Error('token'); }, errorAjustes: true }); await tick();
  await e.render().activar(); await e.render().abrirAjustes();
  assert.equal(e.render().ocupado, false); assert.equal(e.avisos.length, 2);
});

test('permisos: diferencia autorización provisional, bloqueo, solicitud pendiente y Expo Go', async () => {
  for (const [config, esperado] of [
    [{ permisos: { granted: true } }, 'permitido'],
    [{ permisos: { granted: false, ios: { status: 3 } } }, 'provisional'],
    [{ permisos: { granted: false, canAskAgain: true } }, 'pendiente'],
    [{ permisos: { granted: false, canAskAgain: false } }, 'bloqueado'],
    [{ expoGo: true }, 'no_disponible'],
  ]) {
    const api = cargar('src/infrastructure/notifications/permisoPush.ts', {
      'expo-constants': { appOwnership: config.expoGo ? 'expo' : null },
      'expo-notifications': { IosAuthorizationStatus: { PROVISIONAL: 3 }, getPermissionsAsync: async () => config.permisos },
      'react-native': { Platform: { OS: 'android' } },
    });
    assert.equal(await api.obtenerPermisoPush(), esperado);
  }
});

test('repositorio de preferencias: usa valores predeterminados solo cuando no existe fila', async () => {
  let error = null, guardado;
  const consulta = { select: () => consulta, eq: (_campo, id) => { assert.equal(id, 'propietario'); return consulta; },
    abortSignal: () => consulta, maybeSingle: async () => ({ data: null, error }) };
  const api = cargar('src/infrastructure/supabase/repositories/preferenciasNotificaciones.repository.ts', {
    '../client': { supabase: { from: () => consulta, rpc: (_nombre, args) => {
      guardado = args; return { abortSignal: async () => ({ data: [defaults], error: null }) };
    } } },
    '../../../modules/notificaciones/types': { PREFERENCIAS_PREDETERMINADAS: defaults },
  }, { AbortController, setTimeout, clearTimeout });
  assert.deepEqual(normalizar(await api.obtenerPreferenciasNotificaciones('propietario')), defaults);
  error = Error('red'); await assert.rejects(api.obtenerPreferenciasNotificaciones('propietario'));
  await api.guardarPreferenciaNotificaciones('propietario', 'viajes', false);
  assert.deepEqual(normalizar(guardado), { p_usuario_id: 'propietario', p_campo: 'viajes', p_valor: false });
});

function bandeja(opciones = {}) {
  const h = runtime(), eventos = [];
  let usuario = 'taxista', notificar, app;
  const api = cargar('src/screens/compartidas/useBandejaNotificaciones.ts', {
    react: h.react,
    'react-native': { AppState: { addEventListener: (_evento, fn) => { app = fn; return { remove() { app = null; } }; } } },
    '../../store/autenticacionStore': { obtenerEstadoAutenticacion: () => ({ usuario: { id: usuario } }) },
    '../../infrastructure/supabase/repositories/notificaciones.repository': {
      obtenerBandejaNotificaciones: async id => {
        eventos.push(['leer', id]); return opciones.leer ? opciones.leer() : { notificaciones: [{ id: 'aviso', leida: false }], noLeidas: 71 };
      },
      marcarAvisosLeidos: async (...args) => { eventos.push(['marcar', ...args]); if (opciones.errorMarcar) throw Error('red'); },
      escucharNotificaciones: (_id, fn) => { notificar = fn; return () => { notificar = null; eventos.push('limpiar'); }; },
    },
  }, { setTimeout, clearTimeout });
  h.montar(() => api.useBandejaNotificaciones(usuario));
  return { ...h, eventos, cambiarCuenta: id => { usuario = id; }, notificar: () => notificar?.(), app: () => app?.('active') };
}

test('bandeja: el contador incluye avisos sin leer fuera de los últimos 50', async () => {
  const e = bandeja(); await tick(); const estado = e.render();
  assert.equal(estado.notificaciones.length, 1); assert.equal(estado.noLeidas, 71);
});

test('bandeja: marca un aviso o todos con el propietario explícito', async () => {
  const e = bandeja(); await tick();
  await e.render().marcarLeidas('aviso'); await e.render().marcarLeidas();
  assert.deepEqual(e.eventos.filter(x => x[0] === 'marcar'), [['marcar', 'taxista', 'aviso'], ['marcar', 'taxista', undefined]]);
});

test('bandeja: un fallo de lectura se informa sin inventar avisos', async () => {
  const e = bandeja({ leer: async () => { throw Error('red'); } }); await tick();
  assert.ok(e.render().error); assert.equal(e.render().cargando, false); assert.equal(e.render().notificaciones.length, 0);
});

test('bandeja: informa si no se confirmó marcar como leído y permite recargar', async () => {
  const e = bandeja({ errorMarcar: true }); await tick();
  assert.ok(await e.render().marcarLeidas('aviso')); await tick();
  assert.equal(e.render().notificaciones[0].leida, false);
});

test('bandeja: una respuesta tardía no añade avisos después de cambiar de cuenta', async () => {
  const lenta = diferida(), e = bandeja({ leer: () => lenta.promesa });
  e.cambiarCuenta('otro'); lenta.resolver({ notificaciones: [{ id: 'ajeno' }], noLeidas: 1 }); await tick();
  assert.equal(e.render().notificaciones.length, 0);
});

test('bandeja: volver al primer plano recarga y desmontar retira listeners', async () => {
  const e = bandeja(); await tick(); e.app(); await tick();
  assert.equal(e.eventos.filter(x => x[0] === 'leer').length, 2);
  e.blur(); e.app(); e.notificar(); await tick();
  assert.ok(e.eventos.includes('limpiar')); assert.equal(e.eventos.filter(x => x[0] === 'leer').length, 2);
});

test('bandeja: una respuesta anterior no reemplaza datos más recientes', async () => {
  const lenta = diferida(); let llamadas = 0;
  const e = bandeja({ leer: () => ++llamadas === 1 ? lenta.promesa : { notificaciones: [{ id: 'reciente' }], noLeidas: 0 } });
  e.app(); await tick(); lenta.resolver({ notificaciones: [{ id: 'viejo' }], noLeidas: 1 }); await tick();
  assert.equal(e.render().notificaciones[0].id, 'reciente');
});

test('bandeja: agrupa eventos Realtime sin abrir múltiples consultas', async () => {
  const e = bandeja(); await tick();
  e.notificar(); e.notificar(); e.notificar();
  await new Promise(resolve => setTimeout(resolve, 330));
  assert.equal(e.eventos.filter(x => x[0] === 'leer').length, 2); e.blur();
});

test('repositorio de bandeja: limita la lista, cuenta todo y marca solo al propietario', async () => {
  const operaciones = []; let errorTotal = null;
  const api = cargar('src/infrastructure/supabase/repositories/notificaciones.repository.ts', {
    '../client': { supabase: { from: tabla => {
      assert.equal(tabla, 'notificaciones'); const pasos = []; operaciones.push(pasos);
      let contar = false;
      const q = {
        select: (_campos, options) => { contar = options?.head ?? false; pasos.push(['select', contar]); return q; },
        eq: (...args) => { pasos.push(['eq', ...args]); return q; },
        order: () => q, limit: n => { pasos.push(['limit', n]); return q; }, abortSignal: () => q,
        update: valor => { pasos.push(['update', valor]); return q; },
        then: (ok, error) => Promise.resolve(contar ? { count: 91, error: errorTotal }
          : { data: [{ id: 'aviso', tipo: 'reserva_solicitada', reserva_id: 'reserva' }], error: null }).then(ok, error),
      }; return q;
    } } },
  }, { AbortController, setTimeout, clearTimeout });
  const datos = await api.obtenerBandejaNotificaciones('taxista');
  assert.equal(datos.noLeidas, 91); assert.equal(datos.notificaciones[0].reservaId, 'reserva');
  assert.ok(operaciones[0].some(p => p[0] === 'limit' && p[1] === 50));
  assert.ok(operaciones[1].some(p => p[0] === 'eq' && p[1] === 'leida' && p[2] === false));
  await api.marcarAvisosLeidos('taxista');
  for (const pasos of operaciones) assert.ok(pasos.some(p => p[0] === 'eq' && p[1] === 'usuario_id' && p[2] === 'taxista'));
  assert.equal(operaciones[2].some(p => p[0] === 'eq' && p[1] === 'id'), false);
  errorTotal = Error('Sin conteo'); await assert.rejects(api.obtenerBandejaNotificaciones('taxista'));
});
