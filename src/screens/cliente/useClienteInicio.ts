import { useCallback, useEffect, useRef, useState } from "react";
import { obtenerParaderosCercanos } from "../../infrastructure/supabase/repositories/cliente.repository";
import { obtenerTaxisCercanos } from "../../infrastructure/supabase/repositories/vehiculos.repository";
import { obtenerUbicacionActual } from "../../infrastructure/location/location.service";
import type {
  Coordenadas,
  ParaderoCercano,
  TaxiCercano,
} from "../../modules/cliente/ubicacion";
import { mensajeError } from "./mensajeError";
import { useSeleccionViaje } from "./useSeleccionViaje";

// Las demás pantallas lo importan desde aquí.
export { mensajeError };

const LIMITE_CERCANOS = 5;

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
  const [taxisCercanos, setTaxisCercanos] = useState<TaxiCercano[]>([]);
  const [paraderosCercanos, setParaderosCercanos] = useState<ParaderoCercano[]>([]);
  const [cargandoCercanos, setCargandoCercanos] = useState(true);
  const [errorCercanos, setErrorCercanos] = useState<string | null>(null);
  const [refrescando, setRefrescando] = useState(false);

  // Descarta respuestas de solicitudes que ya fueron reemplazadas.
  const solicitudCercanos = useRef(0);

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

  // Elegir «Mi ubicación actual» también busca lo cercano a ese punto.
  const viaje = useSeleccionViaje({
    alObtenerUbicacion: (punto) => void buscarCercanos(punto),
    alFallarUbicacion: (mensaje) => {
      // Sin GPS tampoco hay cercanos: las listas muestran el motivo.
      solicitudCercanos.current += 1;
      setTaxisCercanos([]);
      setParaderosCercanos([]);
      setErrorCercanos(mensaje);
      setCargandoCercanos(false);
    },
  });

  const refrescar = useCallback(async () => {
    setRefrescando(true);
    await buscarCercanos();
    setRefrescando(false);
  }, [buscarCercanos]);

  // Al entrar se pide el permiso de ubicación; si se concede, el GPS queda
  // como origen y se buscan los taxis y paraderos cercanos.
  const { usarUbicacionActual } = viaje;
  useEffect(() => {
    void usarUbicacionActual();

    return () => {
      solicitudCercanos.current += 1;
    };
  }, [usarUbicacionActual]);

  return {
    saludo: obtenerSaludo(),
    ...viaje,
    taxisCercanos,
    paraderosCercanos,
    cargandoCercanos,
    errorCercanos,
    buscarCercanos,
    refrescando,
    refrescar,
  };
}
