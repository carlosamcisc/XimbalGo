import { supabase } from "../client";
import type { Coordenadas } from "../../../modules/cliente/ubicacion";
import type { EstadoReserva } from "../../../modules/cliente/reservas";
import type {
  AccionReserva,
  DatosPerfilTaxista,
  DatosVehiculo,
  EstadoAsiento,
  PerfilTaxista,
  ReservaTaxista,
  VehiculoTaxista,
} from "../../../modules/taxista/types";

export async function obtenerPerfilTaxista(taxistaId: string): Promise<PerfilTaxista> {
  const { data, error } = await supabase
    .from("taxistas")
    .select(`
      id, nombres, apellidos, telefono, direccion, horario_trabajo, precio_ruta,
      taxista_activo, ubicacion_actualizada_en,
      ruta:rutas!taxistas_ruta_id_fkey(id, nombre, origen, destino, precio_base)
    `)
    .eq("id", taxistaId)
    .maybeSingle();

  if (error) {
    throw error;
  }
  if (!data) {
    throw new Error("No se encontró el perfil de taxista asociado a esta cuenta.");
  }

  return {
    id: data.id,
    nombres: data.nombres,
    apellidos: data.apellidos,
    telefono: data.telefono,
    direccion: data.direccion,
    horarioTrabajo: data.horario_trabajo,
    precioRuta: data.precio_ruta,
    enServicio: data.taxista_activo,
    ubicacionActualizadaEn: data.ubicacion_actualizada_en,
    // La política de `rutas` oculta las rutas desactivadas.
    ruta: data.ruta
      ? {
          id: data.ruta.id,
          nombre: data.ruta.nombre,
          origen: data.ruta.origen,
          destino: data.ruta.destino,
          precioBase: data.ruta.precio_base,
        }
      : null,
  };
}

export async function guardarPerfilTaxista(
  taxistaId: string,
  datos: DatosPerfilTaxista
): Promise<void> {
  // `trigger_sincronizar_ruta_taxista` copia el origen y destino de la ruta.
  const { error } = await supabase
    .from("taxistas")
    .update({
      nombres: datos.nombres,
      apellidos: datos.apellidos,
      telefono: datos.telefono,
      direccion: datos.direccion,
      horario_trabajo: datos.horarioTrabajo,
      precio_ruta: datos.precioRuta,
      ruta_id: datos.rutaId,
    })
    .eq("id", taxistaId);

  if (error) {
    throw error;
  }

  const { error: errorUsuario } = await supabase
    .from("usuarios")
    .update({ numero_telefono: datos.telefono })
    .eq("id", taxistaId);

  if (errorUsuario) {
    throw errorUsuario;
  }
}

/** El vehículo más reciente del taxista; la app maneja uno por taxista. */
export async function obtenerVehiculoTaxista(
  taxistaId: string
): Promise<VehiculoTaxista | null> {
  // `asientos` también se relaciona con la vista de asientos.
  const { data, error } = await supabase
    .from("vehiculos")
    .select(`
      id, matricula, marca, modelo, anio, capacidad_total_asientos, activo,
      asientos!asientos_vehiculo_id_fkey(id, numero_asiento, estado, reserva_id)
    `)
    .eq("taxista_id", taxistaId)
    .order("activo", { ascending: false })
    .order("id")
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }
  if (!data) {
    return null;
  }

  return {
    id: data.id,
    matricula: data.matricula,
    marca: data.marca,
    modelo: data.modelo,
    anio: data.anio,
    capacidad: data.capacidad_total_asientos,
    activo: data.activo,
    asientos: data.asientos
      .map((asiento) => ({
        id: asiento.id,
        numero: asiento.numero_asiento,
        estado: asiento.estado as EstadoAsiento,
        conReserva: asiento.reserva_id !== null,
      }))
      .sort((a, b) => a.numero - b.numero),
  };
}

function errorVehiculo(error: { code?: string; message: string }): Error {
  if (error.code === "23505") {
    return new Error("Esa matrícula ya está registrada.");
  }
  return new Error(error.message);
}

export async function registrarVehiculo(
  taxistaId: string,
  datos: DatosVehiculo
): Promise<void> {
  // `trigger_generar_asientos` crea los asientos.
  const { error } = await supabase.from("vehiculos").insert({
    taxista_id: taxistaId,
    matricula: datos.matricula,
    marca: datos.marca,
    modelo: datos.modelo,
    anio: datos.anio,
    capacidad_total_asientos: datos.capacidad,
    activo: datos.activo,
  });

  if (error) {
    throw errorVehiculo(error);
  }
}

