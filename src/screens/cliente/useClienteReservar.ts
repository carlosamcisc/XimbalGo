import { useCallback, useEffect, useRef, useState } from "react";
import { crearReserva } from "../../infrastructure/supabase/repositories/reservas.repository";
import {
  escucharAsientosVehiculo,
  obtenerTaxiReserva,
} from "../../infrastructure/supabase/repositories/vehiculos.repository";
import { origenDeReserva } from "../../modules/cliente/reservas";
import type { OrigenViaje } from "../../modules/cliente/types";
import type { TaxiReserva } from "../../modules/cliente/ubicacion";
import { mensajeError } from "./useClienteInicio";

// Una reserva aparta varios asientos casi al mismo tiempo.
const ESPERA_TIEMPO_REAL_MS = 400;

export interface DatosReserva {
  origen: OrigenViaje;
  destino: string;
  cantidadAsientos: number;
  fechaViaje: Date | null;
  notas: string;
}

/** Taxi elegido con sus asientos libres en tiempo real, y la acción de reservar. */
export function useClienteReservar(vehiculoId: string) {
  const [taxi, setTaxi] = useState<TaxiReserva | null>(null);
  const [cargando, setCargando] = useState(true);
  const [refrescando, setRefrescando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reservando, setReservando] = useState(false);

  // Descarta respuestas de solicitudes que ya fueron reemplazadas.
  const solicitud = useRef(0);
  const reservandoRef = useRef(false);

  const cargar = useCallback(async () => {
    const actual = ++solicitud.current;
    setError(null);
    try {
      const datos = await obtenerTaxiReserva(vehiculoId);
      if (actual === solicitud.current) {
        setTaxi(datos);
      }
    } catch (e: unknown) {
      if (actual === solicitud.current) {
        setError(mensajeError(e, "No se pudo cargar el taxi."));
      }
    } finally {
      if (actual === solicitud.current) {
        setCargando(false);
      }
    }
  }, [vehiculoId]);

  const refrescar = useCallback(async () => {
    setRefrescando(true);
    await cargar();
    setRefrescando(false);
  }, [cargar]);

  /** Devuelve el id de la reserva creada, o lanza un error con el motivo. */
  const reservar = useCallback(
    async (datos: DatosReserva): Promise<string> => {
      // Un segundo toque antes de re-renderizar crearía la reserva dos veces.
      if (reservandoRef.current) {
        throw new Error("Espera a que termine de enviarse tu reservación.");
      }
      reservandoRef.current = true;
      setReservando(true);
      try {
        return await crearReserva({
          vehiculoId,
          destino: datos.destino,
          ...origenDeReserva(datos.origen),
          notas: datos.notas.trim() || null,
          cantidadAsientos: datos.cantidadAsientos,
          fechaViaje: datos.fechaViaje?.toISOString() ?? null,
        });
      } catch (e: unknown) {
        // Puede que otro cliente haya tomado asientos: refleja los libres.
        void cargar();
        throw new Error(mensajeError(e, "No se pudo crear la reservación."));
      } finally {
        reservandoRef.current = false;
        setReservando(false);
      }
    },
    [vehiculoId, cargar]
  );

  useEffect(() => {
    void cargar();

    let espera: ReturnType<typeof setTimeout> | undefined;
    const dejarDeEscuchar = escucharAsientosVehiculo(vehiculoId, () => {
      clearTimeout(espera);
      espera = setTimeout(() => void cargar(), ESPERA_TIEMPO_REAL_MS);
    });

    return () => {
      solicitud.current += 1;
      clearTimeout(espera);
      dejarDeEscuchar();
    };
  }, [vehiculoId, cargar]);

  return { taxi, cargando, refrescando, error, cargar, refrescar, reservando, reservar };
}
