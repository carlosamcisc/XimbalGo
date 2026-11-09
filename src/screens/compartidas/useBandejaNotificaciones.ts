import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { escucharNotificaciones, marcarAvisosLeidos, obtenerBandejaNotificaciones } from "../../infrastructure/supabase/repositories/notificaciones.repository";
import { obtenerEstadoAutenticacion } from "../../store/autenticacionStore";
import type { NotificacionCliente } from "../../modules/cliente/types";

export function useBandejaNotificaciones(usuarioId: string | null) {
  const [notificaciones, setNotificaciones] = useState<NotificacionCliente[]>([]);
  const [noLeidas, setNoLeidas] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [refrescando, setRefrescando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const revision = useRef(0);
  const activa = useRef(false);
  const marcando = useRef(false);
  const vigente = useCallback(() => activa.current && Boolean(usuarioId) &&
    obtenerEstadoAutenticacion().usuario?.id === usuarioId, [usuarioId]);
  const cargar = useCallback(async () => {
    if (!usuarioId || !vigente()) return;
    const actual = ++revision.current;
    try {
      const datos = await obtenerBandejaNotificaciones(usuarioId);
      if (vigente() && actual === revision.current) {
        setNotificaciones(datos.notificaciones); setNoLeidas(datos.noLeidas); setError(null);
      }
    } catch {
      if (vigente() && actual === revision.current) setError("No se pudieron cargar tus notificaciones. Comprueba tu conexión.");
    } finally {
      if (vigente() && actual === revision.current) { setCargando(false); setRefrescando(false); }
    }
  }, [usuarioId, vigente]);

  useEffect(() => {
    activa.current = true;
    void cargar();
    let espera: ReturnType<typeof setTimeout> | undefined;
    const detener = usuarioId ? escucharNotificaciones(usuarioId, () => {
      clearTimeout(espera); espera = setTimeout(() => void cargar(), 300);
    }) : undefined;
    const app = AppState.addEventListener("change", estado => { if (estado === "active") void cargar(); });
    return () => { activa.current = false; revision.current++; clearTimeout(espera); detener?.(); app.remove(); };
  }, [usuarioId, cargar]);

  const refrescar = async () => { if (vigente()) { setRefrescando(true); await cargar(); } };
  const marcarLeidas = async (notificacionId?: string): Promise<string | null> => {
    if (!usuarioId || !vigente()) return "No se encontró una sesión activa.";
    if (marcando.current) return "Espera a que termine de marcar los avisos.";
    marcando.current = true;
    revision.current++;
    try {
      await marcarAvisosLeidos(usuarioId, notificacionId);
      if (vigente()) {
        setNotificaciones(avisos => avisos.map(n => !notificacionId || n.id === notificacionId ? { ...n, leida: true } : n));
        if (!notificacionId) setNoLeidas(0);
      }
      return null;
    } catch {
      return "No se confirmó la lectura de los avisos. Puedes reintentarlo.";
    } finally {
      marcando.current = false;
      if (vigente()) void cargar();
    }
  };
  return { notificaciones, noLeidas, cargando, refrescando, error, cargar, refrescar, marcarLeidas };
}

export type BandejaNotificaciones = ReturnType<typeof useBandejaNotificaciones>;