export async function actualizarVehiculo(
  vehiculoId: string,
  datos: DatosVehiculo
): Promise<void> {
  // `trigger_ajustar_asientos` agrega o quita asientos si cambia la capacidad.
  const { error } = await supabase
    .from("vehiculos")
    .update({
      matricula: datos.matricula,
      marca: datos.marca,
      modelo: datos.modelo,
      anio: datos.anio,
      capacidad_total_asientos: datos.capacidad,
      activo: datos.activo,
    })
    .eq("id", vehiculoId);

  if (error) {
    throw errorVehiculo(error);
  }
}

export async function cambiarServicio(
  enServicio: boolean,
  ubicacion: Coordenadas | null
): Promise<void> {
  const { error } = await supabase.rpc("cambiar_servicio_taxista", {
    p_en_servicio: enServicio,
    ...(ubicacion && {
      p_latitud: ubicacion.latitud,
      p_longitud: ubicacion.longitud,
    }),
  });

  if (error) {
    throw error;
  }
}

export async function actualizarUbicacion(ubicacion: Coordenadas): Promise<void> {
  const { error } = await supabase.rpc("actualizar_ubicacion_taxista", {
    p_latitud: ubicacion.latitud,
    p_longitud: ubicacion.longitud,
  });

  if (error) {
    throw error;
  }
}

export async function obtenerReservasTaxista(): Promise<ReservaTaxista[]> {
  const { data, error } = await supabase.rpc("obtener_reservas_taxista");

  if (error) {
    throw error;
  }

  return data.map((reserva) => ({
    id: reserva.id,
    estado: reserva.estado as EstadoReserva,
    fechaReserva: reserva.fecha_hora_reserva,
    fechaViaje: reserva.fecha_hora_viaje,
    precio: reserva.precio,
    notas: reserva.notas,
    origen: reserva.origen,
    destino: reserva.destino,
    matricula: reserva.matricula,
    numeroAsiento: reserva.numero_asiento,
    cantidadAsientos: reserva.cantidad_asientos,
    numerosAsientos: reserva.numeros_asientos,
    nombreCliente: reserva.nombre_cliente.trim() || "Cliente",
    telefonoCliente: reserva.telefono_cliente,
    motivoTaxista: reserva.motivo_taxista,
    asientosOfrecidos: reserva.asientos_ofrecidos,
  }));
}

/** `motivo` llega al cliente al rechazar o cancelar. */
export async function actualizarReserva(
  reservaId: string,
  accion: AccionReserva,
  motivo: string | null = null
): Promise<void> {
  const { error } = await supabase.rpc("actualizar_reserva_taxista", {
    p_reserva_id: reservaId,
    p_estado: accion,
    p_motivo: motivo,
  });

  if (error) {
    throw error;
  }
}

/**
 * Ofrece al cliente menos asientos de los que pidió. Los que no ofrece quedan
 * ocupados sin reservación.
 */
export async function ofrecerAsientos(reservaId: string, cantidad: number): Promise<void> {
  const { error } = await supabase.rpc("ofrecer_asientos_taxista", {
    p_reserva_id: reservaId,
    p_cantidad: cantidad,
  });

  if (error) {
    throw error;
  }
}

/** Marca como ocupados, o vuelve a dejar libres, asientos sin reservación. */
export async function marcarAsientos(asientoIds: string[], ocupados: boolean): Promise<void> {
  const { error } = await supabase.rpc("marcar_asientos_taxista", {
    p_asiento_ids: asientoIds,
    p_ocupado: ocupados,
  });

  if (error) {
    throw error;
  }
}

let suscripciones = 0;

/**
 * Avisa cuando cambian las reservas del taxista (un cliente reserva o
 * cancela) o los asientos de su vehículo.
 */
export function escucharTaxista(
  taxistaId: string,
  vehiculoId: string | null,
  onChange: () => void
) {
  // Nombre único por suscripción: ver `escucharReservasCliente`.
  let canal = supabase
    .channel(`taxista-${taxistaId}-${++suscripciones}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "reservas", filter: `taxista_id=eq.${taxistaId}` },
      onChange
    );

  if (vehiculoId) {
    canal = canal.on(
      "postgres_changes",
      { event: "*", schema: "public", table: "asientos", filter: `vehiculo_id=eq.${vehiculoId}` },
      onChange
    );
  }

  const suscrito = canal.subscribe();

  return () => {
    void supabase.removeChannel(suscrito);
  };
}
