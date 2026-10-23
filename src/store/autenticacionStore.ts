import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Session, User } from "@supabase/supabase-js";
import { useSyncExternalStore } from "react";
import {
  cerrarSesion as cerrarSesionSupabase,
  obtenerRolUsuario,
} from "../infrastructure/supabase/auth/auth.service";
import { supabase } from "../infrastructure/supabase/client";
import type { RolUsuario } from "../modules/usuarios/types";

const BIENVENIDA_COMPLETADA_KEY = "@ximbalgo/bienvenida-completada";
const RECUPERACION_PENDIENTE_KEY = "@ximbalgo/recuperacion-pendiente";

export interface AutenticacionState {
  usuario: User | null;
  sesion: Session | null;
  rol: RolUsuario | null;
  bienvenidaCompletada: boolean;
  // La sesión abierta por un enlace de recuperación solo sirve para
  // cambiar la contraseña; mientras esté activa no se entra a la cuenta.
  recuperandoContrasena: boolean;
  inicializando: boolean;
  errorInicializacion: string | null;
}

const initialState: AutenticacionState = {
  usuario: null,
  sesion: null,
  rol: null,
  bienvenidaCompletada: false,
  recuperandoContrasena: false,
  inicializando: true,
  errorInicializacion: null,
};

let state = initialState;
let initialization: Promise<void> | null = null;
let authSubscription: { unsubscribe: () => void } | null = null;
let authEventReceived = false;
const listeners = new Set<() => void>();

function updateState(nextState: Partial<AutenticacionState>) {
  state = { ...state, ...nextState };
  listeners.forEach((listener) => listener());
}

function getSnapshot() {
  return state;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useAutenticacionStore() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function inicializarAutenticacion(): Promise<void> {
  if (initialization) {
    return initialization;
  }

  updateState({ inicializando: true, errorInicializacion: null });
  authEventReceived = false;
  authSubscription = supabase.auth.onAuthStateChange((event, session) => {
    authEventReceived = true;
    if (event === "PASSWORD_RECOVERY") {
      iniciarRecuperacionContrasena();
    }
    updateState({
      sesion: session,
      usuario: session?.user ?? null,
      ...(
        event === "SIGNED_OUT" ||
        session?.user.id !== state.usuario?.id
          ? { rol: null }
          : {}
      ),
    });
  }).data.subscription;

  initialization = (async () => {
    try {
      const [bienvenidaCompletada, recuperacionPendiente, sessionResult] =
        await Promise.all([
          AsyncStorage.getItem(BIENVENIDA_COMPLETADA_KEY),
          AsyncStorage.getItem(RECUPERACION_PENDIENTE_KEY),
          supabase.auth.getSession(),
        ]);

      if (sessionResult.error) {
        throw sessionResult.error;
      }

      if (!authEventReceived) {
        updateState({
          sesion: sessionResult.data.session,
          usuario: sessionResult.data.session?.user ?? null,
          rol: null,
        });
      }

      const session = authEventReceived
        ? state.sesion
        : sessionResult.data.session;

      // Si la app se cerró a mitad de una recuperación, la sesión guardada
      // sigue siendo de recuperación: se retoma el cambio de contraseña.
      if (recuperacionPendiente === "true") {
        if (session) {
          updateState({ recuperandoContrasena: true });
        } else {
          await AsyncStorage.removeItem(RECUPERACION_PENDIENTE_KEY);
        }
      }

      if (session && !state.recuperandoContrasena) {
        const rol = await obtenerRolUsuario(session.user.id);
        if (state.sesion?.user.id === session.user.id) {
          updateState({ rol });
        }
      }

      updateState({
        bienvenidaCompletada: bienvenidaCompletada === "true",
        inicializando: false,
        errorInicializacion: null,
      });
    } catch (error: unknown) {
      authSubscription?.unsubscribe();
      authSubscription = null;
      initialization = null;
      updateState({
        inicializando: false,
        errorInicializacion:
          error instanceof Error
            ? error.message
            : "No se pudo restaurar el estado de autenticación.",
      });
    }
  })();

  return initialization;
}

export async function marcarBienvenidaCompletada(): Promise<void> {
  await AsyncStorage.setItem(BIENVENIDA_COMPLETADA_KEY, "true");
  updateState({ bienvenidaCompletada: true });
}

export function asignarRolUsuario(rol: RolUsuario): void {
  updateState({ rol });
}

export function iniciarRecuperacionContrasena(): void {
  updateState({ recuperandoContrasena: true });
  void AsyncStorage.setItem(RECUPERACION_PENDIENTE_KEY, "true").catch(
    () => undefined
  );
}

export function cancelarRecuperacionContrasena(): void {
  updateState({ recuperandoContrasena: false });
  void AsyncStorage.removeItem(RECUPERACION_PENDIENTE_KEY).catch(
    () => undefined
  );
}

// Cierra la sesión de recuperación para que el usuario entre con su
// contraseña nueva. Si el servidor no responde, la borra del dispositivo.
export async function finalizarRecuperacionContrasena(): Promise<void> {
  if (!state.recuperandoContrasena) {
    return;
  }

  try {
    await cerrarSesionSupabase();
  } catch {
    await supabase.auth.signOut({ scope: "local" });
  }

  updateState({
    sesion: null,
    usuario: null,
    rol: null,
  });
  cancelarRecuperacionContrasena();
}

export async function cerrarSesionUsuario(): Promise<void> {
  await cerrarSesionSupabase();
  updateState({
    sesion: null,
    usuario: null,
    rol: null,
  });
}
