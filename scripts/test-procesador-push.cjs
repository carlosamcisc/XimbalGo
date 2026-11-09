const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const { webcrypto } = require('node:crypto');

const api = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('supabase/functions/enviar-notificaciones/procesador.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, { exports: api, Request, Response, AbortSignal, TextEncoder, Uint8Array, crypto: webcrypto });

const config = {
  proyectoId: '4cd2f8ae-8267-4756-a608-c7fe9711ccc4',
  entornos: ['development'], secreto: 's'.repeat(48), habilitado: true,
};
const ahora = Date.parse('2026-11-07T12:00:00Z');
function trabajo(cambios = {}) {
  return {
    id: 'envio', bloqueo_id: 'bloqueo', token_destino: 'ExpoPushToken[prueba]',
    notificacion_id: 'notificacion', reserva_id: 'reserva', tipo: 'reserva_aceptada',
    titulo: 'Reserva aceptada', mensaje: 'Prepárate.', ticket_expo: null,
    vence_en: '2026-11-07T13:00:00Z', ...cambios,
  };
}
function entorno({ envios = [], recibos = [], respuestas = [], resuelto = true } = {}) {
  const llamadas = [], resoluciones = [], http = [];
  const deps = {
    ahora: () => ahora,
    rpc: async (nombre, argumentos) => {
      llamadas.push({ nombre, argumentos });
      if (nombre === 'reclamar_envios_push') return argumentos.p_recibos ? recibos : envios;
      assert.equal(nombre, 'resolver_envio_push');
      resoluciones.push(argumentos);
      return resuelto;
    },
    fetch: async (url, opciones) => {
      http.push({ url, opciones, body: JSON.parse(opciones.body) });
      assert.ok(respuestas.length, 'Petición HTTP inesperada');
      const siguiente = respuestas.shift();
      if (siguiente instanceof Error) throw siguiente;
      return new Response(JSON.stringify(siguiente.body ?? siguiente), { status: siguiente.status ?? 200 });
    },
  };
  return { deps, llamadas, resoluciones, http, ejecutar: (extra = {}) => api.procesarPush(deps, { ...config, ...extra }) };
}

test('sin trabajos no consulta Expo y reclama solo el proyecto y entorno configurados', async () => {
  const e = entorno();
  await e.ejecutar();
  assert.equal(e.http.length, 0);
  assert.equal(e.llamadas.length, 2);
  assert.ok(e.llamadas.every(c => c.argumentos.p_proyecto_id === config.proyectoId
    && c.argumentos.p_entorno === 'development' && c.argumentos.p_limite === 50));
});

test('envía payload de reserva y persiste el ticket con el bloqueo correcto', async () => {
  const e = entorno({ envios: [trabajo()], respuestas: [{ data: [{ status: 'ok', id: 'ticket' }] }] });
  const resultado = await e.ejecutar({ accessToken: 'secreto-expo' });
  assert.equal(resultado.enviados, 1);
  assert.equal(e.http[0].url, 'https://exp.host/--/api/v2/push/send');
  assert.equal(e.http[0].opciones.headers.Authorization, 'Bearer secreto-expo');
  assert.deepEqual(e.http[0].body[0].data, { notificacionId: 'notificacion', reservaId: 'reserva', tipo: 'reserva_aceptada' });
  assert.equal(e.http[0].body[0].channelId, 'reservas');
  assert.equal(e.http[0].body[0].ttl, 3600);
  assert.equal(e.resoluciones[0].p_bloqueo_id, 'bloqueo');
  assert.equal(e.resoluciones[0].p_ticket, 'ticket');
});

test('cada ticket se asocia al trabajo correcto aunque un dispositivo falle', async () => {
  const e = entorno({ envios: [trabajo({ id: 'uno' }), trabajo({ id: 'dos' })], respuestas: [{ data: [
    { status: 'error', details: { error: 'DeviceNotRegistered' } }, { status: 'ok', id: 'ticket-dos' },
  ] }] });
  await e.ejecutar();
  assert.equal(e.resoluciones[0].p_id, 'uno');
  assert.equal(e.resoluciones[0].p_accion, 'dispositivo_invalido');
  assert.equal(e.resoluciones[1].p_id, 'dos');
  assert.equal(e.resoluciones[1].p_ticket, 'ticket-dos');
});

for (const status of [429, 500, 503]) {
  test(`un HTTP ${status} programa reintento sin inventar un ticket`, async () => {
    const e = entorno({ envios: [trabajo()], respuestas: [{ status, body: {} }] });
    await e.ejecutar();
    assert.equal(e.resoluciones[0].p_accion, 'reintentar');
    assert.equal(e.resoluciones[0].p_ticket, null);
  });
}
for (const status of [400, 401, 403]) {
  test(`un HTTP ${status} queda en error para revisión`, async () => {
    const e = entorno({ envios: [trabajo()], respuestas: [{ status, body: {} }] });
    await e.ejecutar();
    assert.equal(e.resoluciones[0].p_accion, 'error');
  });
}

test('un corte de red no pierde el trabajo y no guarda errores con datos sensibles', async () => {
  const e = entorno({ envios: [trabajo()], respuestas: [new Error('ExpoPushToken[secreto]')] });
  await e.ejecutar();
  assert.equal(e.resoluciones[0].p_accion, 'reintentar');
  assert.equal(e.resoluciones[0].p_codigo, 'ExpoNoDisponible');
});

test('una respuesta incompleta no desplaza tickets entre destinatarios', async () => {
  const e = entorno({ envios: [trabajo({ id: 'uno' }), trabajo({ id: 'dos' })],
    respuestas: [{ data: [{ status: 'ok', id: 'ambiguo' }] }] });
  await e.ejecutar();
  assert.ok(e.resoluciones.every(r => r.p_accion === 'reintentar' && r.p_ticket === null));
});

test('un ticket ok sin id no se registra como enviado', async () => {
  const e = entorno({ envios: [trabajo()], respuestas: [{ data: [{ status: 'ok' }] }] });
  await e.ejecutar();
  assert.equal(e.resoluciones[0].p_accion, 'reintentar');
});

test('consulta recibos sin reenviar el mensaje y confirma el éxito del proveedor', async () => {
  const e = entorno({ recibos: [trabajo({ ticket_expo: 'ticket' })], respuestas: [{ data: { ticket: { status: 'ok' } } }] });
  const resumen = await e.ejecutar();
  assert.equal(resumen.confirmados, 1);
  assert.equal(e.http.length, 1);
  assert.ok(e.http[0].url.endsWith('/getReceipts'));
  assert.deepEqual(e.http[0].body, { ids: ['ticket'] });
});

test('un recibo ausente sigue esperando y nunca vuelve a enviar por ese motivo', async () => {
  const e = entorno({ recibos: [trabajo({ ticket_expo: 'ticket' })], respuestas: [{ data: {} }] });
  await e.ejecutar();
  assert.equal(e.resoluciones[0].p_accion, 'esperar_recibo');
  assert.ok(e.http.every(r => r.url.endsWith('/getReceipts')));
});

test('un fallo temporal al consultar recibos no reenvía mensajes ya aceptados', async () => {
  const e = entorno({ recibos: [trabajo({ ticket_expo: 'ticket' })], respuestas: [{ status: 503, body: {} }] });
  await e.ejecutar();
  assert.equal(e.resoluciones[0].p_accion, 'esperar_recibo');
});

for (const [codigo, accion] of [
  ['DeviceNotRegistered', 'dispositivo_invalido'], ['MessageRateExceeded', 'reintentar'],
  ['InvalidCredentials', 'error'], ['MismatchSenderId', 'error'], ['MessageTooBig', 'error'],
]) {
  test(`clasifica el recibo ${codigo}`, async () => {
    const e = entorno({ recibos: [trabajo({ ticket_expo: 'ticket' })],
      respuestas: [{ data: { ticket: { status: 'error', details: { error: codigo } } } }] });
    await e.ejecutar();
    assert.equal(e.resoluciones[0].p_accion, accion);
    assert.equal(e.resoluciones[0].p_codigo, codigo);
  });
}

test('un aviso vencido no se manda a Expo', async () => {
  const e = entorno({ envios: [trabajo({ vence_en: '2026-11-07T11:00:00Z' })] });
  await e.ejecutar();
  assert.equal(e.http.length, 0);
  assert.equal(e.resoluciones[0].p_codigo, 'EnvioVencido');
});

test('acota textos largos Unicode para respetar los 4096 bytes del payload', async () => {
  const e = entorno({ envios: [trabajo({ titulo: '🚕'.repeat(200), mensaje: '🚕'.repeat(5000) })],
    respuestas: [{ data: [{ status: 'ok', id: 'ticket' }] }] });
  await e.ejecutar();
  assert.ok(Buffer.byteLength(JSON.stringify(e.http[0].body[0])) <= 4096);
});

test('no informa éxito si otro trabajador invalidó el bloqueo', async () => {
  const e = entorno({ envios: [trabajo()], respuestas: [{ data: [{ status: 'ok', id: 'ticket' }] }], resuelto: false });
  const resumen = await e.ejecutar();
  assert.equal(resumen.enviados, 0);
  assert.equal(resumen.ignorados, 1);
});

test('un payload excesivo no bloquea el envío de los demás destinatarios', async () => {
  const e = entorno({ envios: [trabajo({ id: 'excesivo', token_destino: 'x'.repeat(5000) }), trabajo({ id: 'normal' })],
    respuestas: [{ data: [{ status: 'ok', id: 'ticket-normal' }] }] });
  await e.ejecutar();
  assert.equal(e.resoluciones[0].p_codigo, 'MessageTooBig');
  assert.equal(e.http[0].body.length, 1);
  assert.equal(e.resoluciones[1].p_id, 'normal');
  assert.equal(e.resoluciones[1].p_ticket, 'ticket-normal');
});

test('el endpoint rechaza llamadas de clientes y no consulta la cola', async () => {
  const e = entorno();
  const handler = api.crearHandler(config, e.deps);
  const respuesta = await handler(new Request('https://worker', {
    method: 'POST', headers: { Authorization: 'Bearer jwt-cliente' },
  }));
  assert.equal(respuesta.status, 401);
  assert.equal(e.llamadas.length, 0);
});

test('el interruptor desactivado no reclama ni envía aunque la clave sea correcta', async () => {
  const e = entorno();
  const respuesta = await api.crearHandler({ ...config, habilitado: false }, e.deps)(new Request('https://worker', {
    method: 'POST', headers: { Authorization: `Bearer ${config.secreto}` },
  }));
  assert.equal(respuesta.status, 200);
  assert.equal(e.llamadas.length, 0);
});

test('el cuerpo externo no puede elegir destinatarios, proyecto ni mensaje', async () => {
  const e = entorno();
  const respuesta = await api.crearHandler(config, e.deps)(new Request('https://worker', {
    method: 'POST', headers: { Authorization: `Bearer ${config.secreto}` },
    body: JSON.stringify({ proyectoId: 'otro', to: 'ExpoPushToken[ajeno]', body: 'inyectado' }),
  }));
  assert.equal(respuesta.status, 200);
  assert.ok(e.llamadas.every(c => c.argumentos.p_proyecto_id === config.proyectoId));
  assert.equal(e.http.length, 0);
});

test('un servidor sin secretos no admite invocaciones', async () => {
  const e = entorno();
  const respuesta = await api.crearHandler({ ...config, secreto: '' }, e.deps)(new Request('https://worker', { method: 'POST' }));
  assert.equal(respuesta.status, 503);
  assert.equal(e.llamadas.length, 0);
});

test('los fallos del backend muestran solo un código controlado a llamadas autorizadas', async () => {
  const e = entorno();
  e.deps.rpc = async () => { throw new api.ErrorBackendPush('RPC_RECLAMAR_ENVIOS_PUSH_403_42501'); };
  const respuesta = await api.crearHandler(config, e.deps)(new Request('https://worker', {
    method: 'POST', headers: { Authorization: `Bearer ${config.secreto}` },
  }));
  assert.equal(respuesta.status, 500);
  assert.equal((await respuesta.json()).codigo, 'RPC_RECLAMAR_ENVIOS_PUSH_403_42501');
  assert.equal(new api.ErrorBackendPush('ExpoPushToken[privado]').codigo, 'BACKEND_PUSH');
});

test('el adaptador REST selecciona public explícitamente y no publica el error crudo', async () => {
  let rpc;
  let llamada;
  let status = 200;
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('supabase/functions/enviar-notificaciones/index.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, {
    exports: {}, AbortSignal,
    require: nombre => {
      assert.equal(nombre, './procesador.ts');
      return { ...api, crearHandler: (_config, deps) => { rpc = deps.rpc; return () => {}; } };
    },
    Deno: { env: { get: nombre => ({ SUPABASE_URL: 'https://base.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'clave-privada' })[nombre] },
      serve: () => {} },
    fetch: async (url, opciones) => {
      llamada = { url, opciones };
      return new Response(JSON.stringify(status === 200 ? [] : { code: 'PGRST202', message: 'mensaje privado' }), { status });
    },
  });
  await rpc('reclamar_envios_push', { p_entorno: 'development' });
  assert.equal(llamada.opciones.headers['Content-Profile'], 'public');
  assert.equal(llamada.opciones.headers['Accept-Profile'], 'public');
  status = 404;
  await assert.rejects(rpc('reclamar_envios_push', {}), error => {
    assert.equal(error.codigo, 'RPC_RECLAMAR_ENVIOS_PUSH_404_PGRST202');
    assert.ok(!error.message.includes('mensaje privado'));
    return true;
  });
});
