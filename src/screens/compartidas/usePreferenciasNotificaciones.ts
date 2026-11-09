import { useCallback, useRef, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { AppState, Linking } from "react-native";
import { obtenerEstadoAutenticacion, useAutenticacionStore } from "../../store/autenticacionStore";
import { obtenerPreferenciasNotificaciones, guardarPreferenciaNotificaciones } from "../../infrastructure/supabase/repositories/preferenciasNotificaciones.repository";
import { obtenerPermisoPush, type EstadoPermisoPush } from "../../infrastructure/notifications/permisoPush";
import { sincronizarDispositivoPush } from "../../infrastructure/notifications/registroPush.service";
import { ToastMessage } from "../../components/ToastMessaje";
import type { CampoPreferencia, PreferenciasNotificaciones } from "../../modules/notificaciones/types";

export function usePreferenciasNotificaciones() {
  const { usuario, rol } = useAutenticacionStore();
  const usuarioId = usuario?.id;
  const [preferencias, setPreferencias] = useState<PreferenciasNotificaciones | null>(null);
  const [permiso, setPermiso] = useState<EstadoPermisoPush | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorPermiso, setErrorPermiso] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [ocupado, setOcupado] = useState(false);
  const revision = useRef(0);
  const operando = useRef(false);
  const enfocada = useRef(false);
  const vigente = useCallback(() => enfocada.current && Boolean(usuarioId) &&
    obtenerEstadoAutenticacion().usuario?.id === usuarioId && !obtenerEstadoAutenticacion().recuperandoContrasena, [usuarioId]);

  const cargar = useCallback(async () => {
    if (!usuarioId || !vigente() || operando.current) return;
    const actual = ++revision.current;
    const [datos, permisos] = await Promise.allSettled([
      obtenerPreferenciasNotificaciones(usuarioId), obtenerPermisoPush(),
    ]);
    if (!vigente() || actual !== revision.current) return;
    if (datos.status === "fulfilled") { setPreferencias(datos.value); setError(null); }
    else { setPreferencias(null); setError("No se pudieron cargar tus preferencias. Comprueba tu conexión."); }
    if (permisos.status === "fulfilled") { setPermiso(permisos.value); setErrorPermiso(null); }
    else { setPermiso(null); setErrorPermiso("No se pudo consultar el permiso del teléfono."); }
    setCargando(false);
  }, [usuarioId, vigente]);

  useFocusEffect(useCallback(() => {
    enfocada.current = true;
    setOcupado(operando.current);
    void cargar();
    const cambio = AppState.addEventListener("change", estado => { if (estado === "active") void cargar(); });
    return () => { enfocada.current = false; revision.current++; cambio.remove(); };
  }, [cargar]));

  const cambiar = async (campo: CampoPreferencia, valor: boolean) => {
    if (!usuarioId || !vigente() || !preferencias || operando.current) return;
    operando.current = true; revision.current++; setOcupado(true);
    let fallo = false;
    try {
      const datos = await guardarPreferenciaNotificaciones(usuarioId, campo, valor);
      if (vigente()) setPreferencias(datos);
    } catch {
      fallo = true;
      if (vigente()) ToastMessage.show("No se confirmó el cambio. Volveremos a consultar tus preferencias.", "long");
    } finally {
      operando.current = false;
      if (vigente()) {
        setOcupado(false);
        if (fallo) await cargar();
      }
    }
  };

  const activar = async () => {
    if (!usuarioId || !vigente() || operando.current) return;
    operando.current = true; revision.current++; setOcupado(true);
    try {
      // El usuario pulsó Activar; permite volver a pedirlo tras «Ahora no».
      await sincronizarDispositivoPush(usuarioId, true, undefined, true);
    } catch {
      if (vigente()) ToastMessage.show("No se pudieron activar los avisos en este teléfono. Puedes reintentarlo.", "long");
    } finally {
      operando.current = false;
      if (vigente()) { setOcupado(false); await cargar(); }
    }
  };

  const abrirAjustes = async () => {
    try { await Linking.openSettings(); }
    catch { if (vigente()) ToastMessage.show("No se pudieron abrir los ajustes del teléfono.", "long"); }
  };
  return { rol, preferencias, permiso, error, errorPermiso, cargando, ocupado, cargar, cambiar, activar, abrirAjustes };
}
