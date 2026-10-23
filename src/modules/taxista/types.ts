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
  /** Apartado u ocupado por una reservación; se libera al cerrar ese viaje. */
  conReserva: boolean;
}

/** Solo los asientos sin reservación se marcan a mano (`marcar_asientos_taxista`). */
export const asientoEditable = (asiento: AsientoTaxista) =>
  !asiento.conReserva && asiento.estado !== "reservado";

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
  cantidadAsientos: number;
  numerosAsientos: number[];
  nombreCliente: string;
  /** Solo llega mientras la reserva está pendiente o aceptada. */
  telefonoCliente: string | null;
  /** Motivo con el que el taxista rechazó la solicitud o canceló el viaje. */
  motivoTaxista: string | null;
  /** Asientos que el taxista ofreció cuando no tenía todos los pedidos. */
  asientosOfrecidos: number | null;
}

/** Ofreció menos asientos y el cliente aún no responde. */
export const esperaRespuestaOferta = (reserva: ReservaTaxista) =>
  reserva.estado === "pendiente" && reserva.asientosOfrecidos !== null;

/** Se pueden ofrecer de 1 a `cantidadAsientos - 1` asientos (`ofrecer_asientos_taxista`). */
export const puedeOfrecerAsientos = (reserva: ReservaTaxista) =>
  reserva.estado === "pendiente" &&
  reserva.asientosOfrecidos === null &&
  reserva.cantidadAsientos > 1;

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

/** Con una oferta sin responder solo se puede rechazar. */
export const accionesDisponibles = (reserva: ReservaTaxista): AccionReserva[] =>
  esperaRespuestaOferta(reserva)
    ? ["rechazada"]
    : ACCIONES_POR_ESTADO[reserva.estado] ?? [];

interface PresentacionAccion {
  etiqueta: string;
  confirmacion: string | null;
  exito: string;
  peligrosa: boolean;
  /** Pide el motivo para el cliente; `obligatorio` coincide con la base. */
  motivo: { titulo: string; obligatorio: boolean } | null;
}

export const PRESENTACION_ACCION: Record<AccionReserva, PresentacionAccion> = {
  aceptada: {
    etiqueta: "Aceptar",
    confirmacion: null,
    exito: "Reservación aceptada",
    peligrosa: false,
    motivo: null,
  },
  rechazada: {
    etiqueta: "Rechazar",
    confirmacion: null,
    exito: "Solicitud rechazada",
    peligrosa: true,
    motivo: { titulo: "¿Por qué rechazas la solicitud?", obligatorio: true },
  },
  completada: {
    etiqueta: "Viaje completado",
    confirmacion: null,
    exito: "Viaje completado",
    peligrosa: false,
    motivo: null,
  },
  no_show: {
    etiqueta: "No se presentó",
    confirmacion: "¿Marcar que el cliente no se presentó? El asiento quedará libre.",
    exito: "Reservación cerrada",
    peligrosa: true,
    motivo: null,
  },
  cancelada_taxista: {
    etiqueta: "Cancelar viaje",
    confirmacion: null,
    exito: "Viaje cancelado",
    peligrosa: true,
    motivo: { titulo: "¿Por qué cancelas el viaje?", obligatorio: false },
  },
};

/** Límite de `reservas_motivo_taxista_check`. */
export const MAXIMO_MOTIVO = 200;

export const MOTIVOS_RECHAZO = [
  "Ya no tengo asientos disponibles",
  "No paso por tu punto de abordaje",
  "No puedo a la hora que pediste",
  "Estoy por terminar mi servicio",
];

export const MOTIVOS_CANCELACION = [
  "Tuve una falla con la unidad",
  "Hubo un cambio en mi ruta",
  "Tuve una emergencia",
  "No encontré al cliente en el punto de abordaje",
];

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
