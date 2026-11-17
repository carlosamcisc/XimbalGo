import { useEffect, useMemo } from "react";
import { createNavigationContainerRef } from "@react-navigation/native";
import { Alert, Platform } from "react-native";
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import type { AppStackParamList } from "../../navigation/types";
import { obtenerEstadoAutenticacion, useAutenticacionStore } from "../../store/autenticacionStore";
import { obtenerAvisoPushPropio, marcarAvisoPushLeido } from "../supabase/repositories/aperturaPush.repository";
import { crearControladorAperturaPush } from "./aperturaPush";

export const navegacionPush = createNavigationContainerRef<AppStackParamList>();

/** Se monta antes de las fuentes: conserva el toque hasta tener sesión y stack. */
export function useAperturaPush() {
  const auth = useAutenticacionStore();
  const controlador = useMemo(() => crearControladorAperturaPush({
    contexto: () => {
      const estado = obtenerEstadoAutenticacion();
      return {
        usuarioId: estado.usuario?.id ?? null,
        rol: estado.rol === "cliente" || estado.rol === "taxista" ? estado.rol : null,
        disponible: !estado.inicializando && !estado.errorInicializacion && !estado.recuperandoContrasena,
      };
    },
    navegacionLista: rol => navegacionPush.isReady() &&
      Boolean(navegacionPush.getRootState()?.routeNames.includes(rol === "cliente" ? "ClienteReserva" : "TaxistaReserva")),
    consultar: obtenerAvisoPushPropio,
    abrir: (rol, reservaId, notificacionId) => {
      if (rol === "cliente") navegacionPush.navigate("ClienteReserva", { reservaId, notificacionId });
      else navegacionPush.navigate("TaxistaReserva", { reservaId, notificacionId });
    },
    marcarLeida: marcarAvisoPushLeido,
    consumir: identificador => {
      if (Notifications.getLastNotificationResponse()?.notification.request.identifier === identificador) {
        Notifications.clearLastNotificationResponse();
      }
    },
    avisar: (mensaje, reintentar) => Alert.alert("Notificación", mensaje, reintentar
      ? [{ text: "Ahora no", style: "cancel" }, { text: "Reintentar", onPress: reintentar }]
      : [{ text: "Aceptar" }]),
  }), []);

  useEffect(() => {
    if ((Platform.OS !== "android" && Platform.OS !== "ios") || Constants.appOwnership === "expo") return;
    controlador.iniciar();
    const recibir = (respuesta: Notifications.NotificationResponse) => {
      if (respuesta.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
      controlador.recibir(respuesta.notification.request.identifier, respuesta.notification.request.content.data);
    };
    const escucha = Notifications.addNotificationResponseReceivedListener(recibir);
    const inicial = Notifications.getLastNotificationResponse();
    if (inicial) recibir(inicial);
    return () => { escucha.remove(); controlador.detener(); };
  }, [controlador]);

  useEffect(() => {
    controlador.actualizar();
  }, [controlador, auth]);

  return controlador.actualizar;
}
