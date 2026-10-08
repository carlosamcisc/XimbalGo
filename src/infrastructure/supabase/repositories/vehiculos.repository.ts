import { supabase } from "../client";
import type {
  Coordenadas,
  TaxiCercano,
} from "../../../modules/cliente/ubicacion";

type Vehiculo = Awaited<ReturnType<typeof obtenerVehiculos>>[number];
type VehiculoDisponible = Vehiculo & {
  id: string;
  matricula: string;
  asientos_disponibles: number;
};

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

export async function obtenerVehiculosDisponibles(): Promise<
  VehiculoDisponible[]
> {
  const vehiculos = await obtenerVehiculos();

  return vehiculos.filter(
    (vehiculo): vehiculo is VehiculoDisponible =>
      vehiculo.id !== null &&
      vehiculo.matricula !== null &&
      typeof vehiculo.asientos_disponibles === "number" &&
      vehiculo.asientos_disponibles > 0
  );
}

export async function obtenerTaxisCercanos(
  ubicacionCliente: Coordenadas,
  limite = 5
): Promise<TaxiCercano[]> {
  const { data, error } = await supabase.rpc("obtener_taxis_cercanos", {
    p_latitud: ubicacionCliente.latitud,
    p_longitud: ubicacionCliente.longitud,
    p_limite: limite,
  });

  if (error) {
    throw error;
  }

  return data.map((taxi) => ({
    id: taxi.vehiculo_id,
    matricula: taxi.matricula,
    nombreTaxista: taxi.nombre_taxista,
    asientosDisponibles: taxi.asientos_disponibles,
    distanciaMetros: taxi.distancia_metros,
  }));
}