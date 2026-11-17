import { crearHandler, ErrorBackendPush, type Rpc } from './procesador.ts';

const url = Deno.env.get('SUPABASE_URL') ?? '';
const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const rpc: Rpc = async <T>(nombre: string, argumentos: Record<string, unknown>): Promise<T> => {
  if (!url || !key) throw new ErrorBackendPush('CONFIGURACION_SUPABASE_INCOMPLETA');
  const response = await fetch(`${url}/rest/v1/rpc/${nombre}`, {
    method: 'POST', signal: AbortSignal.timeout(10_000),
    headers: {
      apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json',
      'Accept-Profile': 'public', 'Content-Profile': 'public',
    },
    body: JSON.stringify(argumentos),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const codigo = typeof body?.code === 'string' && /^[A-Z0-9_]{1,40}$/.test(body.code) ? body.code : 'SIN_CODIGO';
    throw new ErrorBackendPush(`RPC_${nombre.toUpperCase()}_${response.status}_${codigo}`);
  }
  return await response.json() as T;
};

Deno.serve(crearHandler({
  secreto: Deno.env.get('PUSH_WORKER_SECRET') ?? '',
  habilitado: Deno.env.get('PUSH_ENABLED') === 'true',
  proyectoId: Deno.env.get('PUSH_PROJECT_ID') ?? '',
  entornos: [...new Set((Deno.env.get('PUSH_ENVIRONMENTS') ?? '').split(',').map(e => e.trim()).filter(Boolean))],
  accessToken: Deno.env.get('EXPO_ACCESS_TOKEN'),
}, { rpc, fetch }));
