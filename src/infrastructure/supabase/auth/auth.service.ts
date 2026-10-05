import { supabase } from "../client";

import type { DatosRegistro } from "./auth.types";

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