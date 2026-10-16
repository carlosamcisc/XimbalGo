import { supabase } from "../client";
import type {
  Coordenadas,
  ParaderoCercano,
} from "../../../modules/cliente/ubicacion";
import type {
  DatosPerfilCliente,
  NotificacionCliente,
  PerfilCliente,
  ResumenViajesCliente,
  TipoNotificacion,
} from "../../../modules/cliente/types";
import { esReservaActiva, type EstadoReserva } from "../../../modules/cliente/reservas";

export async function obtenerPerfilCliente(usuarioId: string): Promise<PerfilCliente> {
  // `clientes.id` es la llave foránea hacia `usuarios`.
  const { data, error } = await supabase
    .from("clientes")
    .select(`
      nombres, apellidos, telefono, edad, direccion,
      usuario:usuarios!clientes_id_fkey(correo, foto_perfil_url, fecha_registro)
    `)
    .eq("id", usuarioId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error("No se encontró el perfil de cliente asociado a esta cuenta.");
  }

  return {
    nombres: data.nombres,
    apellidos: data.apellidos,
    telefono: data.telefono,
    edad: data.edad,
    direccion: data.direccion,
    correo: data.usuario?.correo ?? "",
    fotoUrl: data.usuario?.foto_perfil_url ?? null,
    fechaRegistro: data.usuario?.fecha_registro ?? null,
  };
}

export async function guardarPerfilCliente(
  clienteId: string,
  datos: DatosPerfilCliente
): Promise<void> {
  const { error } = await supabase
    .from("clientes")
    .update({
      nombres: datos.nombres,
      apellidos: datos.apellidos,
      telefono: datos.telefono,
      edad: datos.edad,
      direccion: datos.direccion,
    })
    .eq("id", clienteId);

  if (error) {
    throw error;
  }

  const { error: errorUsuario } = await supabase
    .from("usuarios")
    .update({ numero_telefono: datos.telefono })
    .eq("id", clienteId);

  if (errorUsuario) {
    throw errorUsuario;
  }
}

export async function obtenerResumenViajes(
  clienteId: string
): Promise<ResumenViajesCliente> {
  const { data, error } = await supabase
    .from("reservas")
    .select("estado")
    .eq("cliente_id", clienteId);

  if (error) {
    throw error;
  }

  const estados = data.map((reserva) => reserva.estado as EstadoReserva);
  return {
    completados: estados.filter((estado) => estado === "completada").length,
    enCurso: estados.filter(esReservaActiva).length,
    total: estados.length,
  };
}

const LIMITE_NOTIFICACIONES = 50;

export async function obtenerNotificaciones(
  usuarioId: string
): Promise<NotificacionCliente[]> {
  const { data, error } = await supabase
    .from("notificaciones")
    .select("id, tipo, titulo, mensaje, leida, fecha_envio, reserva_id")
    .eq("usuario_id", usuarioId)
    .order("fecha_envio", { ascending: false })
    .limit(LIMITE_NOTIFICACIONES);

  if (error) {
    throw error;
  }

  return data.map((notificacion) => ({
    id: notificacion.id,
    tipo: notificacion.tipo as TipoNotificacion,
    titulo: notificacion.titulo,
    mensaje: notificacion.mensaje,
    leida: notificacion.leida,
    fecha: notificacion.fecha_envio,
    reservaId: notificacion.reserva_id,
  }));
}

/** Sin `notificacionId` marca como leídas todas las del usuario. */
export async function marcarNotificacionesLeidas(
  usuarioId: string,
  notificacionId?: string
): Promise<void> {
  let consulta = supabase
    .from("notificaciones")
    .update({ leida: true })
    .eq("usuario_id", usuarioId)
    .eq("leida", false);

  if (notificacionId) {
    consulta = consulta.eq("id", notificacionId);
  }

  const { error } = await consulta;

  if (error) {
    throw error;
  }
}

let suscripciones = 0;

/** Avisa cuando llegan notificaciones o cambian las reservas del cliente. */
export function escucharCliente(clienteId: string, onChange: () => void) {
  // Nombre único por suscripción: ver `escucharReservasCliente`.
  const channel = supabase
    .channel(`cliente-${clienteId}-${++suscripciones}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "notificaciones", filter: `usuario_id=eq.${clienteId}` },
      onChange
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "reservas", filter: `cliente_id=eq.${clienteId}` },
      onChange
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}

export async function guardarUbicacionCliente(
  ubicacion: Coordenadas
): Promise<void> {
  const { error } = await supabase.rpc("actualizar_ubicacion_cliente", {
    p_latitud: ubicacion.latitud,
    p_longitud: ubicacion.longitud,
  });

  if (error) {
    throw error;
  }
}

export async function obtenerParaderosCercanos(
  ubicacionCliente: Coordenadas,
  limite = 5
): Promise<ParaderoCercano[]> {
  const { data, error } = await supabase.rpc("obtener_paraderos_cercanos", {
    p_latitud: ubicacionCliente.latitud,
    p_longitud: ubicacionCliente.longitud,
    p_limite: limite,
  });

  if (error) {
    throw error;
  }

  return data.map((paradero) => ({
    id: paradero.id,
    nombre: paradero.nombre,
    referencia: paradero.referencia,
    distanciaMetros: paradero.distancia_metros,
  }));
}
