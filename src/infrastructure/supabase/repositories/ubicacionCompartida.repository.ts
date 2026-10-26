import { supabase } from "../client";
import type { Coordenadas } from "../../../modules/cliente/ubicacion";
import type { UbicacionCompartida } from "../../../modules/cliente/ubicacionCompartida";

/** Termina la que estuviera activa y empieza otra con la ubicación actual. */
export async function iniciarUbicacionCompartida(
  ubicacion: Coordenadas,
  minutos: number
): Promise<UbicacionCompartida> {
  const { data, error } = await supabase.rpc("iniciar_ubicacion_compartida", {
    p_latitud: ubicacion.latitud,
    p_longitud: ubicacion.longitud,
    p_minutos: minutos,
  });

  if (error) {
    throw error;
  }

  const compartida = data[0];
  if (!compartida) {
    throw new Error("No se pudo compartir tu ubicación.");
  }

  return { id: compartida.id, expiraEn: compartida.expira_en };
}

/** Devuelve false si ya terminó o venció. */
export async function actualizarUbicacionCompartida(
  id: string,
  ubicacion: Coordenadas
): Promise<boolean> {
  const { data, error } = await supabase.rpc("actualizar_ubicacion_compartida", {
    p_id: id,
    p_latitud: ubicacion.latitud,
    p_longitud: ubicacion.longitud,
  });

  if (error) {
    throw error;
  }

  return data;
}

export async function detenerUbicacionCompartida(id: string): Promise<void> {
  const { error } = await supabase.rpc("detener_ubicacion_compartida", { p_id: id });

  if (error) {
    throw error;
  }
}

export async function obtenerUbicacionCompartidaActiva(): Promise<UbicacionCompartida | null> {
  const { data, error } = await supabase.rpc("obtener_ubicacion_compartida_activa");

  if (error) {
    throw error;
  }

  const compartida = data[0];
  return compartida ? { id: compartida.id, expiraEn: compartida.expira_en } : null;
}
