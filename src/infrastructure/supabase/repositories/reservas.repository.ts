import { supabase } from "../client";
import type {
  EstadoReserva,
  NuevaReserva,
  ReservaCliente,
} from "../../../modules/cliente/reservas";

// `reservas` tiene dos relaciones hacia paraderos y otra hacia la vista de
// asientos, por eso cada embebido indica la llave foránea.
const SELECT_RESERVA = `
  id, estado, fecha_hora_reserva, fecha_hora_viaje, precio, notas,
  origen:paraderos!reservas_paradero_origen_id_fkey(nombre),
  destino:paraderos!reservas_paradero_destino_id_fkey(nombre),
  vehiculo:vehiculos!reservas_vehiculo_id_fkey(matricula, marca, modelo),
  taxista:taxistas!reservas_taxista_id_fkey(nombres, apellidos, telefono),
  asiento:asientos!reservas_asiento_id_fkey(numero_asiento)
`;

export async function obtenerReservasCliente(
  clienteId: string
): Promise<ReservaCliente[]> {
  const { data, error } = await supabase
    .from("reservas")
    .select(SELECT_RESERVA)
    .eq("cliente_id", clienteId)
    .order("fecha_hora_reserva", { ascending: false });

  if (error) {
    throw error;
  }

  return data.map((reserva) => {
    // Las políticas RLS ocultan paraderos y vehículos desactivados.
    const vehiculo = reserva.vehiculo
      ? [reserva.vehiculo.marca, reserva.vehiculo.modelo].filter(Boolean).join(" ")
      : "";

    return {
      id: reserva.id,
      estado: reserva.estado as EstadoReserva,
      fechaReserva: reserva.fecha_hora_reserva,
      fechaViaje: reserva.fecha_hora_viaje,
      precio: reserva.precio,
      notas: reserva.notas,
      origen: reserva.origen?.nombre ?? null,
      destino: reserva.destino?.nombre ?? null,
      matricula: reserva.vehiculo?.matricula ?? null,
      vehiculo: vehiculo || null,
      nombreTaxista: reserva.taxista
        ? `${reserva.taxista.nombres} ${reserva.taxista.apellidos}`.trim()
        : null,
      telefonoTaxista: reserva.taxista?.telefono ?? null,
      numeroAsiento: reserva.asiento?.numero_asiento ?? null,
    };
  });
}

export async function crearReserva(reserva: NuevaReserva): Promise<string> {
  const { data, error } = await supabase.rpc("crear_reserva_cliente", {
    p_vehiculo_id: reserva.vehiculoId,
    p_paradero_destino_id: reserva.paraderoDestinoId,
    p_paradero_origen_id: reserva.paraderoOrigenId,
    p_notas: reserva.notas,
  });

  if (error) {
    throw error;
  }

  return data;
}

export async function cancelarReserva(reservaId: string): Promise<void> {
  const { error } = await supabase.rpc("cancelar_reserva_cliente", {
    p_reserva_id: reservaId,
  });

  if (error) {
    throw error;
  }
}

export function escucharReservasCliente(
  clienteId: string,
  onChange: () => void
) {
  const channel = supabase
    .channel(`reservas-cliente-${clienteId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "reservas",
        filter: `cliente_id=eq.${clienteId}`,
      },
      onChange
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}
