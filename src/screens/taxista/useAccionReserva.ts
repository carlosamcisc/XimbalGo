import { useCallback } from "react";
import { Alert } from "react-native";
import { ToastMessage } from "../../components/ToastMessaje";
import {
  PRESENTACION_ACCION,
  type AccionReserva,
} from "../../modules/taxista/types";
import { useTaxista } from "./TaxistaContext";

/** Pide confirmación si la acción la necesita, la ejecuta y avisa el resultado. */
export function useAccionReserva(onExito?: () => void) {
  const { responderReserva } = useTaxista();

  return useCallback(
    (reservaId: string, accion: AccionReserva) => {
      const presentacion = PRESENTACION_ACCION[accion];
      const ejecutar = async () => {
        const error = await responderReserva(reservaId, accion);
        if (error) {
          ToastMessage.show(error, "long");
          return;
        }
        ToastMessage.show(presentacion.exito);
        onExito?.();
      };

      if (!presentacion.confirmacion) {
        void ejecutar();
        return;
      }
      Alert.alert(presentacion.etiqueta, presentacion.confirmacion, [
        { text: "Volver", style: "cancel" },
        { text: presentacion.etiqueta, style: "destructive", onPress: () => void ejecutar() },
      ]);
    },
    [responderReserva, onExito]
  );
}
