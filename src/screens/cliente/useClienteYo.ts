import { useCallback, useEffect, useRef, useState } from "react";
import {
  obtenerDireccionActual,
  observarUbicacion,
} from "../../infrastructure/location/location.service";
import { distanciaEntre } from "../../modules/cliente/seguimiento";
import type { Coordenadas } from "../../modules/cliente/ubicacion";
import { mensajeError } from "./useClienteInicio";

const MENSAJE_PERMISO = "Se necesita permiso de ubicación para mostrarte en el mapa.";
const OPCIONES_OBSERVAR = { distanciaMetros: 10, intervaloMs: 5_000 };
// La dirección solo se vuelve a buscar al moverse una cuadra.
const METROS_NUEVA_DIRECCION = 100;

/** Ubicación del cliente en el mapa mientras la pantalla está abierta. */
export function useClienteYo() {
  const [ubicacion, setUbicacion] = useState<Coordenadas | null>(null);
  const [direccion, setDireccion] = useState<string | null>(null);
  const [buscando, setBuscando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Cambia para volver a pedir el permiso desde «Reintentar».
  const [intento, setIntento] = useState(0);

  const ubicacionDireccion = useRef<Coordenadas | null>(null);

  useEffect(() => {
    let activo = true;
    let dejarDeObservar: (() => void) | undefined;
    setBuscando(true);
    setError(null);

    observarUbicacion(
      (coordenadas) => {
        if (activo) {
          setUbicacion(coordenadas);
          setBuscando(false);
        }
      },
      MENSAJE_PERMISO,
      OPCIONES_OBSERVAR
    ).then(
      (detener) => {
        if (activo) {
          dejarDeObservar = detener;
        } else {
          detener();
        }
      },
      (e: unknown) => {
        if (activo) {
          setError(mensajeError(e, "No se pudo obtener tu ubicación."));
          setBuscando(false);
        }
      }
    );

    return () => {
      activo = false;
      dejarDeObservar?.();
    };
  }, [intento]);

  useEffect(() => {
    const anterior = ubicacionDireccion.current;
    if (!ubicacion || (anterior && distanciaEntre(anterior, ubicacion) < METROS_NUEVA_DIRECCION)) {
      return;
    }
    ubicacionDireccion.current = ubicacion;
    // No se cancela al llegar otra posición cercana: esa no busca dirección.
    obtenerDireccionActual(ubicacion).then(
      (texto) => {
        if (ubicacionDireccion.current === ubicacion) {
          setDireccion(texto);
        }
      },
      // Sin dirección se muestra solo el mapa.
      () => undefined
    );
  }, [ubicacion]);

  const reintentar = useCallback(() => setIntento((actual) => actual + 1), []);

  return { ubicacion, direccion, buscando, error, reintentar };
}
