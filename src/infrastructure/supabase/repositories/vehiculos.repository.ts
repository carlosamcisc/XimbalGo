import { supabase } from "../client";

export async function obtenerVehiculos() {
  const { data, error } = await supabase
    .from("vista_asientos_disponibles")
    .select("*")
    .order("matricula");

  if (error) {
    throw error;
  }

  return data.map((vehiculo) => ({
    id: vehiculo.vehiculo_id,
    matricula: vehiculo.matricula,
    foto_van_url: vehiculo.foto_van_url,
    asientos_disponibles: vehiculo.asientos_disponibles,
    asientos_reservados: vehiculo.asientos_reservados,
    asientos_ocupados: vehiculo.asientos_ocupados,
    total_asientos: vehiculo.total_asientos,
  }));
}