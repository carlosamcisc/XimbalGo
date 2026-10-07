import { supabase } from "../client";

import type { DatosRegistro } from "./auth.types";
import type { RolUsuario } from "../../../modules/usuarios/types";

// =====================================================
// INICIAR SESIÓN
// =====================================================

export async function iniciarSesion(
  correo: string,
  password: string
) {
  const { data, error } =
    await supabase.auth.signInWithPassword({
      email: correo.trim(),
      password,
    });

  if (error) {
    throw error;
  }

  return data;
}


// =====================================================
// REGISTRAR USUARIO
// =====================================================

export async function registrarUsuario(
  datos: DatosRegistro
) {
  const rolId: 2 | 3 =
    datos.rol === "taxista" ? 2 : 3;

  const metadata = {
    rol_id: rolId,
    nombres: datos.nombres.trim(),
    apellidos: datos.apellidos.trim(),
    telefono: datos.telefono.trim(),

    ...(datos.edad !== undefined && {
      edad: datos.edad,
    }),

    ...(datos.direccion?.trim() && {
      direccion: datos.direccion.trim(),
    }),

    ...(datos.puntoPartida?.trim() && {
      punto_partida: datos.puntoPartida.trim(),
    }),

    ...(datos.puntoDestino?.trim() && {
      punto_destino: datos.puntoDestino.trim(),
    }),

    ...(datos.horarioTrabajo?.trim() && {
      horario_trabajo: datos.horarioTrabajo.trim(),
    }),

    ...(datos.precioRuta !== undefined && {
      precio_ruta: datos.precioRuta,
    }),
  };

  const { data, error } =
    await supabase.auth.signUp({
      email: datos.correo.trim(),
      password: datos.password,

      options: {
        data: metadata,
      },
    });

  if (error) {
    throw error;
  }

  return data;
}


// =====================================================
// RECUPERAR CONTRASEÑA
// =====================================================

export async function recuperarContrasena(
  correo: string
) {
  const { error } =
    await supabase.auth.resetPasswordForEmail(
      correo.trim(),
      {
        redirectTo:
          "ximbalgo://recuperar-contrasena",
      }
    );

  if (error) {
    throw error;
  }
}


// =====================================================
// CAMBIAR CONTRASEÑA
// =====================================================

export async function cambiarContrasena(
  nuevaContrasena: string
) {
  const { data, error } =
    await supabase.auth.updateUser({
      password: nuevaContrasena,
    });

  if (error) {
    throw error;
  }

  return data;
}


// =====================================================
// CERRAR SESIÓN
// =====================================================

export async function cerrarSesion() {
  const { error } =
    await supabase.auth.signOut();

  if (error) {
    throw error;
  }
}


// =====================================================
// USUARIO ACTUAL
// =====================================================

export async function obtenerUsuarioActual() {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    throw error;
  }

  return user;
}

// =====================================================
// ROL DEL USUARIO
// =====================================================

export async function obtenerRolUsuario(
  usuarioId: string
): Promise<RolUsuario> {
  const { data: perfil, error: errorPerfil } = await supabase
    .from("usuarios")
    .select("rol_id")
    .eq("id", usuarioId)
    .maybeSingle();

  if (errorPerfil) {
    throw errorPerfil;
  }

  if (!perfil) {
    throw new Error("No se encontró el perfil asociado a esta cuenta.");
  }

  const { data: rol, error: errorRol } = await supabase
    .from("roles")
    .select("nombre")
    .eq("id", perfil.rol_id)
    .single();

  if (errorRol) {
    throw errorRol;
  }

  const nombreRol = rol.nombre.trim().toLowerCase();
  if (
    nombreRol !== "cliente" &&
    nombreRol !== "taxista" &&
    nombreRol !== "administrador"
  ) {
    throw new Error(`El rol "${rol.nombre}" no tiene una pantalla asignada.`);
  }

  return nombreRol;
}


// =====================================================
// SESIÓN ACTUAL
// =====================================================

export async function obtenerSesion() {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error) {
    throw error;
  }

  return session;
}