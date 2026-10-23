import { supabase } from "../client";
import type {
  EstadoReserva,
  NuevaReserva,
  ReservaCliente,
} from "../../../modules/cliente/reservas";
import type {
  PuntoMapa,
  SeguimientoReserva,
  TipoPuntoAbordaje,
} from "../../../modules/cliente/seguimiento";

// `reservas` tiene dos relaciones hacia paraderos y otra hacia la vista de
// asientos, por eso cada embebido indica la llave foránea. Las reservas
// anteriores a `reservas.origen` y `reservas.destino` los toman del paradero.
// `apartados` son todos los asientos que la reserva tiene (`asientos.reserva_id`).
const SELECT_RESERVA = `
  id, estado, fecha_hora_reserva, fecha_hora_viaje, precio, notas, origen, destino,
  cantidad_asientos, motivo_taxista, asientos_ofrecidos,
  paradero_origen:paraderos!reservas_paradero_origen_id_fkey(nombre),
  paradero_destino:paraderos!reservas_paradero_destino_id_fkey(nombre),
  vehiculo:vehiculos!reservas_vehiculo_id_fkey(matricula, marca, modelo),
  taxista:taxistas!reservas_taxista_id_fkey(nombres, apellidos, telefono),
  asiento:asientos!reservas_asiento_id_fkey(numero_asiento),
  apartados:asientos!fk_asientos_reserva(numero_asiento)
`;

function consultarReservas() {
  return supabase.from("reservas").select(SELECT_RESERVA);
}

type FilaReserva = NonNullable<
  Awaited<ReturnType<typeof consultarReservas>>["data"]
>[number];

function aReservaCliente(reserva: FilaReserva): ReservaCliente {
  // Las políticas RLS ocultan paraderos y vehículos desactivados.
  const vehiculo = reserva.vehiculo
    ? [reserva.vehiculo.marca, reserva.vehiculo.modelo].filter(Boolean).join(" ")
    : "";
  const numerosAsientos = reserva.apartados
    .map((asiento) => asiento.numero_asiento)
    .sort((a, b) => a - b);
  const numeroAsiento = reserva.asiento?.numero_asiento ?? null;

  return {
    id: reserva.id,
    estado: reserva.estado as EstadoReserva,
    fechaReserva: reserva.fecha_hora_reserva,
    fechaViaje: reserva.fecha_hora_viaje,
    precio: reserva.precio,
    notas: reserva.notas,
    origen: reserva.origen ?? reserva.paradero_origen?.nombre ?? null,
    destino: reserva.destino ?? reserva.paradero_destino?.nombre ?? null,
    matricula: reserva.vehiculo?.matricula ?? null,
    vehiculo: vehiculo || null,
    nombreTaxista: reserva.taxista
      ? `${reserva.taxista.nombres} ${reserva.taxista.apellidos}`.trim()
      : null,
    telefonoTaxista: reserva.taxista?.telefono ?? null,
    numeroAsiento,
    cantidadAsientos: reserva.cantidad_asientos,
    // Al cerrarse la reserva los asientos se liberan; queda el primero.
    numerosAsientos:
      numerosAsientos.length > 0 ? numerosAsientos : numeroAsiento !== null ? [numeroAsiento] : [],
    motivoTaxista: reserva.motivo_taxista,
    asientosOfrecidos: reserva.asientos_ofrecidos,
  };
}

export async function obtenerReservasCliente(
  clienteId: string
): Promise<ReservaCliente[]> {
  const { data, error } = await consultarReservas()
    .eq("cliente_id", clienteId)
    .order("fecha_hora_reserva", { ascending: false });

  if (error) {
    throw error;
  }

  return data.map(aReservaCliente);
}

/** La política `reservas_cliente_ver` solo deja leer las reservas propias. */
export async function obtenerReservaCliente(reservaId: string): Promise<ReservaCliente> {
  const { data, error } = await consultarReservas().eq("id", reservaId).maybeSingle();

  if (error) {
    throw error;
  }
  if (!data) {
    throw new Error("No se encontró la reservación.");
  }

  return aReservaCliente(data);
}

