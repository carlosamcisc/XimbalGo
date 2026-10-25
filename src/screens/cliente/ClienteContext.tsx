import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  escucharCliente,
  guardarPerfilCliente,
  marcarNotificacionesLeidas,
  obtenerNotificaciones,
  obtenerPerfilCliente,
  obtenerResumenViajes,
} from "../../infrastructure/supabase/repositories/cliente.repository";
import { useAutenticacionStore } from "../../store/autenticacionStore";
import type {
  DatosPerfilCliente,
  NotificacionCliente,
  PerfilCliente,
  ResumenViajesCliente,
} from "../../modules/cliente/types";
import { mensajeError } from "./useClienteInicio";
import { useCompartirUbicacion } from "./useCompartirUbicacion";

// Una reserva y su notificación cambian casi al mismo tiempo.
const ESPERA_TIEMPO_REAL_MS = 500;
const RESUMEN_VACIO: ResumenViajesCliente = { completados: 0, enCurso: 0, total: 0 };

function useClienteEstado() {
  const { usuario } = useAutenticacionStore();
  const clienteId = usuario?.id ?? null;

  const [perfil, setPerfil] = useState<PerfilCliente | null>(null);
  const [resumen, setResumen] = useState<ResumenViajesCliente>(RESUMEN_VACIO);
  const [notificaciones, setNotificaciones] = useState<NotificacionCliente[]>([]);
  const [cargando, setCargando] = useState(true);
  const [refrescando, setRefrescando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ubicacionCompartida = useCompartirUbicacion(clienteId);

  // Descarta respuestas de solicitudes que ya fueron reemplazadas.
  const solicitud = useRef(0);

  const cargar = useCallback(async () => {
    const actual = ++solicitud.current;
    setError(null);

    if (!clienteId) {
      setError("No se encontró una sesión de cliente activa.");
      setCargando(false);
      return;
    }

    try {
      const [perfilCliente, resumenViajes, notificacionesCliente] = await Promise.all([
        obtenerPerfilCliente(clienteId),
        obtenerResumenViajes(clienteId),
        obtenerNotificaciones(clienteId),
      ]);
      if (actual === solicitud.current) {
        setPerfil(perfilCliente);
        setResumen(resumenViajes);
        setNotificaciones(notificacionesCliente);
      }
    } catch (e: unknown) {
      if (actual === solicitud.current) {
        setError(mensajeError(e, "No se pudo cargar tu información."));
      }
    } finally {
      if (actual === solicitud.current) {
        setCargando(false);
      }
    }
  }, [clienteId]);

  const refrescar = useCallback(async () => {
    setRefrescando(true);
    await cargar();
    setRefrescando(false);
  }, [cargar]);

  /** Devuelve un mensaje de error para el usuario, o null si se guardó. */
  const guardarPerfil = useCallback(
    async (datos: DatosPerfilCliente): Promise<string | null> => {
      if (!clienteId) {
        return "No se encontró una sesión de cliente activa.";
      }
      try {
        await guardarPerfilCliente(clienteId, datos);
        await cargar();
        return null;
      } catch (e: unknown) {
        return mensajeError(e, "No se pudo guardar tu perfil.");
      }
    },
    [clienteId, cargar]
  );

  /** Sin `notificacionId` marca todas. Devuelve un mensaje de error, o null. */
  const marcarLeidas = useCallback(
    async (notificacionId?: string): Promise<string | null> => {
      if (!clienteId) {
        return "No se encontró una sesión de cliente activa.";
      }
      // Se refleja de inmediato; si falla, se recarga el estado real.
      setNotificaciones((actuales) =>
        actuales.map((notificacion) =>
          !notificacionId || notificacion.id === notificacionId
            ? { ...notificacion, leida: true }
            : notificacion
        )
      );
      try {
        await marcarNotificacionesLeidas(clienteId, notificacionId);
        return null;
      } catch (e: unknown) {
        void cargar();
        return mensajeError(e, "No se pudieron marcar las notificaciones.");
      }
    },
    [clienteId, cargar]
  );

  useEffect(() => {
    void cargar();
  }, [cargar]);

  // El taxista responde una reserva: llega la notificación y cambia el resumen.
  useEffect(() => {
    if (!clienteId) {
      return;
    }
    let espera: ReturnType<typeof setTimeout> | undefined;
    const dejarDeEscuchar = escucharCliente(clienteId, () => {
      clearTimeout(espera);
      espera = setTimeout(() => void cargar(), ESPERA_TIEMPO_REAL_MS);
    });
    return () => {
      clearTimeout(espera);
      dejarDeEscuchar();
    };
  }, [clienteId, cargar]);

  const primerNombre = perfil?.nombres.trim().split(/\s+/)[0] || "Cliente";

  return {
    perfil,
    primerNombre,
    nombreCompleto: perfil ? `${perfil.nombres} ${perfil.apellidos}`.trim() : "Cliente",
    inicial: primerNombre.charAt(0).toUpperCase(),
    resumen,
    notificaciones,
    noLeidas: notificaciones.filter((notificacion) => !notificacion.leida).length,
    cargando,
    refrescando,
    error,
    cargar,
    refrescar,
    guardarPerfil,
    marcarLeidas,
    ubicacionCompartida,
  };
}

type ClienteContexto = ReturnType<typeof useClienteEstado>;

const Contexto = createContext<ClienteContexto | null>(null);

export function ClienteProvider({ children }: { children: ReactNode }) {
  const estado = useClienteEstado();
  return <Contexto.Provider value={estado}>{children}</Contexto.Provider>;
}

export function useCliente(): ClienteContexto {
  const contexto = useContext(Contexto);
  if (!contexto) {
    throw new Error("useCliente debe usarse dentro de ClienteProvider.");
  }
  return contexto;
}
