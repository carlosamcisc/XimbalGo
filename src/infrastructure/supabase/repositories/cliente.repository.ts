import { supabase } from "../client";
import type {
  Coordenadas,
  ParaderoCercano,
} from "../../../modules/cliente/ubicacion";

export async function obtenerPerfilCliente(usuarioId: string) {
  const { data, error } = await supabase
    .from("clientes")
    .select("nombres, apellidos")
    .eq("id", usuarioId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error("No se encontró el perfil de cliente asociado a esta cuenta.");
  }

  return data;
}

export async function obtenerParaderosActivos() {
  const { data, error } = await supabase
    .from("paraderos")
    .select("id, nombre, referencia")
    .eq("activo", true)
    .order("nombre");

  if (error) {
    throw error;
  }

  return data;
}

export async function obtenerParaderosCercanos(
  ubicacionCliente: Coordenadas,
  limite = 5
): Promise<ParaderoCercano[]> {
  const { data, error } = await supabase.rpc("obtener_paraderos_cercanos", {
    p_latitud: ubicacionCliente.latitud,
    p_longitud: ubicacionCliente.longitud,
    p_limite: limite,
  });

  if (error) {
    throw error;
  }

  return data.map((paradero) => ({
    id: paradero.id,
    nombre: paradero.nombre,
    referencia: paradero.referencia,
    distanciaMetros: paradero.distancia_metros,
  }));
}
