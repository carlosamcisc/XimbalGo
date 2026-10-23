import { useCallback, useEffect, useRef, useState } from "react";
import { Alert } from "react-native";
import { ToastMessage } from "../../components/ToastMessaje";
import {
  PRESENTACION_ACCION,
  type AccionReserva,
} from "../../modules/taxista/types";
import { useTaxista } from "./TaxistaContext";

// En iOS un `Modal` no se presenta mientras otro se está cerrando: el panel
// de motivo u oferta espera a que termine de cerrarse el detalle.
const ESPERA_CIERRE_PANEL_MS = 350;

export type PanelReserva =
  | { tipo: "motivo"; reservaId: string; accion: AccionReserva }
  | { tipo: "oferta"; reservaId: string };

interface OpcionesAccion {
  onExito?: () => void;
  /** Se llama desde otro panel que se está cerrando. */
  desdePanel?: boolean;
}

/**
 * Acciones sobre una reserva: pide confirmación o motivo si la acción lo
 * necesita, la ejecuta y avisa el resultado. También abre la oferta de
 * asientos. `PanelesReservaTaxista` muestra los paneles.
 */
export function useAccionReserva() {
  const { responderReserva, ofrecerAsientos } = useTaxista();
  const [panel, setPanel] = useState<PanelReserva | null>(null);
  const espera = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(espera.current), []);

  const abrirPanel = useCallback((siguiente: PanelReserva, desdePanel = false) => {
    clearTimeout(espera.current);
    if (desdePanel) {
      espera.current = setTimeout(() => setPanel(siguiente), ESPERA_CIERRE_PANEL_MS);
    } else {
      setPanel(siguiente);
    }
  }, []);

  const cerrarPanel = useCallback(() => setPanel(null), []);

  const ejecutar = useCallback(
    (reservaId: string, accion: AccionReserva, { onExito, desdePanel }: OpcionesAccion = {}) => {
      const presentacion = PRESENTACION_ACCION[accion];
      if (presentacion.motivo) {
        abrirPanel({ tipo: "motivo", reservaId, accion }, desdePanel);
        return;
      }

      const enviar = async () => {
        const error = await responderReserva(reservaId, accion);
        if (error) {
          ToastMessage.show(error, "long");
          return;
        }
        ToastMessage.show(presentacion.exito);
        onExito?.();
      };

      if (!presentacion.confirmacion) {
        void enviar();
        return;
      }
      Alert.alert(presentacion.etiqueta, presentacion.confirmacion, [
        { text: "Volver", style: "cancel" },
        { text: presentacion.etiqueta, style: "destructive", onPress: () => void enviar() },
      ]);
    },
    [responderReserva, abrirPanel]
  );

  const ofrecer = useCallback(
    (reservaId: string, desdePanel = false) => abrirPanel({ tipo: "oferta", reservaId }, desdePanel),
    [abrirPanel]
  );

  /** El panel sigue abierto si falla, para reintentar sin volver a escribir. */
  const confirmarMotivo = useCallback(
    async (motivo: string | null) => {
      if (panel?.tipo !== "motivo") {
        return;
      }
      const error = await responderReserva(panel.reservaId, panel.accion, motivo);
      if (error) {
        ToastMessage.show(error, "long");
        return;
      }
      ToastMessage.show(PRESENTACION_ACCION[panel.accion].exito);
      setPanel(null);
    },
    [panel, responderReserva]
  );

  const confirmarOferta = useCallback(
    async (cantidad: number) => {
      if (panel?.tipo !== "oferta") {
        return;
      }
      const error = await ofrecerAsientos(panel.reservaId, cantidad);
      if (error) {
        ToastMessage.show(error, "long");
        return;
      }
      ToastMessage.show("Oferta enviada. El cliente decidirá si la acepta.");
      setPanel(null);
    },
    [panel, ofrecerAsientos]
  );

  return { ejecutar, ofrecer, panel, abrirPanel, cerrarPanel, confirmarMotivo, confirmarOferta };
}

export type AccionesReserva = ReturnType<typeof useAccionReserva>;
