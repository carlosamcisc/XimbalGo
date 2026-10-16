import Colors from "../../theme/colors";
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
}

export interface NuevaReserva {
  vehiculoId: string;
  destino: string;
  /** Origen del catálogo de rutas, o la dirección cuando el origen es el GPS. */
  origen: string | null;
  paraderoOrigenId: string | null;
  ubicacionOrigen: Coordenadas | null;
  notas: string | null;
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

export function formatearPrecio(precio: number | null): string | null {
  return precio === null ? null : `$${precio.toFixed(2)} MXN`;
}
