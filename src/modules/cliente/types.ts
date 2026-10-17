import type { Coordenadas } from "./ubicacion";

export interface PerfilCliente {
  nombres: string;
  apellidos: string;
  telefono: string | null;
  edad: number | null;
  direccion: string | null;
  correo: string;
  fotoUrl: string | null;
  fechaRegistro: string | null;
}

export interface DatosPerfilCliente {
  nombres: string;
  apellidos: string;
  telefono: string;
  edad: number | null;
  direccion: string | null;
}

export interface ResumenViajesCliente {
  completados: number;
  enCurso: number;
  total: number;
}

// Valores permitidos por `notificaciones_tipo_check` en la base de datos.
export type TipoNotificacion =
  | "reserva_solicitada"
  | "reserva_aceptada"
  | "reserva_rechazada"
  | "reserva_cancelada"
  | "van_llegando"
  | "viaje_completado"
  | "asientos_ofrecidos";

export interface NotificacionCliente {
  id: string;
  tipo: TipoNotificacion;
  titulo: string;
  mensaje: string;
  leida: boolean;
  fecha: string;
  reservaId: string | null;
}

export interface ParaderoViaje {
  id: string;
  nombre: string;
  referencia: string | null;
}

/** Paradero de la lista completa, sin ubicación. */
export interface ParaderoResumen extends ParaderoViaje {
  fotoUrl: string | null;
}

export interface DetalleParadero extends ParaderoResumen {
  /** Null si el paradero no tiene ubicación registrada. */
  coordenadas: Coordenadas | null;
}

/** Origen o destino del catálogo de rutas. */
export type TipoPuntoViaje = "origen" | "destino";

export type OrigenViaje =
  | { tipo: "ruta"; nombre: string }
  | { tipo: "paradero"; paradero: ParaderoViaje }
  | { tipo: "ubicacion"; coordenadas: Coordenadas; direccion: string | null };