const aPunto = (
  nombre: string | null,
  latitud: number | null,
  longitud: number | null
): PuntoMapa | null =>
  latitud === null || longitud === null
    ? null
    : { nombre: nombre ?? "Punto de abordaje", coordenadas: { latitud, longitud } };

export async function obtenerSeguimientoReserva(
  reservaId: string
): Promise<SeguimientoReserva> {
  const { data, error } = await supabase.rpc("obtener_seguimiento_reserva", {
    p_reserva_id: reservaId,
  });

  if (error) {
    throw error;
  }
  const [fila] = data;
  if (!fila) {
    throw new Error("No se encontró al taxista de esta reservación.");
  }

  return {
    taxistaId: fila.taxista_id,
    enServicio: fila.en_servicio,
    taxi:
      fila.taxi_latitud === null || fila.taxi_longitud === null
        ? null
        : { latitud: fila.taxi_latitud, longitud: fila.taxi_longitud },
    ubicacionActualizadaEn: fila.ubicacion_actualizada_en,
    tipoPunto: fila.punto_tipo as TipoPuntoAbordaje | null,
    punto: aPunto(fila.punto_nombre, fila.punto_latitud, fila.punto_longitud),
    paraderoCercano: aPunto(fila.paradero_nombre, fila.paradero_latitud, fila.paradero_longitud),
    velocidadKmh: fila.velocidad_kmh,
  };
}

export async function crearReserva(reserva: NuevaReserva): Promise<string> {
  const { data, error } = await supabase.rpc("crear_reserva_cliente", {
    p_vehiculo_id: reserva.vehiculoId,
    p_destino: reserva.destino,
    p_origen: reserva.origen,
    p_paradero_origen_id: reserva.paraderoOrigenId,
    p_latitud: reserva.ubicacionOrigen?.latitud ?? null,
    p_longitud: reserva.ubicacionOrigen?.longitud ?? null,
    p_fecha_hora_viaje: reserva.fechaViaje,
    p_notas: reserva.notas,
    p_cantidad_asientos: reserva.cantidadAsientos,
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

/**
 * Responde a la oferta de asientos del taxista: si acepta, la reserva queda
 * aceptada con esos asientos; si no, la solicitud se cancela.
 */
export async function responderOfertaAsientos(
  reservaId: string,
  acepta: boolean
): Promise<void> {
  const { error } = await supabase.rpc("responder_oferta_asientos_cliente", {
    p_reserva_id: reservaId,
    p_acepta: acepta,
  });

  if (error) {
    throw error;
  }
}

let suscripciones = 0;

export function escucharReservasCliente(
  clienteId: string,
  onChange: () => void
) {
  // `supabase.channel` reutiliza el canal con el mismo nombre, y `removeChannel`
  // es asíncrono: al volver a montar la pantalla, el canal anterior aún está
  // suscrito y no admite nuevos callbacks. Cada suscripción usa un nombre único.
  const channel = supabase
    .channel(`reservas-cliente-${clienteId}-${++suscripciones}`)
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

/**
 * Avisa cuando cambia la reserva (el taxista la acepta o la cierra) o cuando
 * el taxista envía una ubicación nueva.
 */
export function escucharReserva(
  reservaId: string,
  taxistaId: string | null,
  onChange: () => void
) {
  // Nombre único por suscripción: ver `escucharReservasCliente`.
  let canal = supabase
    .channel(`reserva-${reservaId}-${++suscripciones}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "reservas", filter: `id=eq.${reservaId}` },
      onChange
    );

  if (taxistaId) {
    canal = canal.on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "taxistas", filter: `id=eq.${taxistaId}` },
      onChange
    );
  }

  const suscrito = canal.subscribe();

  return () => {
    void supabase.removeChannel(suscrito);
  };
}
