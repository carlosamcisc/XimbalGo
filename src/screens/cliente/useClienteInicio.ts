import { useCallback, useEffect, useRef, useState } from "react";
import {
  obtenerParaderosActivos,
  obtenerParaderosCercanos,
  obtenerPerfilCliente,
} from "../../infrastructure/supabase/repositories/cliente.repository";
import { obtenerTaxisCercanos } from "../../infrastructure/supabase/repositories/vehiculos.repository";
import { crearReserva } from "../../infrastructure/supabase/repositories/reservas.repository";
import {
  obtenerDireccionActual,
  obtenerUbicacionActual,
} from "../../infrastructure/location/location.service";
import { useAutenticacionStore } from "../../store/autenticacionStore";
import type {
  Coordenadas,
  ParaderoCercano,
  TaxiCercano,
} from "../../modules/cliente/ubicacion";
import type {
  OrigenViaje,
  ParaderoViaje,
  PerfilCliente,
} from "../../modules/cliente/types";

const LIMITE_CERCANOS = 5;
const MENSAJE_MISMO_PARADERO = "El origen y el destino deben ser distintos.";

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

export function useClienteInicio() {
  const { usuario } = useAutenticacionStore();
  const usuarioId = usuario?.id ?? null;

  const [perfil, setPerfil] = useState<PerfilCliente | null>(null);
  const [paraderos, setParaderos] = useState<ParaderoViaje[]>([]);
  const [cargandoDatos, setCargandoDatos] = useState(true);
  const [errorDatos, setErrorDatos] = useState<string | null>(null);

  const [taxisCercanos, setTaxisCercanos] = useState<TaxiCercano[]>([]);
  const [paraderosCercanos, setParaderosCercanos] = useState<ParaderoCercano[]>([]);
  const [cargandoCercanos, setCargandoCercanos] = useState(true);
  const [errorCercanos, setErrorCercanos] = useState<string | null>(null);

  const [origen, setOrigen] = useState<OrigenViaje | null>(null);
  const [destino, setDestino] = useState<ParaderoViaje | null>(null);
  const [obteniendoUbicacion, setObteniendoUbicacion] = useState(false);
  const [refrescando, setRefrescando] = useState(false);
  const [reservando, setReservando] = useState(false);

  // Cada contador descarta respuestas de solicitudes que ya fueron reemplazadas.
  const solicitudDatos = useRef(0);
  const solicitudCercanos = useRef(0);
  const solicitudOrigen = useRef(0);

  const cargarDatos = useCallback(async () => {
    const solicitud = ++solicitudDatos.current;
    setCargandoDatos(true);
    setErrorDatos(null);

    if (!usuarioId) {
      setErrorDatos("No se encontró una sesión de cliente activa.");
      setCargandoDatos(false);
      return;
    }

    try {
      const [perfilCliente, paraderosActivos] = await Promise.all([
        obtenerPerfilCliente(usuarioId),
        obtenerParaderosActivos(),
      ]);
      if (solicitud !== solicitudDatos.current) {
        return;
      }

      setPerfil(perfilCliente);
      setParaderos(paraderosActivos);

      // Descarta selecciones de paraderos que dejaron de estar activos.
      const sigueActivo = (id: string) =>
        paraderosActivos.some((paradero) => paradero.id === id);
      setOrigen((actual) =>
        actual?.tipo === "paradero" && !sigueActivo(actual.paradero.id)
          ? null
          : actual
      );
      setDestino((actual) => (actual && !sigueActivo(actual.id) ? null : actual));
    } catch (error: unknown) {
      if (solicitud === solicitudDatos.current) {
        setErrorDatos(
          mensajeError(error, "Ocurrió un error desconocido al cargar tus datos.")
        );
      }
    } finally {
      if (solicitud === solicitudDatos.current) {
        setCargandoDatos(false);
      }
    }
  }, [usuarioId]);

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
    await Promise.all([cargarDatos(), buscarCercanos()]);
    setRefrescando(false);
  }, [cargarDatos, buscarCercanos]);

  /** Devuelve un mensaje para el usuario si no se pudo usar el GPS. */
  const usarUbicacionActual = useCallback(async (): Promise<string | null> => {
    const solicitud = ++solicitudOrigen.current;
    setObteniendoUbicacion(true);

    try {
      const punto = await obtenerUbicacionActual();
      if (solicitud !== solicitudOrigen.current) {
        return null;
      }

      setOrigen({ tipo: "ubicacion", coordenadas: punto, direccion: null });
      setObteniendoUbicacion(false);
      void buscarCercanos(punto);

      // La dirección es opcional: si falla, el origen sigue siendo el GPS.
      try {
        const direccion = await obtenerDireccionActual(punto);
        if (direccion && solicitud === solicitudOrigen.current) {
          setOrigen((actual) =>
            actual?.tipo === "ubicacion" ? { ...actual, direccion } : actual
          );
        }
      } catch {}
      return null;
    } catch (error: unknown) {
      if (solicitud !== solicitudOrigen.current) {
        return null;
      }
      setObteniendoUbicacion(false);
      return mensajeError(error, "No se pudo obtener tu ubicación actual.");
    }
  }, [buscarCercanos]);

  /** Devuelve un mensaje para el usuario si la selección tuvo que ajustarse. */
  const seleccionarOrigenParadero = useCallback(
    (paradero: ParaderoViaje): string | null => {
      solicitudOrigen.current += 1;
      setObteniendoUbicacion(false);
      setOrigen({ tipo: "paradero", paradero });

      if (destino?.id === paradero.id) {
        setDestino(null);
        return `${MENSAJE_MISMO_PARADERO} Elige un nuevo destino.`;
      }
      return null;
    },
    [destino]
  );

  /** Devuelve un mensaje de error para el usuario, o null si se reservó. */
  const reservar = useCallback(
    async (taxi: TaxiCercano): Promise<string | null> => {
      if (!destino) {
        return "Selecciona tu destino antes de reservar.";
      }
      if (!origen) {
        return "Selecciona tu origen antes de reservar.";
      }

      setReservando(true);
      try {
        await crearReserva({
          vehiculoId: taxi.id,
          paraderoDestinoId: destino.id,
          paraderoOrigenId: origen.tipo === "paradero" ? origen.paradero.id : null,
          // La reserva solo guarda paraderos; el origen GPS viaja en las notas.
          notas:
            origen.tipo === "ubicacion"
              ? `Origen: ${origen.direccion ?? "ubicación actual"} (${origen.coordenadas.latitud.toFixed(5)}, ${origen.coordenadas.longitud.toFixed(5)})`
              : null,
        });
        void buscarCercanos();
        return null;
      } catch (error: unknown) {
        return mensajeError(error, "No se pudo crear la reservación.");
      } finally {
        setReservando(false);
      }
    },
    [origen, destino, buscarCercanos]
  );

  /** Devuelve un mensaje para el usuario si el destino no es válido. */
  const seleccionarDestino = useCallback(
    (paradero: ParaderoViaje): string | null => {
      if (origen?.tipo === "paradero" && origen.paradero.id === paradero.id) {
        return MENSAJE_MISMO_PARADERO;
      }
      setDestino(paradero);
      return null;
    },
    [origen]
  );

  useEffect(() => {
    void cargarDatos();
    void buscarCercanos();

    return () => {
      solicitudDatos.current += 1;
      solicitudCercanos.current += 1;
      solicitudOrigen.current += 1;
    };
  }, [cargarDatos, buscarCercanos]);

  const nombre = perfil?.nombres.trim().split(/\s+/)[0] || "Cliente";
  const etiquetaOrigen = !origen
    ? ""
    : origen.tipo === "paradero"
      ? origen.paradero.nombre
      : origen.direccion ?? "Mi ubicación actual";

  return {
    nombre,
    inicial: nombre.charAt(0).toUpperCase(),
    saludo: obtenerSaludo(),
    paraderos,
    cargandoDatos,
    errorDatos,
    cargarDatos,
    taxisCercanos,
    paraderosCercanos,
    cargandoCercanos,
    errorCercanos,
    buscarCercanos,
    origen,
    etiquetaOrigen,
    destino,
    obteniendoUbicacion,
    usarUbicacionActual,
    seleccionarOrigenParadero,
    seleccionarDestino,
    refrescando,
    refrescar,
    reservando,
    reservar,
  };
}
