import { useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { useIsFocused } from "@react-navigation/native";
import { obtenerUbicacionActual, observarUbicacion } from "../../infrastructure/location/location.service";
import type { Coordenadas } from "../../modules/cliente/ubicacion";

/** Ubicación local para el pin «Tú»; no modifica la reserva ni su recorrido. */
export function useUbicacionClienteMapa(habilitada: boolean) {
  const [coordenadas, setCoordenadas] = useState<Coordenadas | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activa, setActiva] = useState(AppState.currentState === "active");
  const permisoSolicitado = useRef(false);
  const enfocada = useIsFocused();

  useEffect(() => {
    const listener = AppState.addEventListener("change", estado => {
      // Los diálogos de permiso pueden causar «inactive» en iOS.
      if (estado === "active") setActiva(true);
      if (estado === "background") setActiva(false);
    });
    return () => listener.remove();
  }, []);

  useEffect(() => {
    setCoordenadas(null);
    setError(null);
    if (!habilitada || !enfocada || !activa) return;
    let cancelado = false;
    let detener: (() => void) | undefined;
    const iniciar = async () => {
      try {
        const pedirPermiso = !permisoSolicitado.current;
        permisoSolicitado.current = true;
        const posicion = await obtenerUbicacionActual(
          "Permite la ubicación en los ajustes para mostrar el pin «Tú».",
          pedirPermiso,
          { tiempoEsperaMs: 15_000 },
        );
        if (cancelado) return;
        setCoordenadas(posicion);
        const quitar = await observarUbicacion(nueva => {
          if (!cancelado) setCoordenadas(nueva);
        }, "Permite la ubicación para mostrar el pin «Tú».", { distanciaMetros: 10, intervaloMs: 5_000 });
        if (cancelado) quitar();
        else detener = quitar;
      } catch (causa) {
        if (!cancelado) {
          setCoordenadas(null);
          setError(causa instanceof Error ? causa.message : "No se pudo obtener tu ubicación.");
        }
      }
    };
    void iniciar();
    return () => { cancelado = true; detener?.(); };
  }, [habilitada, enfocada, activa]);

  return { coordenadas, error };
}
