import { useCallback, useEffect, useRef, useState } from "react";
import {
  escucharReservasCliente,
  obtenerReservasCliente,
} from "../../infrastructure/supabase/repositories/reservas.repository";
import { useAutenticacionStore } from "../../store/autenticacionStore";
import {
  esReservaActiva,
  type ReservaCliente,
} from "../../modules/cliente/reservas";
import { mensajeError } from "./useClienteInicio";

export function useClienteReservaciones() {
  const { usuario } = useAutenticacionStore();
  const usuarioId = usuario?.id ?? null;

  const [reservas, setReservas] = useState<ReservaCliente[]>([]);
  const [cargando, setCargando] = useState(true);
  const [refrescando, setRefrescando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Descarta respuestas de solicitudes que ya fueron reemplazadas.
  const solicitud = useRef(0);

  const cargar = useCallback(async () => {
    const actual = ++solicitud.current;
    setError(null);

    if (!usuarioId) {
      setError("No se encontró una sesión de cliente activa.");
      setCargando(false);
      return;
    }

    try {
      const datos = await obtenerReservasCliente(usuarioId);
      if (actual === solicitud.current) {
        setReservas(datos);
      }
    } catch (e: unknown) {
      if (actual === solicitud.current) {
        setError(mensajeError(e, "No se pudieron cargar tus reservaciones."));
      }
    } finally {
      if (actual === solicitud.current) {
        setCargando(false);
      }
    }
  }, [usuarioId]);

  const refrescar = useCallback(async () => {
    setRefrescando(true);
    await cargar();
    setRefrescando(false);
  }, [cargar]);

  useEffect(() => {
    void cargar();
    if (!usuarioId) {
      return;
    }

    // El taxista acepta, rechaza o completa desde su app: refleja el cambio.
    const dejarDeEscuchar = escucharReservasCliente(usuarioId, () => {
      void cargar();
    });

    return () => {
      solicitud.current += 1;
      dejarDeEscuchar();
    };
  }, [cargar, usuarioId]);

  return {
    activas: reservas.filter((reserva) => esReservaActiva(reserva.estado)),
    historial: reservas.filter((reserva) => !esReservaActiva(reserva.estado)),
    cargando,
    refrescando,
    error,
    cargar,
    refrescar,
  };
}
