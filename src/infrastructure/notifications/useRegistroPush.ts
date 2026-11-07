import { useEffect } from "react";
import { AppState, Platform } from "react-native";
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { ToastMessage } from "../../components/ToastMessaje";
import { establecerUsuarioPush, sincronizarDispositivoPush } from "./registroPush.service";

export function useRegistroPush(usuarioId: string | null): void {
  useEffect(() => {
    establecerUsuarioPush(usuarioId);
    if (!usuarioId) return;
    if ((Platform.OS !== "android" && Platform.OS !== "ios") || Constants.appOwnership === "expo") return;
    let activo = true;
    let sincronizando = false;
    let repetir = false;
    let tokenPendiente: Notifications.DevicePushToken | undefined;
    let avisoMostrado = false;

    const sincronizar = async (pedirPermiso = false, tokenNativo?: Notifications.DevicePushToken) => {
      if (!activo) return;
      if (sincronizando) {
        repetir = true;
        if (tokenNativo) tokenPendiente = tokenNativo;
        return;
      }
      sincronizando = true;
      try {
        await sincronizarDispositivoPush(usuarioId, pedirPermiso, tokenNativo);
      } catch {
        if (activo && !avisoMostrado) {
          avisoMostrado = true;
          ToastMessage.show("No se pudieron activar los avisos push. Reintentaremos al volver a la app.", "long");
        }
      } finally {
        sincronizando = false;
        if (activo && repetir) {
          repetir = false;
          const siguienteToken = tokenPendiente;
          tokenPendiente = undefined;
          void sincronizar(false, siguienteToken);
        }
      }
    };
    // No iniciar diálogos mientras la app está en segundo plano.
    let inicioPendiente = AppState.currentState !== "active";
    if (!inicioPendiente) void sincronizar(true);
    let enSegundoPlano = AppState.currentState === "background";
    const cambio = AppState.addEventListener("change", (estado) => {
      if (estado === "background") enSegundoPlano = true;
      if (estado === "active" && (enSegundoPlano || inicioPendiente)) {
        enSegundoPlano = false;
        inicioPendiente = false;
        void sincronizar(true);
      }
    });
    const token = Notifications.addPushTokenListener(tokenNativo => { void sincronizar(false, tokenNativo); });
    return () => {
      activo = false;
      establecerUsuarioPush(null);
      cambio.remove();
      token.remove();
    };
  }, [usuarioId]);
}
