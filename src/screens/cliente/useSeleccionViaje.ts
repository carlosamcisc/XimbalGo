import { useCallback, useEffect, useRef, useState } from "react";
import { guardarUbicacionCliente } from "../../infrastructure/supabase/repositories/cliente.repository";
import { obtenerPuntosRutas } from "../../infrastructure/supabase/repositories/rutas.repository";
import {
  obtenerDireccionActual,
  obtenerUbicacionActual,
} from "../../infrastructure/location/location.service";
import { normalizarTexto } from "../../modules/cliente/rutas";
import { etiquetaOrigen } from "../../modules/cliente/reservas";
import type { Coordenadas } from "../../modules/cliente/ubicacion";
import type {
  OrigenViaje,
  ParaderoViaje,
  TipoPuntoViaje,
} from "../../modules/cliente/types";
import { mensajeError } from "./mensajeError";

const MENSAJE_MISMO_PUNTO = "El origen y el destino deben ser distintos.";

/** Nombre del origen para compararlo con el destino; el GPS no tiene. */
function nombreOrigen(origen: OrigenViaje | null): string | null {
  if (origen?.tipo === "ruta") {
    return origen.nombre;
  }
  if (origen?.tipo === "paradero") {
    return origen.paradero.nombre;
  }
  return null;
}

const mismoPunto = (a: string | null, b: string | null) =>
  a !== null && b !== null && normalizarTexto(a) === normalizarTexto(b);

interface Opciones {
  origenInicial?: OrigenViaje | null;
  destinoInicial?: string | null;
  /** Se obtuvo el GPS al elegir «Mi ubicación actual». */
  alObtenerUbicacion?: (punto: Coordenadas) => void;
  /** No se pudo obtener el GPS; recibe el mensaje para el usuario. */
  alFallarUbicacion?: (mensaje: string) => void;
}

/**
 * Origen y destino del viaje con las reglas de Inicio: opciones del catálogo
 * de rutas, «Mi ubicación actual», un paradero como origen, y que el origen y
 * el destino sean distintos. Lo usan Inicio y la lista de taxis.
 */
