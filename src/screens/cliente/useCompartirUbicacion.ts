import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import {
  actualizarUbicacionCompartida,
  detenerUbicacionCompartida,
  iniciarUbicacionCompartida,
  obtenerUbicacionCompartidaActiva,
} from "../../infrastructure/supabase/repositories/ubicacionCompartida.repository";
import {
  obtenerUbicacionActual,
  observarUbicacion,
} from "../../infrastructure/location/location.service";
import type { Coordenadas } from "../../modules/cliente/ubicacion";
import type { UbicacionCompartida } from "../../modules/cliente/ubicacionCompartida";
import { mensajeError } from "./useClienteInicio";

const MENSAJE_PERMISO =
  "Se necesita permiso de ubicación para compartirla con tu familiar.";
// Más seguido que el taxista: el familiar sigue a una persona caminando.
const OPCIONES_OBSERVAR = { distanciaMetros: 15, intervaloMs: 10_000 };
// Sin moverse no llegan avisos: el reenvío le muestra al familiar que la
// ubicación sigue al día.
const REENVIO_UBICACION_MS = 60_000;

/**
 * Ubicación compartida con un familiar. Vive en `ClienteContext` para seguir
 * enviando aunque el cliente cambie de pantalla; solo con la app abierta.
 */
export function useCompartirUbicacion(clienteId: string | null) {
  const [compartida, setCompartida] = useState<UbicacionCompartida | null>(null);
  const [enviadaEn, setEnviadaEn] = useState<string | null>(null);
  const [iniciando, setIniciando] = useState(false);
  const [deteniendo, setDeteniendo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ultimaUbicacion = useRef<Coordenadas | null>(null);

  // Al abrir la app retoma la que siga vigente: el familiar ya tiene el enlace.
  useEffect(() => {
    setCompartida(null);
    if (!clienteId) {
      return;
    }
    let activo = true;
    obtenerUbicacionCompartidaActiva().then(
      (actual) => {
        if (activo) {
          setCompartida(actual);
        }
      },
      // Si falla, el cliente puede volver a compartirla.
      () => undefined
    );
    return () => {
      activo = false;
    };
  }, [clienteId]);

  /** Devuelve la ubicación compartida, o un mensaje de error para el usuario. */
  const iniciar = useCallback(
    async (minutos: number): Promise<UbicacionCompartida | string> => {
      setIniciando(true);
      try {
        const ubicacion = await obtenerUbicacionActual(MENSAJE_PERMISO);
        const nueva = await iniciarUbicacionCompartida(ubicacion, minutos);
        ultimaUbicacion.current = ubicacion;
        setCompartida(nueva);
        setEnviadaEn(new Date().toISOString());
        setError(null);
        return nueva;
      } catch (e: unknown) {
        return mensajeError(e, "No se pudo compartir tu ubicación.");
      } finally {
        setIniciando(false);
      }
    },
    []
  );

  /** Devuelve un mensaje de error para el usuario, o null si se detuvo. */
  const detener = useCallback(async (): Promise<string | null> => {
    if (!compartida) {
      return null;
    }
    setDeteniendo(true);
    try {
      await detenerUbicacionCompartida(compartida.id);
      setCompartida(null);
      return null;
    } catch (e: unknown) {
      return mensajeError(e, "No se pudo dejar de compartir tu ubicación.");
    } finally {
      setDeteniendo(false);
    }
  }, [compartida]);

  // Mientras está vigente, envía la ubicación con la app abierta.
  const compartidaId = compartida?.id ?? null;
  const expiraEn = compartida?.expiraEn ?? null;
  useEffect(() => {
    if (!compartidaId || !expiraEn) {
      setEnviadaEn(null);
      setError(null);
      return;
    }

    let activo = true;
    let dejarDeObservar: (() => void) | undefined;
    const terminar = () => {
      if (activo) {
        setCompartida(null);
      }
    };
    const enviar = (coordenadas: Coordenadas) => {
      ultimaUbicacion.current = coordenadas;
      actualizarUbicacionCompartida(compartidaId, coordenadas).then(
        (vigente) => {
          if (!activo) {
            return;
          }
          if (!vigente) {
            // Venció o se detuvo desde otro dispositivo.
            terminar();
            return;
          }
          setEnviadaEn(new Date().toISOString());
          setError(null);
        },
        (e: unknown) => {
          if (activo) {
            setError(mensajeError(e, "No se pudo enviar tu ubicación."));
          }
        }
      );
    };

    observarUbicacion(enviar, MENSAJE_PERMISO, OPCIONES_OBSERVAR).then(
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
        }
      }
    );

    const reenvio = setInterval(() => {
      if (ultimaUbicacion.current) {
        enviar(ultimaUbicacion.current);
      }
    }, REENVIO_UBICACION_MS);
    const vencimiento = setTimeout(
      terminar,
      Math.max(0, new Date(expiraEn).getTime() - Date.now())
    );

    // En segundo plano no se envía: al volver se envía de inmediato. Sin
    // pedir permiso, por el ciclo de diálogos descrito en `TaxistaContext`.
    let estadoAnterior = AppState.currentState;
    const cambioApp = AppState.addEventListener("change", (estado) => {
      const volvio = estadoAnterior === "background" && estado === "active";
      estadoAnterior = estado;
      if (!volvio) {
        return;
      }
      obtenerUbicacionActual(MENSAJE_PERMISO, false).then(enviar, (e: unknown) => {
        if (activo) {
          setError(mensajeError(e, "No se pudo obtener tu ubicación."));
        }
      });
    });

    return () => {
      activo = false;
      dejarDeObservar?.();
      clearInterval(reenvio);
      clearTimeout(vencimiento);
      cambioApp.remove();
    };
  }, [compartidaId, expiraEn]);

  return {
    compartida,
    enviadaEn,
    iniciando,
    deteniendo,
    error,
    iniciar,
    detener,
  };
}
