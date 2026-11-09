import { useCallback, useEffect, useRef, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { AppState } from "react-native";
import { obtenerReservaTaxista } from "../../infrastructure/supabase/repositories/taxista.repository";
import { escucharReserva } from "../../infrastructure/supabase/repositories/reservas.repository";
import type { ReservaTaxista } from "../../modules/taxista/types";

/** La consulta puntual incluye el historial y vuelve a validar el taxista en SQL. */
export function useReservaTaxista(reservaId: string, notificacionId: string | undefined, procesandoId: string | null) {
  const [reserva, setReserva] = useState<ReservaTaxista | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const solicitud = useRef(0);
  const cargar = useCallback(async () => {
    const actual = ++solicitud.current;
    setError(null);
    try {
      const datos = await obtenerReservaTaxista(reservaId);
      if (actual !== solicitud.current) return;
      setReserva(datos);
      if (!datos) setError("Esta reserva ya no está disponible para tu cuenta.");
    } catch {
      if (actual === solicitud.current) {
        setError("No se pudo actualizar la reserva. Comprueba tu conexión y vuelve a intentarlo.");
      }
    } finally {
      if (actual === solicitud.current) setCargando(false);
    }
  }, [reservaId]);

  useFocusEffect(useCallback(() => {
    void cargar();
    const detener = escucharReserva(reservaId, null, () => { void cargar(); });
    const app = AppState.addEventListener("change", estado => {
      if (estado === "active") void cargar();
    });
    return () => { solicitud.current += 1; detener(); app.remove(); };
  }, [cargar, reservaId, notificacionId]));

  // Las RPC de acciones ya terminaron al regresar este indicador a null.
  const anterior = useRef(procesandoId);
  useEffect(() => {
    if (anterior.current === reservaId && procesandoId === null) void cargar();
    anterior.current = procesandoId;
  }, [procesandoId, reservaId, cargar]);

  return { reserva, cargando, error, cargar };
}
