import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

export type EstadoPermisoPush = "permitido" | "provisional" | "pendiente" | "bloqueado" | "no_disponible";

export async function obtenerPermisoPush(): Promise<EstadoPermisoPush> {
  if ((Platform.OS !== "android" && Platform.OS !== "ios") || Constants.appOwnership === "expo") return "no_disponible";
  const permisos = await Notifications.getPermissionsAsync();
  if (permisos.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL) return "provisional";
  if (permisos.granted) return "permitido";
  return permisos.canAskAgain ? "pendiente" : "bloqueado";
}
