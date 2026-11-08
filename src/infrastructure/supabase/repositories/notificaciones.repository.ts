import { supabase } from "../client";
import type { NotificacionCliente, TipoNotificacion } from "../../../modules/cliente/types";

async function consultar<T>(operacion: (signal: AbortSignal) => PromiseLike<T>): Promise<T> {
  const controller = new AbortController();
  const limite = setTimeout(() => controller.abort(), 15_000);
  try { return await operacion(controller.signal); }
  finally { clearTimeout(limite); }
}

export async function obtenerBandejaNotificaciones(usuarioId: string): Promise<{ notificaciones: NotificacionCliente[]; noLeidas: number }> {
  const [avisos, total] = await Promise.all([
    consultar(signal => supabase.from("notificaciones")
      .select("id, tipo, titulo, mensaje, leida, fecha_envio, reserva_id")
      .eq("usuario_id", usuarioId).order("fecha_envio", { ascending: false })
      .order("id", { ascending: false }).limit(50).abortSignal(signal)),
    consultar(signal => supabase.from("notificaciones").select("id", { count: "exact", head: true })
      .eq("usuario_id", usuarioId).eq("leida", false).abortSignal(signal)),
  ]);
  if (avisos.error) throw avisos.error;
  if (total.error) throw total.error;
  return {
    notificaciones: (avisos.data ?? []).map(n => ({
      id: n.id, tipo: n.tipo as TipoNotificacion, titulo: n.titulo, mensaje: n.mensaje,
      leida: n.leida, fecha: n.fecha_envio, reservaId: n.reserva_id,
    })),
    noLeidas: total.count ?? 0,
  };
}

export async function marcarAvisosLeidos(usuarioId: string, notificacionId?: string): Promise<void> {
  const { error } = await consultar(signal => {
    let query = supabase.from("notificaciones").update({ leida: true })
      .eq("usuario_id", usuarioId).eq("leida", false).abortSignal(signal);
    if (notificacionId) query = query.eq("id", notificacionId);
    return query;
  });
  if (error) throw error;
}

let suscripciones = 0;
export function escucharNotificaciones(usuarioId: string, onChange: () => void) {
  const canal = supabase.channel(`bandeja-${usuarioId}-${++suscripciones}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "notificaciones", filter: `usuario_id=eq.${usuarioId}` }, onChange)
    .subscribe();
  return () => { void supabase.removeChannel(canal); };
}
