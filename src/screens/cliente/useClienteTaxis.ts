import { useCallback, useEffect, useRef, useState } from "react";
import { obtenerUbicacionActual } from "../../infrastructure/location/location.service";
import { escucharDisponibilidadRutas } from "../../infrastructure/supabase/repositories/rutas.repository";
import { obtenerTaxisDisponibles } from "../../infrastructure/supabase/repositories/vehiculos.repository";
import type { Coordenadas, TaxiDisponible } from "../../modules/cliente/ubicacion";
import { mensajeError } from "./useClienteInicio";

// Un taxista envía su ubicación y una reserva aparta asientos a la vez.
const ESPERA_TIEMPO_REAL_MS = 800;

/** Todos los taxis con asientos, ordenados por distancia si hay GPS. */
export function useClienteTaxis() {
  const [taxis, setTaxis] = useState<TaxiDisponible[]>([]);
  const [cargando, setCargando] = useState(true);
  const [refrescando, setRefrescando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conDistancia, setConDistancia] = useState(false);

  // Descarta respuestas de solicitudes que ya fueron reemplazadas.
  const solicitud = useRef(0);

  /** Con `coordenadas` (p. ej. al elegir «Mi ubicación actual») no lee el GPS. */
  const cargar = useCallback(async (coordenadas?: Coordenadas) => {
    const actual = ++solicitud.current;
    setError(null);

    try {
      // Inicio ya pidió el permiso: aquí no se vuelve a pedir. Sin GPS se
      // muestran igual, sin distancia.
      const punto =
        coordenadas ?? (await obtenerUbicacionActual(undefined, false).catch(() => null));
      const datos = await obtenerTaxisDisponibles(punto);
      if (actual === solicitud.current) {
        setTaxis(datos);
        setConDistancia(punto !== null);
      }
    } catch (e: unknown) {
      if (actual === solicitud.current) {
        setError(mensajeError(e, "No se pudieron cargar los taxis disponibles."));
      }
    } finally {
      if (actual === solicitud.current) {
        setCargando(false);
      }
    }
  }, []);

  const refrescar = useCallback(async () => {
    setRefrescando(true);
    await cargar();
    setRefrescando(false);
  }, [cargar]);

  useEffect(() => {
    void cargar();

    let espera: ReturnType<typeof setTimeout> | undefined;
    const dejarDeEscuchar = escucharDisponibilidadRutas(() => {
      clearTimeout(espera);
      espera = setTimeout(() => void cargar(), ESPERA_TIEMPO_REAL_MS);
    });

    return () => {
      solicitud.current += 1;
      clearTimeout(espera);
      dejarDeEscuchar();
    };
  }, [cargar]);

  return { taxis, cargando, refrescando, error, conDistancia, cargar, refrescar };
}
