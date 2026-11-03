import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { asegurarPermisoSegundoPlano, iniciarUbicacionSegundoPlano, detenerUbicacionSegundoPlano } from "../../infrastructure/location/background-location.service";
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
 * enviando aunque el cliente cambie de pantalla o bloquee el teléfono.
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
        if (!clienteId) throw new Error("No se encontró una sesión de cliente activa.");
        await asegurarPermisoSegundoPlano();
        const ubicacion = await obtenerUbicacionActual(MENSAJE_PERMISO);
        const nueva = await iniciarUbicacionCompartida(ubicacion, minutos);
        // Publicar el enlace solo después de confirmar el servicio nativo.
        try {
          await iniciarUbicacionSegundoPlano({ tipo: "cliente", usuarioId: clienteId, compartidaId: nueva.id, expiraEn: nueva.expiraEn });
        } catch (e) {
          await detenerUbicacionCompartida(nueva.id);
          setCompartida(null);
          throw e;
        }
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
    [clienteId]
  );

  /** Devuelve un mensaje de error para el usuario, o null si se detuvo. */
  const detener = useCallback(async (): Promise<string | null> => {
    if (!compartida) {
      return null;
    }
    setDeteniendo(true);
    try {
      await detenerUbicacionCompartida(compartida.id);
      await detenerUbicacionSegundoPlano();
      setCompartida(null);
      return null;
    } catch (e: unknown) {
      return mensajeError(e, "No se pudo dejar de compartir tu ubicación.");
    } finally {
      setDeteniendo(false);
    }
  }, [compartida]);

  // Mientras está vigente, mantiene también el seguimiento nativo.
  const compartidaId = compartida?.id ?? null;
  const expiraEn = compartida?.expiraEn ?? null;
  useEffect(() => {
    if (!compartidaId || !expiraEn || !clienteId) {
      setEnviadaEn(null);
      setError(null);
      return;
    }

    let activo = true;
    let dejarDeObservar: (() => void) | undefined;
    let errorSegundoPlano: string | null = null;
    const destino = { tipo: "cliente" as const, usuarioId: clienteId, compartidaId, expiraEn };
    const iniciarSeguimiento = () => {
      if (!activo || AppState.currentState !== "active") return;
      void iniciarUbicacionSegundoPlano(destino).then(() => {
        if (!activo) return;
        errorSegundoPlano = null;
        setError(null);
      }, (e: unknown) => {
        errorSegundoPlano = mensajeError(e, "No se pudo iniciar la ubicación en segundo plano.");
        if (activo) setError(errorSegundoPlano);
      });
    };
    iniciarSeguimiento();
    const terminar = () => {
      if (activo) {
        setCompartida(null);
      }
    };
    const enviar = (coordenadas: Coordenadas) => {
      if (!activo) return;
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
          setError(errorSegundoPlano);
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
      if (AppState.currentState === "active") {
        void obtenerUbicacionActual(MENSAJE_PERMISO, false).then(enviar, () => undefined);
      }
    }, REENVIO_UBICACION_MS);
    const vencimiento = setTimeout(
      terminar,
      Math.max(0, new Date(expiraEn).getTime() - Date.now())
    );

    // Al volver se actualiza también la UI de inmediato. Sin
    // pedir permiso, por el ciclo de diálogos descrito en `TaxistaContext`.
    let estadoAnterior = AppState.currentState;
    const cambioApp = AppState.addEventListener("change", (estado) => {
      const volvio = estadoAnterior === "background" && estado === "active";
      estadoAnterior = estado;
      if (estado === "active") iniciarSeguimiento();
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
      void detenerUbicacionSegundoPlano(destino).catch(() => undefined);
      clearInterval(reenvio);
      clearTimeout(vencimiento);
      cambioApp.remove();
    };
  }, [compartidaId, expiraEn, clienteId]);

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
