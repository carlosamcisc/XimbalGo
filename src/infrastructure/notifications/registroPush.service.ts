import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { randomUUID } from "expo-crypto";
import * as Notifications from "expo-notifications";
import { Alert, Platform } from "react-native";
import { conTiempoLimite } from "../../modules/cliente/tiempoLimite";
import { supabase } from "../supabase/client";
import { eliminarDispositivoPush, guardarDispositivoPush } from "../supabase/repositories/dispositivosPush.repository";

const INSTALACION_KEY = "@ximbalgo/push-instalacion";
const EXPLICACION_KEY = "@ximbalgo/push-explicacion";
export const CANAL_RESERVAS = "reservas";

let usuarioActivo: string | null = null;
let revision = 0;
let escrituras: Promise<void> = Promise.resolve();
let instalacion: Promise<string> | null = null;

function obtenerInstalacion(): Promise<string> {
  if (!instalacion) {
    instalacion = (async () => {
      const guardada = await AsyncStorage.getItem(INSTALACION_KEY);
      if (guardada) return guardada;
      const nueva = randomUUID();
      await AsyncStorage.setItem(INSTALACION_KEY, nueva);
      return nueva;
    })().catch((error: unknown) => { instalacion = null; throw error; });
  }
  return instalacion;
}

// Solo serializa escrituras: un diálogo o petición de token pendiente no
// bloquea el cierre de sesión. Las respuestas tardías se descartan por revisión.
function encolar(operacion: () => Promise<void>): Promise<void> {
  const siguiente = escrituras.then(operacion);
  escrituras = siguiente.catch(() => undefined);
  return siguiente;
}

export function establecerUsuarioPush(usuarioId: string | null): void {
  usuarioActivo = usuarioId;
  revision++;
}

function permisoConcedido(permisos: Notifications.NotificationPermissionsStatus): boolean {
  return permisos.granted || permisos.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
}

async function explicarPermiso(): Promise<boolean> {
  if (await AsyncStorage.getItem(EXPLICACION_KEY)) return false;
  return new Promise<boolean>((resolve) => {
    const responder = (acepta: boolean) => {
      void AsyncStorage.setItem(EXPLICACION_KEY, "true").catch(() => undefined);
      resolve(acepta);
    };
    Alert.alert("Avisos de tus reservaciones",
      "Ximbal Go puede avisarte de solicitudes, respuestas y cancelaciones aunque no tengas la app abierta.",
      [
        { text: "Ahora no", style: "cancel", onPress: () => responder(false) },
        { text: "Continuar", onPress: () => responder(true) },
      ], { cancelable: true, onDismiss: () => responder(false) });
  });
}

export async function sincronizarDispositivoPush(
  usuarioId: string,
  pedirPermiso = false,
  devicePushToken?: Notifications.DevicePushToken,
  solicitudExplicita = false,
): Promise<void> {
  if (Platform.OS !== "android" && Platform.OS !== "ios") return;
  if (Constants.appOwnership === "expo") return;
  const actual = revision;
  const vigente = () => usuarioActivo === usuarioId && revision === actual;
  if (!vigente()) return;

  const proyectoId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  const entorno: unknown = Constants.expoConfig?.extra?.pushEnvironment;
  if (!proyectoId || !["development", "preview", "production"].includes(String(entorno))) {
    throw new Error("Falta la configuración de notificaciones de esta compilación.");
  }
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync(CANAL_RESERVAS, {
      name: "Reservaciones", importance: Notifications.AndroidImportance.HIGH,
      // Omitir sound usa el sonido del sistema; un string nombra un recurso.
      vibrationPattern: [0, 250, 250, 250],
    });
  }
  let permisos = await Notifications.getPermissionsAsync();
  if (vigente() && !permisoConcedido(permisos) && permisos.canAskAgain && pedirPermiso
      && (solicitudExplicita || await explicarPermiso()) && vigente()) {
    permisos = await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowSound: true, allowBadge: true },
    });
  }
  if (!vigente()) return;
  if (!permisoConcedido(permisos)) {
    // También retira el token si el usuario revocó el permiso en Ajustes.
    await encolar(async () => {
      if (!vigente()) return;
      const id = await AsyncStorage.getItem(INSTALACION_KEY);
      if (id && vigente()) await eliminarDispositivoPush(usuarioId, id);
    });
    return;
  }

  const id = await obtenerInstalacion();
  const token = await conTiempoLimite(
    // Dentro del listener hay que reutilizar el token recibido: pedir otro
    // token nativo vuelve a emitir el evento y puede producir un bucle.
    Notifications.getExpoPushTokenAsync({ projectId: proyectoId, devicePushToken }), 20_000,
    "No se pudo obtener el token de notificaciones a tiempo.",
  );
  if (!vigente()) return;
  await encolar(async () => {
    if (!vigente()) return;
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    if (!vigente() || data.session?.user.id !== usuarioId) return;
    await guardarDispositivoPush({
      usuario_id: usuarioId, instalacion_id: id, expo_push_token: token.data,
      plataforma: Platform.OS, proyecto_id: proyectoId,
      entorno: String(entorno), activo: true,
    });
  });
}

export async function desvincularDispositivoPush(usuarioId: string): Promise<void> {
  establecerUsuarioPush(null);
  await encolar(async () => {
    const id = await AsyncStorage.getItem(INSTALACION_KEY);
    if (id) await eliminarDispositivoPush(usuarioId, id);
  });
}
