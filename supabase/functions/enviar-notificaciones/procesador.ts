export interface TrabajoPush {
  id: string;
  bloqueo_id: string;
  token_destino: string;
  notificacion_id: string;
  reserva_id: string | null;
  tipo: string;
  titulo: string;
  mensaje: string;
  ticket_expo: string | null;
  vence_en: string;
}

export type Rpc = <T>(nombre: string, argumentos: Record<string, unknown>) => Promise<T>;
export interface DependenciasPush {
  rpc: Rpc;
  fetch: typeof fetch;
  ahora?: () => number;
}
export interface ConfiguracionPush {
  proyectoId: string;
  entornos: string[];
  accessToken?: string;
}
// Solo códigos de diagnóstico controlados; nunca mensajes crudos de la API.
export class ErrorBackendPush extends Error {
  readonly codigo: string;
  constructor(codigo: string) {
    super('OperacionPushFallida');
    this.codigo = /^[A-Z0-9_]{1,100}$/.test(codigo) ? codigo : 'BACKEND_PUSH';
  }
}
type Accion = 'enviado' | 'confirmado' | 'reintentar' | 'esperar_recibo' | 'error' | 'dispositivo_invalido';
type Objeto = Record<string, unknown>;
const objeto = (valor: unknown): valor is Objeto => typeof valor === 'object' && valor !== null && !Array.isArray(valor);
const texto = (valor: string, limite: number) => Array.from(valor).slice(0, limite).join('');
const EXPO_URL = 'https://exp.host/--/api/v2/push/';

function codigoExpo(valor: Objeto): string {
  const codigo = objeto(valor.details) ? valor.details.error : null;
  return typeof codigo === 'string' && [
    'DeviceNotRegistered', 'MessageTooBig', 'MessageRateExceeded',
    'MismatchSenderId', 'InvalidCredentials',
  ].includes(codigo) ? codigo : 'ExpoError';
}

