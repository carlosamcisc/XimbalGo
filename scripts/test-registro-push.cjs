const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function diferida() {
  let resolver;
  const promesa = new Promise(resolve => { resolver = resolve; });
  return { promesa, resolver };
}

function entorno(opciones = {}) {
  const valores = new Map();
  const eventos = [];
  const registros = [];
  let usuario = 'cliente';
  let permiso = opciones.permiso ?? { granted: true, canAskAgain: true };
  const notificaciones = {
    AndroidImportance: { HIGH: 4 }, IosAuthorizationStatus: { PROVISIONAL: 3 },
    setNotificationChannelAsync: async (_id, canal) => {
      assert.equal(Object.hasOwn(canal, 'sound'), false, 'El sonido del sistema se solicita omitiendo sound');
      eventos.push('canal');
    },
    getPermissionsAsync: async () => permiso,
    requestPermissionsAsync: async () => {
      eventos.push('permiso');
      permiso = { granted: true, canAskAgain: true };
      return permiso;
    },
    getExpoPushTokenAsync: async config => {
      eventos.push('token');
      return opciones.token ? opciones.token(config) : { data: 'ExpoPushToken[prueba]' };
    },
  };
  const modulos = {
    '@react-native-async-storage/async-storage': {
      getItem: async clave => valores.get(clave) ?? null,
      setItem: async (clave, valor) => valores.set(clave, valor),
    },
    'expo-constants': { appOwnership: opciones.expoGo ? 'expo' : null,
      expoConfig: { extra: { eas: { projectId: 'proyecto' }, pushEnvironment: 'development' } } },
    'expo-crypto': { randomUUID: () => 'instalacion' },
    'expo-notifications': notificaciones,
    'react-native': { Platform: { OS: opciones.plataforma ?? 'android' },
      Alert: { alert: (_titulo, _mensaje, botones) => {
        eventos.push('explicacion');
        botones[opciones.acepta === false ? 0 : 1].onPress();
      } } },
    '../../modules/cliente/tiempoLimite': { conTiempoLimite: promesa => promesa },
    '../supabase/client': { supabase: { auth: {
      getSession: async () => ({ data: { session: { user: { id: usuario } } } }),
    } } },
    '../supabase/repositories/dispositivosPush.repository': {
      guardarDispositivoPush: async registro => {
        eventos.push('guardar');
        registros.push(registro);
        if (opciones.escritura) await opciones.escritura();
      },
      eliminarDispositivoPush: async (id, instalacion) => eventos.push(`eliminar:${id}:${instalacion}`),
    },
  };
  const codigo = ts.transpileModule(fs.readFileSync('src/infrastructure/notifications/registroPush.service.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const exports = {};
  vm.runInNewContext(codigo, { exports, require: nombre => {
    assert.ok(modulos[nombre], nombre);
    return modulos[nombre];
  } });
  exports.establecerUsuarioPush(usuario);
  return { api: exports, eventos, valores, registros,
    cambiarSesion: id => { usuario = id; }, cambiarPermiso: valor => { permiso = valor; } };
}

test('registra token, proyecto, entorno e instalación estable sin volver a pedir permiso', async () => {
  const e = entorno();
  await e.api.sincronizarDispositivoPush('cliente', true);
  await e.api.sincronizarDispositivoPush('cliente', true);
  assert.equal(e.registros.length, 2);
  assert.equal(e.registros[0].instalacion_id, e.registros[1].instalacion_id);
  assert.equal(e.registros[0].usuario_id, 'cliente');
  assert.equal(e.registros[0].entorno, 'development');
  assert.equal(e.registros[0].proyecto_id, 'proyecto');
  assert.ok(!e.eventos.includes('permiso'));
});

test('explica antes del permiso y crea el canal Android primero', async () => {
  const e = entorno({ permiso: { granted: false, canAskAgain: true } });
  await e.api.sincronizarDispositivoPush('cliente', true);
  assert.deepEqual(e.eventos.slice(0, 4), ['canal', 'explicacion', 'permiso', 'token']);
  assert.equal(e.registros.length, 1);
});

test('Ahora no no registra ni vuelve a mostrar el diálogo al regresar', async () => {
  const e = entorno({ permiso: { granted: false, canAskAgain: true }, acepta: false });
  await e.api.sincronizarDispositivoPush('cliente', true);
  await e.api.sincronizarDispositivoPush('cliente', true);
  assert.equal(e.eventos.filter(x => x === 'explicacion').length, 1);
  assert.equal(e.registros.length, 0);
  assert.ok(!e.eventos.includes('permiso'));
});

test('activar desde preferencias permite pedir permiso después de Ahora no', async () => {
  const e = entorno({ permiso: { granted: false, canAskAgain: true }, acepta: false });
  await e.api.sincronizarDispositivoPush('cliente', true);
  await e.api.sincronizarDispositivoPush('cliente', true, undefined, true);
  assert.equal(e.eventos.filter(x => x === 'explicacion').length, 1);
  assert.equal(e.eventos.filter(x => x === 'permiso').length, 1);
  assert.equal(e.registros.length, 1);
});

test('no insiste con permisos bloqueados', async () => {
  const e = entorno({ permiso: { granted: false, canAskAgain: false } });
  await e.api.sincronizarDispositivoPush('cliente', true);
  assert.deepEqual(e.eventos, ['canal']);
});

test('acepta permiso provisional iOS sin crear canales Android', async () => {
  const e = entorno({ plataforma: 'ios', permiso: { granted: false, ios: { status: 3 } } });
  await e.api.sincronizarDispositivoPush('cliente');
  assert.deepEqual(e.eventos, ['token', 'guardar']);
});

for (const opciones of [{ plataforma: 'web' }, { expoGo: true }]) {
  test(`no registra en ${JSON.stringify(opciones)}`, async () => {
    const e = entorno(opciones);
    await e.api.sincronizarDispositivoPush('cliente', true);
    assert.deepEqual(e.eventos, []);
  });
}

test('revocar permiso elimina únicamente la instalación de la cuenta activa', async () => {
  const e = entorno();
  await e.api.sincronizarDispositivoPush('cliente');
  e.cambiarPermiso({ granted: false, canAskAgain: false });
  await e.api.sincronizarDispositivoPush('cliente');
  assert.equal(e.eventos.at(-1), 'eliminar:cliente:instalacion');
  assert.equal(e.registros.length, 1);
});

test('un token que termina después de cerrar sesión no vuelve a registrar al usuario', async () => {
  const token = diferida();
  const obtenido = diferida();
  const e = entorno({ token: () => { obtenido.resolver(); return token.promesa; } });
  const registro = e.api.sincronizarDispositivoPush('cliente');
  await obtenido.promesa;
  await e.api.desvincularDispositivoPush('cliente');
  token.resolver({ data: 'ExpoPushToken[tardio]' });
  await registro;
  assert.equal(e.registros.length, 0);
  assert.equal(e.eventos.at(-1), 'eliminar:cliente:instalacion');
});

test('el cierre espera una escritura iniciada antes de eliminar el dispositivo', async () => {
  const escritura = diferida();
  const iniciada = diferida();
  const e = entorno({ escritura: () => { iniciada.resolver(); return escritura.promesa; } });
  const registro = e.api.sincronizarDispositivoPush('cliente');
  await iniciada.promesa;
  const cierre = e.api.desvincularDispositivoPush('cliente');
  assert.equal(e.eventos.at(-1), 'guardar');
  escritura.resolver();
  await Promise.all([registro, cierre]);
  assert.equal(e.eventos.at(-1), 'eliminar:cliente:instalacion');
});

test('descarta el registro si la sesión cambió durante la obtención del token', async () => {
  const e = entorno({ token: async () => {
    e.cambiarSesion('taxista');
    return { data: 'ExpoPushToken[otraSesion]' };
  } });
  await e.api.sincronizarDispositivoPush('cliente');
  assert.equal(e.registros.length, 0);
});

test('un fallo temporal permite reintentar con la misma instalación', async () => {
  let intentos = 0;
  const e = entorno({ token: async () => {
    if (++intentos === 1) throw new Error('Sin conexión');
    return { data: 'ExpoPushToken[reintento]' };
  } });
  await assert.rejects(e.api.sincronizarDispositivoPush('cliente'), /Sin conexión/);
  await e.api.sincronizarDispositivoPush('cliente');
  assert.equal(e.registros.length, 1);
});

function hook(estadoInicial = 'active', operacion = async () => {}) {
  const llamadas = [];
  let alCambiar;
  let alRotar;
  let limpiar;
  const modulos = {
    react: { useEffect: fn => { limpiar = fn(); } },
    'react-native': { Platform: { OS: 'ios' }, AppState: {
      currentState: estadoInicial,
      addEventListener: (_evento, fn) => { alCambiar = fn; return { remove: () => { alCambiar = null; } }; },
    } },
    'expo-constants': { appOwnership: null },
    'expo-notifications': { addPushTokenListener: fn => {
      alRotar = fn; return { remove: () => { alRotar = null; } };
    } },
    '../../components/ToastMessaje': { ToastMessage: { show: () => {} } },
    './registroPush.service': {
      establecerUsuarioPush: () => {},
      sincronizarDispositivoPush: async (id, pedir, tokenNativo) => {
        llamadas.push({ id, pedir, tokenNativo }); await operacion(tokenNativo);
      },
    },
  };
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/infrastructure/notifications/useRegistroPush.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText, { exports, require: nombre => {
    assert.ok(modulos[nombre], nombre);
    return modulos[nombre];
  } });
  exports.useRegistroPush('cliente');
  return { llamadas, estado: valor => alCambiar?.(valor),
    rotar: (token = { type: 'ios', data: 'token-nativo' }) => alRotar?.(token), limpiar: () => limpiar() };
}

test('espera el primer plano si se restaura la sesión con la app inactiva', async () => {
  const h = hook('inactive');
  assert.equal(h.llamadas.length, 0);
  h.estado('active');
  assert.equal(h.llamadas.length, 1);
  assert.equal(h.llamadas[0].pedir, true);
  h.limpiar();
});

test('los diálogos iOS no repiten el registro, regresar de background sí lo hace', async () => {
  const h = hook();
  await new Promise(setImmediate);
  h.estado('inactive');
  h.estado('active');
  assert.equal(h.llamadas.length, 1);
  h.estado('background');
  h.estado('inactive');
  h.estado('active');
  assert.equal(h.llamadas.length, 2);
  h.limpiar();
});

test('agrupa rotaciones de token pendientes y elimina listeners al desmontarse', async () => {
  const pendiente = diferida();
  const h = hook('active', () => pendiente.promesa);
  h.rotar();
  h.rotar();
  assert.equal(h.llamadas.length, 1);
  pendiente.resolver();
  await new Promise(setImmediate);
  assert.equal(h.llamadas.length, 2);
  assert.equal(h.llamadas[1].pedir, false);
  assert.equal(h.llamadas[1].tokenNativo.data, 'token-nativo');
  h.limpiar();
  h.rotar();
  h.estado('background');
  h.estado('active');
  assert.equal(h.llamadas.length, 2);
});

test('reutiliza el token nativo del listener al solicitar el token Expo', async () => {
  const nativo = { type: 'android', data: 'fcm-renovado' };
  const e = entorno({ token: async config => {
    assert.equal(config.devicePushToken, nativo);
    return { data: 'ExpoPushToken[renovado]' };
  } });
  await e.api.sincronizarDispositivoPush('cliente', false, nativo);
  assert.equal(e.registros.length, 1);
});

test('el evento provocado por obtener el token inicial no genera un bucle de renovaciones', async () => {
  let consultasNativas = 0;
  const h = hook('active', async tokenNativo => {
    await Promise.resolve();
    if (!tokenNativo && ++consultasNativas < 5) h.rotar();
  });
  await new Promise(setImmediate);
  assert.equal(consultasNativas, 1);
  assert.equal(h.llamadas.length, 2);
  h.limpiar();
});

test('al arrancar instala la presentación de la aceptación antes de montar la app', async () => {
  const eventos = [];
  let handler;
  const compilar = archivo => ts.transpileModule(fs.readFileSync(archivo, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(compilar('index.ts'), {
    exports: {}, require: nombre => {
      if (nombre === 'expo') return { registerRootComponent: () => eventos.push('montar') };
      if (nombre === './src/infrastructure/location/background-location.service') return {};
      if (nombre === './App') return { default: () => {} };
      assert.equal(nombre, './src/infrastructure/notifications/presentacionPush');
      vm.runInNewContext(compilar('src/infrastructure/notifications/presentacionPush.ts'), {
        exports: {}, require: dependencia => {
          if (dependencia === 'react-native') return { Platform: { OS: 'android' } };
          assert.equal(dependencia, 'expo-notifications');
          return { setNotificationHandler: valor => { handler = valor; eventos.push('presentacion'); } };
        },
      });
      return {};
    },
  });
  assert.deepEqual(eventos, ['presentacion', 'montar']);
  const comportamiento = await handler.handleNotification({ request: { content: {
    title: 'Reserva aceptada', data: { tipo: 'reserva_aceptada', reservaId: 'reserva' },
  } } });
  assert.equal(comportamiento.shouldShowBanner, true);
  assert.equal(comportamiento.shouldShowList, true);
  assert.equal(comportamiento.shouldPlaySound, true);
});
