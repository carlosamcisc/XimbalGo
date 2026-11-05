import { useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { useIsFocused } from "@react-navigation/native";
import type { LineString } from "geojson";
import { supabase } from "../../infrastructure/supabase/client";
import { distanciaEntre, type SeguimientoReserva } from "../../modules/cliente/seguimiento";
import { conTiempoLimite } from "../../modules/cliente/tiempoLimite";

/** Trazo sugerido por calles; no representa el historial del taxi. */
export function useRutaTaxi(reservaId: string, seguimiento: SeguimientoReserva | null, habilitada: boolean,
  opciones?: { mapaTaxista: boolean; paraderoId?: string }) {
  const mapaTaxista = opciones?.mapaTaxista ?? false;
  const paraderoId = opciones?.paraderoId;
  const [ruta, setRuta] = useState<LineString | null>(null);
  const [estimacion, setEstimacion] = useState<{
    distanciaMetros: number; minutosRestantes: number; llegada: Date; llegando: boolean; calculadaEn: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const [activa, setActiva] = useState(AppState.currentState === "active");
  const enfocada = useIsFocused();
  const ultimo = useRef(seguimiento);
  ultimo.current = seguimiento;
  const destino = seguimiento?.paraderoCercano ?? seguimiento?.punto;
  const tipoDestino = seguimiento?.paraderoCercano ? "paradero" : "abordaje";
  const disponible = habilitada && Boolean(seguimiento?.enServicio && seguimiento.taxi && destino);
  const claveDestino = destino ? `${destino.coordenadas.latitud},${destino.coordenadas.longitud}` : "";

  useEffect(() => {
    const listener = AppState.addEventListener("change", estado => setActiva(estado === "active"));
    return () => listener.remove();
  }, []);

  useEffect(() => {
    setRuta(null);
    setEstimacion(null);
    setError(null);
    setCargando(false);
    if (!disponible || !enfocada || !activa) return;
    let cancelado = false;
    let ocupado = false;
    let origenAnterior: SeguimientoReserva["taxi"] = null;
    let controlador: AbortController | undefined;
    let ultimoCalculo = 0;

    const calcular = async () => {
      const taxi = ultimo.current?.taxi;
      if (cancelado || ocupado || !taxi || (origenAnterior && distanciaEntre(origenAnterior, taxi) < 50 && Date.now() - ultimoCalculo < 60_000)) return;
      const calculadaEn = Date.now();
      ocupado = true;
      controlador = new AbortController();
      setCargando(true);
      try {
        const { data, error: fallo } = await conTiempoLimite(
          supabase.functions.invoke("distancias-paraderos", { body: {
            ...(reservaId ? { reservaId } : {}), destino: tipoDestino,
            ...(mapaTaxista ? { mapaTaxista: true, paraderoId } : {}),
          }, signal: controlador.signal }),
          15_000,
          "No se pudo actualizar el trazo. Reintentaremos automáticamente.",
          () => controlador?.abort(),
        );
        const geometria = data?.geometria;
        if (fallo || data?.error || data?.modo !== "auto" || data?.destino !== tipoDestino ||
          !Number.isFinite(data?.metros) || data.metros < 0 || !Number.isFinite(data?.segundos) || data.segundos < 0 || geometria?.type !== "LineString" ||
          !Array.isArray(geometria.coordinates) || geometria.coordinates.length < 2 ||
          !geometria.coordinates.every((p: unknown) => Array.isArray(p) &&
            typeof p[0] === "number" && Number.isFinite(p[0]) && Math.abs(p[0]) <= 180 &&
            typeof p[1] === "number" && Number.isFinite(p[1]) && Math.abs(p[1]) <= 90)) {
          throw new Error("No se pudo actualizar el trazo. Reintentaremos automáticamente.");
        }
        if (!cancelado) {
          origenAnterior = taxi;
          ultimoCalculo = calculadaEn;
          setRuta(geometria);
          setEstimacion({
            distanciaMetros: data.metros,
            minutosRestantes: Math.ceil(data.segundos / 60),
            llegada: new Date(calculadaEn + data.segundos * 1000),
            llegando: data.metros <= 150,
            calculadaEn: new Date(calculadaEn).toISOString(),
          });
          setError(null);
        }
      } catch {
        if (!cancelado) setError("No se pudo actualizar el trazo. Reintentaremos automáticamente.");
      } finally {
        ocupado = false;
        if (!cancelado) setCargando(false);
      }
    };

    void calcular();
    // Consume la posición más reciente sin consultar por cada evento Realtime.
    const intervalo = setInterval(() => void calcular(), 30_000);
    return () => {
      cancelado = true;
      controlador?.abort();
      clearInterval(intervalo);
    };
  }, [reservaId, disponible, claveDestino, tipoDestino, enfocada, activa, mapaTaxista, paraderoId]);

  return { ruta: disponible ? ruta : null, estimacion: disponible ? estimacion : null, error, cargando };
}