export function useSeleccionViaje({
  origenInicial = null,
  destinoInicial = null,
  alObtenerUbicacion,
  alFallarUbicacion,
}: Opciones = {}) {
  const [opciones, setOpciones] = useState<Record<TipoPuntoViaje, string[]>>({
    origen: [],
    destino: [],
  });
  const [cargandoOpciones, setCargandoOpciones] = useState(false);
  const [errorOpciones, setErrorOpciones] = useState<string | null>(null);
  const [origen, setOrigen] = useState<OrigenViaje | null>(origenInicial);
  const [destino, setDestino] = useState<string | null>(destinoInicial);
  const [obteniendoUbicacion, setObteniendoUbicacion] = useState(false);

  // Cada contador descarta respuestas de solicitudes que ya fueron reemplazadas.
  const solicitudOpciones = useRef(0);
  const solicitudOrigen = useRef(0);

  // Las funciones de la pantalla cambian en cada render; se leen al usarse.
  const avisos = useRef({ alObtenerUbicacion, alFallarUbicacion });
  avisos.current = { alObtenerUbicacion, alFallarUbicacion };

  /** Trae de Supabase todos los orígenes o destinos de las rutas activas. */
  const cargarOpciones = useCallback(async (tipo: TipoPuntoViaje) => {
    const solicitud = ++solicitudOpciones.current;
    setCargandoOpciones(true);
    setErrorOpciones(null);

    try {
      const puntos = await obtenerPuntosRutas(tipo);
      if (solicitud !== solicitudOpciones.current) {
        return;
      }

      setOpciones((actuales) => ({ ...actuales, [tipo]: puntos }));

      // Descarta la selección si su ruta dejó de estar activa.
      const sigueDisponible = (nombre: string) =>
        puntos.some((punto) => mismoPunto(punto, nombre));
      if (tipo === "origen") {
        setOrigen((actual) =>
          actual?.tipo === "ruta" && !sigueDisponible(actual.nombre) ? null : actual
        );
      } else {
        setDestino((actual) => (actual && !sigueDisponible(actual) ? null : actual));
      }
    } catch (error: unknown) {
      if (solicitud === solicitudOpciones.current) {
        setErrorOpciones(
          mensajeError(error, `No se pudieron cargar los ${tipo === "origen" ? "orígenes" : "destinos"}.`)
        );
      }
    } finally {
      if (solicitud === solicitudOpciones.current) {
        setCargandoOpciones(false);
      }
    }
  }, []);

  /**
   * Usa el GPS como origen. Devuelve un mensaje para el usuario si no se pudo
   * usar o guardar el GPS.
   */
  const usarUbicacionActual = useCallback(async (): Promise<string | null> => {
    const solicitud = ++solicitudOrigen.current;
    setObteniendoUbicacion(true);

    let punto: Coordenadas;
    try {
      punto = await obtenerUbicacionActual();
    } catch (error: unknown) {
      const mensaje = mensajeError(error, "No se pudo obtener tu ubicación actual.");
      avisos.current.alFallarUbicacion?.(mensaje);
      if (solicitud === solicitudOrigen.current) {
        setObteniendoUbicacion(false);
        return mensaje;
      }
      return null;
    }

    avisos.current.alObtenerUbicacion?.(punto);
    // El cliente eligió otro origen mientras se obtenía el GPS.
    if (solicitud !== solicitudOrigen.current) {
      return null;
    }

    setOrigen({ tipo: "ubicacion", coordenadas: punto, direccion: null });
    setObteniendoUbicacion(false);

    // La dirección es opcional: si falla, el origen sigue siendo el GPS.
    const [guardado, direccion] = await Promise.allSettled([
      guardarUbicacionCliente(punto),
      obtenerDireccionActual(punto),
    ]);
    if (
      direccion.status === "fulfilled" &&
      direccion.value &&
      solicitud === solicitudOrigen.current
    ) {
      const texto = direccion.value;
      setOrigen((actual) =>
        actual?.tipo === "ubicacion" ? { ...actual, direccion: texto } : actual
      );
    }
    if (guardado.status === "rejected") {
      return mensajeError(guardado.reason, "No se pudo guardar tu ubicación.");
    }
    return null;
  }, []);

  /** Devuelve un mensaje para el usuario si la selección tuvo que ajustarse. */
  const elegirOrigen = useCallback(
    (nuevo: OrigenViaje): string | null => {
      solicitudOrigen.current += 1;
      setObteniendoUbicacion(false);
      setOrigen(nuevo);

      if (mismoPunto(nombreOrigen(nuevo), destino)) {
        setDestino(null);
        return `${MENSAJE_MISMO_PUNTO} Elige un nuevo destino.`;
      }
      return null;
    },
    [destino]
  );

  const seleccionarOrigen = useCallback(
    (nombre: string) => elegirOrigen({ tipo: "ruta", nombre }),
    [elegirOrigen]
  );

  const seleccionarOrigenParadero = useCallback(
    (paradero: ParaderoViaje) => elegirOrigen({ tipo: "paradero", paradero }),
    [elegirOrigen]
  );

  /** Devuelve un mensaje para el usuario si el destino no es válido. */
  const seleccionarDestino = useCallback(
    (nombre: string): string | null => {
      if (mismoPunto(nombreOrigen(origen), nombre)) {
        return MENSAJE_MISMO_PUNTO;
      }
      setDestino(nombre);
      return null;
    },
    [origen]
  );

  useEffect(() => {
    return () => {
      solicitudOpciones.current += 1;
      solicitudOrigen.current += 1;
    };
  }, []);

  return {
    opciones,
    cargandoOpciones,
    errorOpciones,
    cargarOpciones,
    origen,
    etiquetaOrigen: etiquetaOrigen(origen),
    destino,
    obteniendoUbicacion,
    usarUbicacionActual,
    seleccionarOrigen,
    seleccionarOrigenParadero,
    seleccionarDestino,
  };
}

export type SeleccionViaje = ReturnType<typeof useSeleccionViaje>;
