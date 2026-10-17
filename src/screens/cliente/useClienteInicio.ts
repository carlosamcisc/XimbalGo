import { useCallback, useEffect, useRef, useState } from "react";
import {
  guardarUbicacionCliente,
  obtenerParaderosCercanos,
} from "../../infrastructure/supabase/repositories/cliente.repository";
import { obtenerPuntosRutas } from "../../infrastructure/supabase/repositories/rutas.repository";
import { obtenerTaxisCercanos } from "../../infrastructure/supabase/repositories/vehiculos.repository";
import {
  obtenerDireccionActual,
  obtenerUbicacionActual,
} from "../../infrastructure/location/location.service";
import { normalizarTexto } from "../../modules/cliente/rutas";
import { etiquetaOrigen } from "../../modules/cliente/reservas";
import type {
  Coordenadas,
  ParaderoCercano,
  TaxiCercano,
} from "../../modules/cliente/ubicacion";
import type {
  OrigenViaje,
  ParaderoViaje,
  TipoPuntoViaje,
} from "../../modules/cliente/types";

const LIMITE_CERCANOS = 5;
const MENSAJE_MISMO_PUNTO = "El origen y el destino deben ser distintos.";

export function mensajeError(error: unknown, respaldo: string): string {
  if (error instanceof Error) {
    return error.message;
  }
  // Los errores de Supabase pueden llegar como objetos planos con `message`.
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }
  return respaldo;
}

export function obtenerSaludo(hora = new Date().getHours()): string {
  if (hora >= 5 && hora < 12) {
    return "Buenos días";
  }
  if (hora >= 12 && hora < 19) {
    return "Buenas tardes";
  }
  return "Buenas noches";
}

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

export function useClienteInicio() {
  const [opciones, setOpciones] = useState<Record<TipoPuntoViaje, string[]>>({
    origen: [],
    destino: [],
  });
  const [cargandoOpciones, setCargandoOpciones] = useState(false);
  const [errorOpciones, setErrorOpciones] = useState<string | null>(null);

  const [taxisCercanos, setTaxisCercanos] = useState<TaxiCercano[]>([]);
  const [paraderosCercanos, setParaderosCercanos] = useState<ParaderoCercano[]>([]);
  const [cargandoCercanos, setCargandoCercanos] = useState(true);
  const [errorCercanos, setErrorCercanos] = useState<string | null>(null);

  const [origen, setOrigen] = useState<OrigenViaje | null>(null);
  const [destino, setDestino] = useState<string | null>(null);
  const [obteniendoUbicacion, setObteniendoUbicacion] = useState(false);
  const [refrescando, setRefrescando] = useState(false);

  // Cada contador descarta respuestas de solicitudes que ya fueron reemplazadas.
  const solicitudOpciones = useRef(0);
  const solicitudCercanos = useRef(0);
  const solicitudOrigen = useRef(0);

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

  // Sin coordenadas, vuelve a leer el GPS para reflejar la posición actual.
  const buscarCercanos = useCallback(async (coordenadas?: Coordenadas) => {
    const solicitud = ++solicitudCercanos.current;
    setCargandoCercanos(true);
    setErrorCercanos(null);

    try {
      const punto = coordenadas ?? (await obtenerUbicacionActual());
      if (solicitud !== solicitudCercanos.current) {
        return;
      }

      const [taxis, paraderosProximos] = await Promise.all([
        obtenerTaxisCercanos(punto, LIMITE_CERCANOS),
        obtenerParaderosCercanos(punto, LIMITE_CERCANOS),
      ]);
      if (solicitud !== solicitudCercanos.current) {
        return;
      }

      setTaxisCercanos(taxis);
      setParaderosCercanos(paraderosProximos);
    } catch (error: unknown) {
      if (solicitud !== solicitudCercanos.current) {
        return;
      }
      setTaxisCercanos([]);
      setParaderosCercanos([]);
      setErrorCercanos(
        mensajeError(error, "No se pudieron buscar taxis y paraderos cercanos.")
      );
    } finally {
      if (solicitud === solicitudCercanos.current) {
        setCargandoCercanos(false);
      }
    }
  }, []);

  const refrescar = useCallback(async () => {
    setRefrescando(true);
    await buscarCercanos();
    setRefrescando(false);
  }, [buscarCercanos]);

  /**
   * Usa el GPS como origen y busca lo cercano a ese punto. Devuelve un
   * mensaje para el usuario si no se pudo usar o guardar el GPS.
   */
  const usarUbicacionActual = useCallback(async (): Promise<string | null> => {
    const solicitud = ++solicitudOrigen.current;
    setObteniendoUbicacion(true);

    let punto: Coordenadas;
    try {
      punto = await obtenerUbicacionActual();
    } catch (error: unknown) {
      const mensaje = mensajeError(error, "No se pudo obtener tu ubicación actual.");
      // Sin GPS tampoco hay cercanos: las listas muestran el motivo.
      solicitudCercanos.current += 1;
      setTaxisCercanos([]);
      setParaderosCercanos([]);
      setErrorCercanos(mensaje);
      setCargandoCercanos(false);
      if (solicitud === solicitudOrigen.current) {
        setObteniendoUbicacion(false);
        return mensaje;
      }
      return null;
    }

    void buscarCercanos(punto);
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
  }, [buscarCercanos]);

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

  // Al entrar se pide el permiso de ubicación; si se concede, el GPS queda
  // como origen y se buscan los taxis y paraderos cercanos.
  useEffect(() => {
    void usarUbicacionActual();

    return () => {
      solicitudOpciones.current += 1;
      solicitudCercanos.current += 1;
      solicitudOrigen.current += 1;
    };
  }, [usarUbicacionActual]);

  return {
    saludo: obtenerSaludo(),
    opciones,
    cargandoOpciones,
    errorOpciones,
    cargarOpciones,
    taxisCercanos,
    paraderosCercanos,
    cargandoCercanos,
    errorCercanos,
    buscarCercanos,
    origen,
    etiquetaOrigen: etiquetaOrigen(origen),
    destino,
    obteniendoUbicacion,
    usarUbicacionActual,
    seleccionarOrigen,
    seleccionarOrigenParadero,
    seleccionarDestino,
    refrescando,
    refrescar,
  };
}
