import { supabase } from "../client";
import { interpretarDatosPush } from "../../notifications/aperturaPush";

async function consultar<T>(operacion: (signal: AbortSignal) => PromiseLike<T>): Promise<T> {
  const controller = new AbortController();
  const limite = setTimeout(() => controller.abort(), 15_000);
  try {
    return await operacion(controller.signal);
  } finally {
    clearTimeout(limite);
  }
}

/** RLS y filtro explícito de destinatario; un payload nunca acredita acceso. */
export async function obtenerAvisoPushPropio(usuarioId: string, notificacionId: string) {
  const { data, error } = await consultar(signal => supabase.from("notificaciones")
    .select("id, reserva_id, tipo")
    .eq("id", notificacionId).eq("usuario_id", usuarioId)
    .abortSignal(signal).maybeSingle());
  if (error) throw error;
  return data ? interpretarDatosPush({
    notificacionId: data.id, reservaId: data.reserva_id, tipo: data.tipo,
  }) : null;
}

export async function marcarAvisoPushLeido(usuarioId: string, notificacionId: string) {
  const { error } = await consultar(signal => supabase.from("notificaciones").update({ leida: true })
    .eq("id", notificacionId).eq("usuario_id", usuarioId)
    .abortSignal(signal));
  if (error) throw error;
}
