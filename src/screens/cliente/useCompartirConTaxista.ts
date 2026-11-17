import { useEffect, useRef, useState } from "react";
import { supabase } from "../../infrastructure/supabase/client";
import type { Coordenadas } from "../../modules/cliente/ubicacion";

export function useCompartirConTaxista(reservaId: string, permitida: boolean, coordenadas: Coordenadas | null) {
  const [reservaCompartida, setReservaCompartida] = useState<string | null>(null);
  const activada = reservaCompartida === reservaId;
  const [error, setError] = useState<string | null>(null);
  const [enviada, setEnviada] = useState(false);
  const ultima = useRef(coordenadas);
  ultima.current = coordenadas;
  const operaciones = useRef<Promise<unknown>>(Promise.resolve());
  const disponible = coordenadas !== null;

  useEffect(() => { if (!permitida) setReservaCompartida(null); }, [permitida]);
  useEffect(() => {
    setEnviada(false);
    setError(null);
    if (!activada || !permitida || !disponible) return;
    let cancelada = false;
    let pendiente = false;
    const enviar = () => {
      if (pendiente) return;
      pendiente = true;
      operaciones.current = operaciones.current.catch(() => undefined).then(async () => {
        const posicion = ultima.current;
        if (cancelada || !posicion) return;
        const { error: fallo } = await supabase.rpc("compartir_ubicacion_reserva", {
          p_reserva_id: reservaId, p_latitud: posicion.latitud, p_longitud: posicion.longitud,
        });
        if (!cancelada) {
          setError(fallo ? "No se pudo enviar tu ubicación al taxista. Reintentaremos automáticamente." : null);
          setEnviada(!fallo);
        }
      }).catch(() => {
        if (!cancelada) { setError("No se pudo enviar tu ubicación al taxista."); setEnviada(false); }
      }).finally(() => { pendiente = false; });
    };
    enviar();
    const intervalo = setInterval(enviar, 10_000);
    return () => {
      cancelada = true;
      clearInterval(intervalo);
      // La baja se ejecuta después de un envío pendiente, nunca antes.
      operaciones.current = operaciones.current.catch(() => undefined).then(async () => {
        await supabase.rpc("compartir_ubicacion_reserva", { p_reserva_id: reservaId, p_compartir: false });
      }).catch(() => undefined);
    };
  }, [reservaId, activada, permitida, disponible]);

  return { activada, enviada, error, alternar: () => setReservaCompartida(valor => valor === reservaId ? null : reservaId) };
}
