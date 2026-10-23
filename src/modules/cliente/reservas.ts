import Colors from "../../theme/colors";
import type { OrigenViaje } from "./types";
import type { Coordenadas } from "./ubicacion";

// Valores permitidos por `reservas_estado_check` en la base de datos.
export type EstadoReserva =
  | "pendiente"
  | "aceptada"
  | "rechazada"
  | "cancelada_cliente"
  | "cancelada_taxista"
  | "completada"
  | "no_show";

export interface ReservaCliente {
  id: string;
  estado: EstadoReserva;
  fechaReserva: string;
  fechaViaje: string | null;
  precio: number | null;
  notas: string | null;
  origen: string | null;
  destino: string | null;
  matricula: string | null;
  vehiculo: string | null;
  nombreTaxista: string | null;
  telefonoTaxista: string | null;
  numeroAsiento: number | null;
  cantidadAsientos: number;
  /** Solo se conocen mientras la reserva tiene los asientos apartados. */
  numerosAsientos: number[];
  /** Motivo del taxista al rechazar la solicitud o cancelar el viaje. */
  motivoTaxista: string | null;
  /** Asientos que el taxista ofreció porque no tenía todos los pedidos. */
  asientosOfrecidos: number | null;
}

/** El taxista ofreció menos asientos y espera la respuesta del cliente. */
export const tieneOfertaAsientos = (reserva: ReservaCliente) =>
  reserva.estado === "pendiente" && reserva.asientosOfrecidos !== null;

/** Precio con los asientos ofrecidos, al mismo precio por asiento. */
export function precioOferta(reserva: ReservaCliente): number | null {
  if (reserva.precio === null || reserva.asientosOfrecidos === null) {
    return null;
  }
  return (reserva.precio / reserva.cantidadAsientos) * reserva.asientosOfrecidos;
}

export interface NuevaReserva {
  vehiculoId: string;
  destino: string;
  /** Origen del catálogo de rutas, o la dirección cuando el origen es el GPS. */
  origen: string | null;
  paraderoOrigenId: string | null;
  ubicacionOrigen: Coordenadas | null;
  notas: string | null;
  cantidadAsientos: number;
  /** Null para viajar en cuanto pase el taxi. */
  fechaViaje: string | null;
}

const formatearCoordenadas = ({ latitud, longitud }: Coordenadas) =>
  `${latitud.toFixed(5)}, ${longitud.toFixed(5)}`;

/** Texto del origen elegido para mostrarlo al cliente. */
export function etiquetaOrigen(origen: OrigenViaje | null): string {
  if (!origen) {
    return "";
  }
  if (origen.tipo === "ubicacion") {
    return origen.direccion ?? "Mi ubicación actual";
  }
  return origen.tipo === "ruta" ? origen.nombre : origen.paradero.nombre;
}

/** Campos del origen que espera `crear_reserva_cliente`. */
export function origenDeReserva(
  origen: OrigenViaje
): Pick<NuevaReserva, "origen" | "paraderoOrigenId" | "ubicacionOrigen"> {
  switch (origen.tipo) {
    case "ruta":
      return { origen: origen.nombre, paraderoOrigenId: null, ubicacionOrigen: null };
    case "paradero":
      return { origen: null, paraderoOrigenId: origen.paradero.id, ubicacionOrigen: null };
    case "ubicacion":
      return {
        origen: origen.direccion ?? `Ubicación actual (${formatearCoordenadas(origen.coordenadas)})`,
        paraderoOrigenId: null,
        ubicacionOrigen: origen.coordenadas,
      };
  }
}

/** Límites de `crear_reserva_cliente`. */
export const MAXIMO_ASIENTOS_RESERVA = 20;
export const DIAS_ANTICIPACION_RESERVA = 7;

export const textoAsientos = (cantidad: number) =>
  `${cantidad} ${cantidad === 1 ? "asiento" : "asientos"}`;

/** «3 asientos · núm. 1, 2, 3», o solo la cantidad si no hay números. */
export function formatearAsientos(cantidad: number, numeros: number[]): string {
  if (numeros.length === 0) {
    return textoAsientos(cantidad);
  }
  return `${textoAsientos(cantidad)} · núm. ${numeros.join(", ")}`;
}

const ESTADOS_ACTIVOS: readonly EstadoReserva[] = ["pendiente", "aceptada"];

export const esReservaActiva = (estado: EstadoReserva) =>
  ESTADOS_ACTIVOS.includes(estado);

// Coincide con los estados que acepta `cancelar_reserva_cliente`.
export const puedeCancelarse = esReservaActiva;

interface PresentacionEstado {
  etiqueta: string;
  descripcion: string;
  color: string;
  fondo: string;
}

export const PRESENTACION_ESTADO: Record<EstadoReserva, PresentacionEstado> = {
  pendiente: {
    etiqueta: "Pendiente",
    descripcion: "Esperando a que el taxista acepte tu solicitud.",
    color: Colors.primary,
    fondo: Colors.primaryContainer,
  },
  aceptada: {
    etiqueta: "Aceptada",
    descripcion: "Tu asiento está confirmado. Prepárate para tu viaje.",
    color: Colors.success,
    fondo: Colors.brandAccentContainer,
  },
  rechazada: {
    etiqueta: "Rechazada",
    descripcion: "El taxista no pudo aceptar esta solicitud.",
    color: Colors.error,
    fondo: Colors.errorContainerSoft,
  },
  cancelada_cliente: {
    etiqueta: "Cancelada",
    descripcion: "Cancelaste esta reservación.",
    color: Colors.outline,
    fondo: Colors.surfaceMuted,
  },
  cancelada_taxista: {
    etiqueta: "Cancelada por taxista",
    descripcion: "El taxista canceló esta reservación.",
    color: Colors.error,
    fondo: Colors.errorContainerSoft,
  },
  completada: {
    etiqueta: "Completada",
    descripcion: "Viaje terminado. ¡Gracias por viajar con XimbalGo!",
    color: Colors.brandAccentBright,
    fondo: Colors.brandAccentContainer,
  },
  no_show: {
    etiqueta: "No se presentó",
    descripcion: "La reservación se cerró porque no llegaste al punto de abordaje.",
    color: Colors.outline,
    fondo: Colors.surfaceMuted,
  },
};

export function formatearFecha(fechaIso: string): string {
  return new Date(fechaIso).toLocaleString("es-MX", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatearHora(fecha: Date | string): string {
  return new Date(fecha).toLocaleTimeString("es-MX", {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatearPrecio(precio: number | null): string | null {
  return precio === null ? null : `$${precio.toFixed(2)} MXN`;
}
