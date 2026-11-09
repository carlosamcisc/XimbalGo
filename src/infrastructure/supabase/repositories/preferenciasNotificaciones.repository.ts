import { supabase } from "../client";
import { PREFERENCIAS_PREDETERMINADAS, type CampoPreferencia, type PreferenciasNotificaciones } from "../../../modules/notificaciones/types";

async function consultar<T>(operacion: (signal: AbortSignal) => PromiseLike<T>): Promise<T> {
  const controller = new AbortController();
  const limite = setTimeout(() => controller.abort(), 15_000);
  try { return await operacion(controller.signal); }
  finally { clearTimeout(limite); }
}

export async function obtenerPreferenciasNotificaciones(usuarioId: string): Promise<PreferenciasNotificaciones> {
  const { data, error } = await consultar(signal => supabase.from("preferencias_notificaciones")
    .select("push_habilitado, reservas, llegada, viajes").eq("usuario_id", usuarioId)
    .abortSignal(signal).maybeSingle());
  if (error) throw error;
  return data ?? { ...PREFERENCIAS_PREDETERMINADAS };
}

export async function guardarPreferenciaNotificaciones(usuarioId: string, campo: CampoPreferencia, valor: boolean): Promise<PreferenciasNotificaciones> {
  const { data, error } = await consultar(signal => supabase.rpc("guardar_preferencia_push", {
    p_usuario_id: usuarioId, p_campo: campo, p_valor: valor,
  }).abortSignal(signal));
  if (error) throw error;
  if (!data?.[0]) throw new Error("No se confirmó el cambio de preferencias.");
  return data[0];
}
