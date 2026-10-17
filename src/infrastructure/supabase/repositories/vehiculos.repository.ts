import { supabase } from "../client";
import type {
  Coordenadas,
  TaxiCercano,
  TaxiDisponible,
  TaxiReserva,
} from "../../../modules/cliente/ubicacion";
import { ubicacionVigente } from "../../../modules/taxista/types";

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

/** Todos los taxis en servicio con asientos; con GPS, ordenados por distancia. */
export async function obtenerTaxisDisponibles(
  ubicacionCliente: Coordenadas | null
): Promise<TaxiDisponible[]> {
  const { data, error } = await supabase.rpc("obtener_taxis_disponibles", {
    p_latitud: ubicacionCliente?.latitud ?? null,
    p_longitud: ubicacionCliente?.longitud ?? null,
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
    ruta: taxi.ruta,
    precio: taxi.precio,
  }));
}

// `asientos` también se relaciona con la vista de asientos, por eso se indica
// la llave foránea.
export async function obtenerTaxiReserva(vehiculoId: string): Promise<TaxiReserva> {
  const { data, error } = await supabase
    .from("vehiculos")
    .select(`
      id, matricula, marca, modelo, activo,
      taxista:taxistas!vehiculos_taxista_id_fkey(
        nombres, apellidos, precio_ruta, taxista_activo, ubicacion_actualizada_en,
        ruta:rutas!taxistas_ruta_id_fkey(nombre)
      ),
      asientos!asientos_vehiculo_id_fkey(estado)
    `)
    .eq("id", vehiculoId)
    .maybeSingle();

  if (error) {
    throw error;
  }
  // La política `vehiculos_ver_todos` oculta los vehículos desactivados.
  if (!data || !data.activo || !data.taxista) {
    throw new Error("Este taxi ya no está disponible.");
  }

  const { taxista } = data;
  return {
    id: data.id,
    matricula: data.matricula,
    vehiculo: [data.marca, data.modelo].filter(Boolean).join(" ") || null,
    nombreTaxista: `${taxista.nombres} ${taxista.apellidos}`.trim(),
    ruta: taxista.ruta?.nombre ?? null,
    precio: taxista.precio_ruta,
    asientosDisponibles: data.asientos.filter((asiento) => asiento.estado === "disponible").length,
    totalAsientos: data.asientos.length,
    // Igual que `obtener_taxis_cercanos`: sin ubicación reciente no cuenta.
    enServicio: taxista.taxista_activo && ubicacionVigente(taxista.ubicacion_actualizada_en),
  };
}

let suscripciones = 0;

/** Avisa cuando se aparta o libera un asiento del vehículo. */
export function escucharAsientosVehiculo(vehiculoId: string, onChange: () => void) {
  // Nombre único por suscripción: ver `escucharReservasCliente`.
  const channel = supabase
    .channel(`asientos-vehiculo-${vehiculoId}-${++suscripciones}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "asientos", filter: `vehiculo_id=eq.${vehiculoId}` },
      onChange
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}