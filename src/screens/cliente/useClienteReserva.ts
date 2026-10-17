import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import {
  cancelarReserva,
  escucharReserva,
  obtenerReservaCliente,
  obtenerSeguimientoReserva,
  responderOfertaAsientos,
} from "../../infrastructure/supabase/repositories/reservas.repository";
import { esReservaActiva, type ReservaCliente } from "../../modules/cliente/reservas";
import { estimarLlegada, type SeguimientoReserva } from "../../modules/cliente/seguimiento";
import { mensajeError } from "./useClienteInicio";

// Los minutos restantes bajan aunque el taxi no envíe otra ubicación.
const INTERVALO_RELOJ_MS = 15_000;
// La reserva y sus asientos cambian casi al mismo tiempo.
const ESPERA_TIEMPO_REAL_MS = 400;

/** Una reservación del cliente con el seguimiento del taxi en tiempo real. */
export function useClienteReserva(reservaId: string) {
  const [reserva, setReserva] = useState<ReservaCliente | null>(null);
  const [seguimiento, setSeguimiento] = useState<SeguimientoReserva | null>(null);
  const [cargando, setCargando] = useState(true);
  const [refrescando, setRefrescando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorSeguimiento, setErrorSeguimiento] = useState<string | null>(null);
  const [cancelando, setCancelando] = useState(false);
  // Respuesta a la oferta de asientos en curso: true acepta, false no.
  const [respondiendo, setRespondiendo] = useState<boolean | null>(null);
  const [ahora, setAhora] = useState(Date.now());

  // Descarta respuestas de solicitudes que ya fueron reemplazadas.
  const solicitud = useRef(0);

  const cargar = useCallback(async () => {
    const actual = ++solicitud.current;
    setError(null);

    // El seguimiento puede fallar sin impedir ver los datos de la reserva.
    const [datosReserva, datosSeguimiento] = await Promise.allSettled([
      obtenerReservaCliente(reservaId),
      obtenerSeguimientoReserva(reservaId),
    ]);
    if (actual !== solicitud.current) {
      return;
    }

    if (datosReserva.status === "fulfilled") {
      setReserva(datosReserva.value);
    } else {
      setError(mensajeError(datosReserva.reason, "No se pudo cargar la reservación."));
    }
    if (datosSeguimiento.status === "fulfilled") {
      setSeguimiento(datosSeguimiento.value);
      setErrorSeguimiento(null);
    } else {
      setErrorSeguimiento(
        mensajeError(datosSeguimiento.reason, "No se pudo obtener la ubicación del taxi.")
      );
    }
    setAhora(Date.now());
    setCargando(false);
  }, [reservaId]);

  const refrescar = useCallback(async () => {
    setRefrescando(true);
    await cargar();
    setRefrescando(false);
  }, [cargar]);

  /** Devuelve un mensaje de error para el usuario, o null si se canceló. */
  const cancelar = useCallback(async (): Promise<string | null> => {
    setCancelando(true);
    try {
      await cancelarReserva(reservaId);
      await cargar();
      return null;
    } catch (e: unknown) {
      return mensajeError(e, "No se pudo cancelar la reservación.");
    } finally {
      setCancelando(false);
    }
  }, [reservaId, cargar]);

  /** Devuelve un mensaje de error para el usuario, o null si se guardó. */
  const responderOferta = useCallback(
    async (acepta: boolean): Promise<string | null> => {
      setRespondiendo(acepta);
      try {
        await responderOfertaAsientos(reservaId, acepta);
        await cargar();
        return null;
      } catch (e: unknown) {
        // El taxista pudo rechazar la solicitud mientras tanto.
        void cargar();
        return mensajeError(e, "No se pudo enviar tu respuesta.");
      } finally {
        setRespondiendo(null);
      }
    },
    [reservaId, cargar]
  );

  useEffect(() => {
    void cargar();
    return () => {
      solicitud.current += 1;
    };
  }, [cargar]);

  // El taxista acepta o cierra la reserva, o envía una ubicación nueva.
  const taxistaId = seguimiento?.taxistaId ?? null;
  const activa = reserva ? esReservaActiva(reserva.estado) : true;
  useEffect(() => {
    let espera: ReturnType<typeof setTimeout> | undefined;
    const dejarDeEscuchar = escucharReserva(reservaId, activa ? taxistaId : null, () => {
      clearTimeout(espera);
      espera = setTimeout(() => void cargar(), ESPERA_TIEMPO_REAL_MS);
    });
    return () => {
      clearTimeout(espera);
      dejarDeEscuchar();
    };
  }, [reservaId, taxistaId, activa, cargar]);

  // Mientras está en curso: reloj para los minutos y recarga al volver a la app.
  useEffect(() => {
    if (!activa) {
      return;
    }
    const reloj = setInterval(() => setAhora(Date.now()), INTERVALO_RELOJ_MS);
    // Solo al volver de segundo plano: ver `TaxistaContext`.
    let estadoAnterior = AppState.currentState;
    const cambioApp = AppState.addEventListener("change", (estado) => {
      if (estadoAnterior === "background" && estado === "active") {
        void cargar();
      }
      estadoAnterior = estado;
    });
    return () => {
      clearInterval(reloj);
      cambioApp.remove();
    };
  }, [activa, cargar]);

  return {
    reserva,
    seguimiento,
    estimacion: seguimiento && activa ? estimarLlegada(seguimiento, ahora) : null,
    activa,
    ahora,
    cargando,
    refrescando,
    error,
    errorSeguimiento,
    cargar,
    refrescar,
    cancelar,
    cancelando,
    responderOferta,
    respondiendo,
  };
}