export async function procesarPush(deps: DependenciasPush, config: ConfiguracionPush) {
  const resumen = { reclamados: 0, enviados: 0, confirmados: 0, reintentos: 0, errores: 0, ignorados: 0 };
  const ahora = deps.ahora ?? Date.now;
  const resolver = async (trabajo: TrabajoPush, accion: Accion, codigo?: string, ticket?: string) => {
    const aplicado = await deps.rpc<boolean>('resolver_envio_push', {
      p_id: trabajo.id, p_bloqueo_id: trabajo.bloqueo_id,
      p_accion: accion, p_codigo: codigo ?? null, p_ticket: ticket ?? null,
    });
    if (!aplicado) resumen.ignorados++;
    else if (accion === 'enviado') resumen.enviados++;
    else if (accion === 'confirmado') resumen.confirmados++;
    else if (accion === 'reintentar' || accion === 'esperar_recibo') resumen.reintentos++;
    else resumen.errores++;
  };
  const consultarExpo = async (ruta: string, cuerpo: unknown) => {
    try {
      const response = await deps.fetch(EXPO_URL + ruta, {
        method: 'POST', signal: AbortSignal.timeout(8_000),
        headers: {
          'Content-Type': 'application/json', Accept: 'application/json',
          ...(config.accessToken ? { Authorization: `Bearer ${config.accessToken}` } : {}),
        }, body: JSON.stringify(cuerpo),
      });
      if (!response.ok) return {
        datos: null, reintentar: response.status === 429 || response.status >= 500,
        codigo: `ExpoHttp${response.status}`,
      };
      const body: unknown = await response.json();
      return { datos: objeto(body) ? body.data : null, reintentar: true, codigo: 'RespuestaExpoInvalida' };
    } catch {
      // No registrar el error crudo: podría contener tokens o el payload.
      return { datos: null, reintentar: true, codigo: 'ExpoNoDisponible' };
    }
  };

  for (const entorno of config.entornos) {
    const reclamar = (recibos: boolean) => deps.rpc<TrabajoPush[]>('reclamar_envios_push', {
      p_proyecto_id: config.proyectoId, p_entorno: entorno, p_recibos: recibos, p_limite: 50,
    });
    const recibos = await reclamar(true);
    resumen.reclamados += recibos.length;
    if (recibos.length) {
      const respuesta = await consultarExpo('getReceipts', { ids: recibos.map(r => r.ticket_expo) });
      for (const trabajo of recibos) {
        if (!objeto(respuesta.datos)) {
          await resolver(trabajo, respuesta.reintentar ? 'esperar_recibo' : 'error', respuesta.codigo);
          continue;
        }
        const recibo = respuesta.datos[trabajo.ticket_expo!];
        if (!objeto(recibo) || !['ok', 'error'].includes(String(recibo.status))) {
          await resolver(trabajo, 'esperar_recibo', 'ReciboNoDisponible');
        } else if (recibo.status === 'ok') {
          await resolver(trabajo, 'confirmado');
        } else {
          const codigo = codigoExpo(recibo);
          await resolver(trabajo, codigo === 'DeviceNotRegistered' ? 'dispositivo_invalido'
            : codigo === 'MessageRateExceeded' ? 'reintentar' : 'error', codigo);
        }
      }
    }

    const reclamados = await reclamar(false);
    resumen.reclamados += reclamados.length;
    const trabajos: TrabajoPush[] = [];
    const mensajes: Objeto[] = [];
    for (const trabajo of reclamados) {
      const ttl = Math.floor((Date.parse(trabajo.vence_en) - ahora()) / 1_000);
      if (!Number.isFinite(ttl) || ttl <= 0) {
        await resolver(trabajo, 'error', 'EnvioVencido');
        continue;
      }
      const mensaje = {
        to: trabajo.token_destino, title: texto(trabajo.titulo, 160),
        body: texto(trabajo.mensaje, 600), channelId: 'reservas',
        // Aquí sound pertenece al payload Expo; no a la creación del canal.
        sound: 'default', priority: 'high', ttl: Math.min(ttl, 7_200),
        data: { notificacionId: trabajo.notificacion_id, reservaId: trabajo.reserva_id, tipo: trabajo.tipo },
      };
      if (new TextEncoder().encode(JSON.stringify(mensaje)).byteLength > 4096) {
        await resolver(trabajo, 'error', 'MessageTooBig');
        continue;
      }
      trabajos.push(trabajo);
      mensajes.push(mensaje);
    }
    if (!trabajos.length) continue;
    const respuesta = await consultarExpo('send', mensajes);
    // Expo conserva el orden. Si falta un ticket no arriesgar asociarlo a otro teléfono.
    const tickets = Array.isArray(respuesta.datos) && respuesta.datos.length === trabajos.length
      ? respuesta.datos : null;
    for (let i = 0; i < trabajos.length; i++) {
      const ticket: unknown = tickets?.[i];
      if (!objeto(ticket) || !['ok', 'error'].includes(String(ticket.status))) {
        await resolver(trabajos[i], respuesta.reintentar ? 'reintentar' : 'error', respuesta.codigo);
      } else if (ticket.status === 'ok' && typeof ticket.id === 'string' && ticket.id.length > 0 && ticket.id.length <= 200) {
        await resolver(trabajos[i], 'enviado', undefined, ticket.id);
      } else if (ticket.status === 'error') {
        const codigo = codigoExpo(ticket);
        await resolver(trabajos[i], codigo === 'DeviceNotRegistered' ? 'dispositivo_invalido'
          : codigo === 'MessageRateExceeded' ? 'reintentar' : 'error', codigo);
      } else {
        await resolver(trabajos[i], 'reintentar', 'TicketExpoInvalido');
      }
    }
  }
  return resumen;
}

export interface ConfiguracionServidor extends ConfiguracionPush {
  secreto: string;
  habilitado: boolean;
}

export function crearHandler(config: ConfiguracionServidor, deps: DependenciasPush) {
  const responder = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
    status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
  return async (req: Request): Promise<Response> => {
    if (req.method !== 'POST') return responder({ error: 'MetodoNoPermitido' }, 405);
    if (config.secreto.length < 32 || !/^[a-f0-9-]{36}$/i.test(config.proyectoId)
      || !config.entornos.length || config.entornos.some(e => !['development', 'preview', 'production'].includes(e))) {
      return responder({ error: 'ConfiguracionPushIncompleta' }, 503);
    }
    // Comparar digests de tamaño fijo sin publicar claves ni aceptar JWT de usuarios.
    const digest = (s: string) => crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
    const [esperado, recibido] = await Promise.all([
      digest(`Bearer ${config.secreto}`), digest(req.headers.get('Authorization') ?? ''),
    ]);
    let diferencia = 0;
    const a = new Uint8Array(esperado), b = new Uint8Array(recibido);
    for (let i = 0; i < a.length; i++) diferencia |= a[i] ^ b[i];
    if (diferencia !== 0) return responder({ error: 'NoAutorizado' }, 401);
    if (!config.habilitado) return responder({ habilitado: false });
    try {
      // No se aceptan tokens, usuarios ni mensajes del cuerpo de la petición.
      return responder(await procesarPush(deps, config));
    } catch (error: unknown) {
      return responder({ error: 'ProcesamientoPushFallido',
        ...(error instanceof ErrorBackendPush ? { codigo: error.codigo } : {}),
      }, 500);
    }
  };
}
