import { useCallback, useEffect, useRef, useState } from "react";
import {
  obtenerParadero,
  obtenerParaderos,
} from "../../infrastructure/supabase/repositories/cliente.repository";
import { obtenerDireccionActual } from "../../infrastructure/location/location.service";
import { normalizarTexto } from "../../modules/cliente/rutas";
import type { DetalleParadero, ParaderoResumen } from "../../modules/cliente/types";
import { mensajeError } from "./useClienteInicio";

/** Todos los paraderos activos, con búsqueda por nombre o referencia. */
export function useClienteParaderos() {
  const [paraderos, setParaderos] = useState<ParaderoResumen[]>([]);
  const [cargando, setCargando] = useState(true);
  const [refrescando, setRefrescando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const solicitud = useRef(0);

  const cargar = useCallback(async () => {
    const actual = ++solicitud.current;
    setCargando(true);
    setError(null);

    try {
      const datos = await obtenerParaderos();
      if (actual === solicitud.current) {
        setParaderos(datos);
      }
    } catch (causa: unknown) {
      if (actual === solicitud.current) {
        setError(mensajeError(causa, "No se pudieron cargar los paraderos."));
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
    return () => {
      solicitud.current += 1;
    };
  }, [cargar]);

  const termino = normalizarTexto(busqueda);
  const filtrados = termino
    ? paraderos.filter((paradero) =>
        [paradero.nombre, paradero.referencia ?? ""].some((texto) =>
          normalizarTexto(texto).includes(termino)
        )
      )
    : paraderos;

  return {
    paraderos: filtrados,
    total: paraderos.length,
    cargando,
    refrescando,
    error,
    busqueda,
    setBusqueda,
    cargar,
    refrescar,
  };
}

/** Información de un paradero y la dirección de su ubicación. */
export function useClienteParadero(paraderoId: string) {
  const [paradero, setParadero] = useState<DetalleParadero | null>(null);
  const [direccion, setDireccion] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [refrescando, setRefrescando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const solicitud = useRef(0);

  const cargar = useCallback(async () => {
    const actual = ++solicitud.current;
    setCargando(true);
    setError(null);

    let datos: DetalleParadero;
    try {
      datos = await obtenerParadero(paraderoId);
    } catch (causa: unknown) {
      if (actual === solicitud.current) {
        setParadero(null);
        setError(mensajeError(causa, "No se pudo cargar el paradero."));
        setCargando(false);
      }
      return;
    }
    if (actual !== solicitud.current) {
      return;
    }

    setParadero(datos);
    setCargando(false);

    // La dirección es opcional: sin ella se muestran las coordenadas.
    if (!datos.coordenadas) {
      setDireccion(null);
      return;
    }
    try {
      const texto = await obtenerDireccionActual(datos.coordenadas);
      if (actual === solicitud.current) {
        setDireccion(texto);
      }
    } catch {
      if (actual === solicitud.current) {
        setDireccion(null);
      }
    }
  }, [paraderoId]);

  const refrescar = useCallback(async () => {
    setRefrescando(true);
    await cargar();
    setRefrescando(false);
  }, [cargar]);

  useEffect(() => {
    void cargar();
    return () => {
      solicitud.current += 1;
    };
  }, [cargar]);

  return { paradero, direccion, cargando, refrescando, error, cargar, refrescar };
}
