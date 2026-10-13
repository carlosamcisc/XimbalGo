import { useCallback, useEffect, useRef, useState } from "react";
import {
  escucharDisponibilidadRutas,
  obtenerCatalogoRutas,
  obtenerTaxistasConRuta,
} from "../../infrastructure/supabase/repositories/rutas.repository";
import { construirRutas, type RutaCliente } from "../../modules/cliente/rutas";
import { mensajeError } from "./useClienteInicio";

// Una reserva cambia el asiento y la reserva casi al mismo tiempo: se agrupan
// los eventos en una sola recarga.
const ESPERA_TIEMPO_REAL_MS = 600;

export function useClienteRutas() {
  const [rutas, setRutas] = useState<RutaCliente[]>([]);
  const [cargando, setCargando] = useState(true);
  const [refrescando, setRefrescando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Descarta respuestas de solicitudes que ya fueron reemplazadas.
  const solicitud = useRef(0);

  const cargar = useCallback(async () => {
    const actual = ++solicitud.current;
    setError(null);

    try {
      const [catalogo, taxistas] = await Promise.all([
        obtenerCatalogoRutas(),
        obtenerTaxistasConRuta(),
      ]);
      if (actual === solicitud.current) {
        setRutas(construirRutas(catalogo, taxistas));
      }
    } catch (e: unknown) {
      if (actual === solicitud.current) {
        setError(mensajeError(e, "No se pudieron cargar las rutas."));
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

  return {
    rutas,
    cargando,
    refrescando,
    error,
    cargar,
    refrescar,
  };
}
