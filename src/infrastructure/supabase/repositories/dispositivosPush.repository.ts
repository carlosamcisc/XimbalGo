import { supabase } from "../client";
import type { Database } from "../database.types";

type Dispositivo = Database["public"]["Tables"]["dispositivos_push"]["Insert"];

async function consultar<T>(operacion: (signal: AbortSignal) => PromiseLike<T>): Promise<T> {
  const controller = new AbortController();
  const limite = setTimeout(() => controller.abort(), 15_000);
  try {
    return await operacion(controller.signal);
  } finally {
    clearTimeout(limite);
  }
}

export async function guardarDispositivoPush(dispositivo: Dispositivo): Promise<void> {
  const { data, error } = await consultar(signal => supabase.from("dispositivos_push")
    .select("id")
    .eq("usuario_id", dispositivo.usuario_id)
    .eq("instalacion_id", dispositivo.instalacion_id)
    .abortSignal(signal).maybeSingle());
  if (error) throw error;

  // Un upsert intentaría actualizar columnas protegidas como usuario_id.
  const resultado = data
    ? await consultar(signal => supabase.from("dispositivos_push").update({
      expo_push_token: dispositivo.expo_push_token,
      plataforma: dispositivo.plataforma,
      proyecto_id: dispositivo.proyecto_id,
      entorno: dispositivo.entorno,
      activo: true,
    }).eq("id", data.id).eq("usuario_id", dispositivo.usuario_id).abortSignal(signal))
    : await consultar(signal => supabase.from("dispositivos_push").insert(dispositivo).abortSignal(signal));
  if (resultado.error) throw resultado.error;
}

export async function eliminarDispositivoPush(usuarioId: string, instalacionId: string): Promise<void> {
  const { error } = await consultar(signal => supabase.from("dispositivos_push").delete()
    .eq("usuario_id", usuarioId).eq("instalacion_id", instalacionId).abortSignal(signal));
  if (error) throw error;
}
