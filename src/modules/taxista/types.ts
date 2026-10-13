import type { EstadoReserva } from "../cliente/reservas";

export interface RutaTaxista {
  id: string;
  nombre: string;
  origen: string;
  destino: string;
  precioBase: number;
}

export interface PerfilTaxista {
  id: string;
  nombres: string;
  apellidos: string;
  telefono: string | null;
  direccion: string | null;
  horarioTrabajo: string | null;
  precioRuta: number | null;
  enServicio: boolean;
  ubicacionActualizadaEn: string | null;
  ruta: RutaTaxista | null;
}

export interface DatosPerfilTaxista {
  nombres: string;
  apellidos: string;
  telefono: string;
  direccion: string | null;
  horarioTrabajo: string | null;
  precioRuta: number | null;
  rutaId: string | null;
}

export type EstadoAsiento = "disponible" | "reservado" | "ocupado";

export interface AsientoTaxista {
  id: string;
  numero: number;
  estado: EstadoAsiento;
}

export interface VehiculoTaxista {
  id: string;
  matricula: string;
  marca: string | null;
  modelo: string | null;
  anio: number | null;
  capacidad: number;
  activo: boolean;
  asientos: AsientoTaxista[];
}

export interface DatosVehiculo {
  matricula: string;
  marca: string | null;
  modelo: string | null;
  anio: number | null;
  capacidad: number;
  activo: boolean;
}

export interface ReservaTaxista {
  id: string;
  estado: EstadoReserva;
  fechaReserva: string;
  fechaViaje: string | null;
  precio: number | null;
  notas: string | null;
  origen: string | null;
  destino: string | null;
  matricula: string | null;
  numeroAsiento: number | null;
  nombreCliente: string;
  /** Solo llega mientras la reserva está pendiente o aceptada. */
  telefonoCliente: string | null;
}

// Coincide con las transiciones de `actualizar_reserva_taxista`.
export type AccionReserva =
  | "aceptada"
  | "rechazada"
  | "completada"
  | "no_show"
  | "cancelada_taxista";

export const ACCIONES_POR_ESTADO: Partial<Record<EstadoReserva, AccionReserva[]>> = {
  pendiente: ["aceptada", "rechazada"],
  aceptada: ["completada", "no_show", "cancelada_taxista"],
};

export const accionesDisponibles = (estado: EstadoReserva): AccionReserva[] =>
  ACCIONES_POR_ESTADO[estado] ?? [];

interface PresentacionAccion {
  etiqueta: string;
  confirmacion: string | null;
  exito: string;
  peligrosa: boolean;
}

export const PRESENTACION_ACCION: Record<AccionReserva, PresentacionAccion> = {
  aceptada: {
    etiqueta: "Aceptar",
    confirmacion: null,
    exito: "Reservación aceptada",
    peligrosa: false,
  },
  rechazada: {
    etiqueta: "Rechazar",
    confirmacion: "¿Rechazar esta solicitud? El asiento quedará libre.",
    exito: "Solicitud rechazada",
    peligrosa: true,
  },
  completada: {
    etiqueta: "Viaje completado",
    confirmacion: null,
    exito: "Viaje completado",
    peligrosa: false,
  },
  no_show: {
    etiqueta: "No se presentó",
    confirmacion: "¿Marcar que el cliente no se presentó? El asiento quedará libre.",
    exito: "Reservación cerrada",
    peligrosa: true,
  },
  cancelada_taxista: {
    etiqueta: "Cancelar viaje",
    confirmacion: "¿Cancelar este viaje? Se avisará al cliente y el asiento quedará libre.",
    exito: "Viaje cancelado",
    peligrosa: true,
  },
};

// Descripciones desde el punto de vista del taxista; etiqueta y colores se
// comparten con el cliente (`PRESENTACION_ESTADO`).
export const DESCRIPCION_ESTADO_TAXISTA: Record<EstadoReserva, string> = {
  pendiente: "El cliente espera tu respuesta.",
  aceptada: "Asiento confirmado. Recoge al cliente en el punto de abordaje.",
  rechazada: "Rechazaste esta solicitud.",
  cancelada_cliente: "El cliente canceló la reservación.",
  cancelada_taxista: "Cancelaste este viaje.",
  completada: "Viaje terminado.",
  no_show: "El cliente no se presentó.",
};

/** Minutos sin enviar ubicación tras los que el taxista deja de verse en servicio. */
export const MINUTOS_UBICACION_VIGENTE = 15;

export function ubicacionVigente(fechaIso: string | null, ahora = Date.now()): boolean {
  return (
    fechaIso !== null &&
    ahora - new Date(fechaIso).getTime() < MINUTOS_UBICACION_VIGENTE * 60_000
  );
}

export const ETIQUETA_ASIENTO: Record<EstadoAsiento, string> = {
  disponible: "Libre",
  reservado: "Reservado",
  ocupado: "Ocupado",
};
