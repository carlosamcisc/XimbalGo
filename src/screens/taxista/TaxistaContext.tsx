import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AppState } from "react-native";
import {
  actualizarReserva,
  actualizarUbicacion,
  actualizarVehiculo,
  cambiarServicio,
  escucharTaxista,
  guardarPerfilTaxista,
  obtenerPerfilTaxista,
  obtenerReservasTaxista,
  obtenerVehiculoTaxista,
  registrarVehiculo,
} from "../../infrastructure/supabase/repositories/taxista.repository";
import {
  obtenerUbicacionActual,
  observarUbicacion,
} from "../../infrastructure/location/location.service";
import { useAutenticacionStore } from "../../store/autenticacionStore";
import { esReservaActiva } from "../../modules/cliente/reservas";
import type { Coordenadas } from "../../modules/cliente/ubicacion";
import {
  ubicacionVigente,
  type AccionReserva,
  type DatosPerfilTaxista,
  type DatosVehiculo,
  type PerfilTaxista,
  type ReservaTaxista,
  type VehiculoTaxista,
} from "../../modules/taxista/types";
import { mensajeError } from "../cliente/useClienteInicio";

const MENSAJE_PERMISO =
  "Se necesita permiso de ubicación para que los clientes te encuentren mientras estás en servicio.";
// Una reserva cambia la reserva y el asiento casi al mismo tiempo.
const ESPERA_TIEMPO_REAL_MS = 500;
// `watchPositionAsync` solo avisa si el taxista se mueve: este reenvío evita
// que la ubicación se venza mientras espera en un paradero.
const REENVIO_UBICACION_MS = 5 * 60_000;

function useTaxistaEstado() {
  const { usuario } = useAutenticacionStore();
  const taxistaId = usuario?.id ?? null;

  const [perfil, setPerfil] = useState<PerfilTaxista | null>(null);
  const [vehiculo, setVehiculo] = useState<VehiculoTaxista | null>(null);
  const [reservas, setReservas] = useState<ReservaTaxista[]>([]);
  const [cargando, setCargando] = useState(true);
  const [refrescando, setRefrescando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cambiandoServicio, setCambiandoServicio] = useState(false);
  const [errorUbicacion, setErrorUbicacion] = useState<string | null>(null);
  const [procesandoReservaId, setProcesandoReservaId] = useState<string | null>(null);
  // Para mostrar «Procesando...» solo en el botón que se tocó.
  const [procesandoAccion, setProcesandoAccion] = useState<AccionReserva | null>(null);

  // Descarta respuestas de solicitudes que ya fueron reemplazadas.
  const solicitud = useRef(0);
  const ultimaUbicacion = useRef<Coordenadas | null>(null);
  const procesandoReserva = useRef<string | null>(null);

  const cargar = useCallback(async () => {
    const actual = ++solicitud.current;
    setError(null);

    if (!taxistaId) {
      setError("No se encontró una sesión de taxista activa.");
      setCargando(false);
      return;
    }

    try {
      const [perfilTaxista, vehiculoTaxista, reservasTaxista] = await Promise.all([
        obtenerPerfilTaxista(taxistaId),
        obtenerVehiculoTaxista(taxistaId),
        obtenerReservasTaxista(),
      ]);
      if (actual === solicitud.current) {
        setPerfil(perfilTaxista);
        setVehiculo(vehiculoTaxista);
        setReservas(reservasTaxista);
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
  }, [taxistaId]);

  const refrescar = useCallback(async () => {
    setRefrescando(true);
    await cargar();
    setRefrescando(false);
  }, [cargar]);

  /** Devuelve un mensaje de error para el usuario, o null si funcionó. */
  const cambiarEstadoServicio = useCallback(
    async (enServicio: boolean): Promise<string | null> => {
      setCambiandoServicio(true);
      try {
        const ubicacion = enServicio ? await obtenerUbicacionActual(MENSAJE_PERMISO) : null;
        await cambiarServicio(enServicio, ubicacion);
        ultimaUbicacion.current = ubicacion;
        setErrorUbicacion(null);
        await cargar();
        return null;
      } catch (e: unknown) {
        return mensajeError(e, "No se pudo cambiar tu estado de servicio.");
      } finally {
        setCambiandoServicio(false);
      }
    },
    [cargar]
  );

  /** Devuelve un mensaje de error para el usuario, o null si funcionó. */
  const responderReserva = useCallback(
    async (reservaId: string, accion: AccionReserva): Promise<string | null> => {
      // Un segundo toque antes de re-renderizar enviaría la acción dos veces.
      if (procesandoReserva.current) {
        return "Espera a que termine de procesarse la reservación.";
      }
      procesandoReserva.current = reservaId;
      setProcesandoReservaId(reservaId);
      setProcesandoAccion(accion);
      try {
        await actualizarReserva(reservaId, accion);
      } catch (e: unknown) {
        return mensajeError(e, "No se pudo actualizar la reservación.");
      } finally {
        procesandoReserva.current = null;
        setProcesandoReservaId(null);
        setProcesandoAccion(null);
      }

      // El cambio ya se guardó: se muestra de inmediato, sin esperar la
      // recarga. Antes la tarjeta seguía pendiente, con «Aceptar», hasta que
      // terminaba la recarga, y en una red lenta eso tardaba varios segundos.
      // `cargar` también descarta las recargas en curso, que traerían el
      // estado anterior.
      setReservas((actuales) =>
        actuales.map((reserva) =>
          reserva.id === reservaId ? { ...reserva, estado: accion } : reserva
        )
      );
      void cargar();
      return null;
    },
    [cargar]
  );

  /** Devuelve un mensaje de error para el usuario, o null si se guardó. */
  const guardarPerfil = useCallback(
    async (datos: DatosPerfilTaxista): Promise<string | null> => {
      if (!taxistaId) {
        return "No se encontró una sesión de taxista activa.";
      }
      try {
        await guardarPerfilTaxista(taxistaId, datos);
        await cargar();
        return null;
      } catch (e: unknown) {
        return mensajeError(e, "No se pudo guardar tu perfil.");
      }
    },
    [taxistaId, cargar]
  );

  /** Devuelve un mensaje de error para el usuario, o null si se guardó. */
  const guardarVehiculo = useCallback(
    async (datos: DatosVehiculo): Promise<string | null> => {
      if (!taxistaId) {
        return "No se encontró una sesión de taxista activa.";
      }
      try {
        if (vehiculo) {
          await actualizarVehiculo(vehiculo.id, datos);
        } else {
          await registrarVehiculo(taxistaId, datos);
        }
        // Sin vehículo activo no puede seguir en servicio.
        if (!datos.activo && perfil?.enServicio) {
          await cambiarServicio(false, null);
        }
        await cargar();
        return null;
      } catch (e: unknown) {
        return mensajeError(e, "No se pudo guardar el vehículo.");
      }
    },
    [taxistaId, vehiculo, perfil?.enServicio, cargar]
  );

  useEffect(() => {
    void cargar();
  }, [cargar]);

  // Un cliente reserva o cancela, o cambia un asiento: recarga.
  const vehiculoId = vehiculo?.id ?? null;
  useEffect(() => {
    if (!taxistaId) {
      return;
    }
    let espera: ReturnType<typeof setTimeout> | undefined;
    const dejarDeEscuchar = escucharTaxista(taxistaId, vehiculoId, () => {
      clearTimeout(espera);
      espera = setTimeout(() => void cargar(), ESPERA_TIEMPO_REAL_MS);
    });
    return () => {
      clearTimeout(espera);
      dejarDeEscuchar();
    };
  }, [taxistaId, vehiculoId, cargar]);

  // Mientras está en servicio, envía la ubicación con la app abierta.
  const enServicio = perfil?.enServicio ?? false;
  useEffect(() => {
    if (!enServicio) {
      return;
    }

    let activo = true;
    let dejarDeObservar: (() => void) | undefined;
    const enviar = (coordenadas: Coordenadas) => {
      ultimaUbicacion.current = coordenadas;
      actualizarUbicacion(coordenadas).then(
        () => {
          setErrorUbicacion(null);
          const ahora = new Date().toISOString();
          setPerfil((actual) => actual && { ...actual, ubicacionActualizadaEn: ahora });
        },
        (e: unknown) => setErrorUbicacion(mensajeError(e, "No se pudo enviar tu ubicación."))
      );
    };

    observarUbicacion(enviar, MENSAJE_PERMISO).then(
      (detener) => {
        if (activo) {
          dejarDeObservar = detener;
        } else {
          detener();
        }
      },
      (e: unknown) => {
        if (activo) {
          setErrorUbicacion(mensajeError(e, "No se pudo obtener tu ubicación."));
        }
      }
    );

    const reenvio = setInterval(() => {
      if (ultimaUbicacion.current) {
        enviar(ultimaUbicacion.current);
      }
    }, REENVIO_UBICACION_MS);

    // Al volver a la app, la ubicación pudo vencerse: se envía de inmediato.
    // Solo al volver de segundo plano y sin pedir permiso: en Android los
    // diálogos de permiso también disparan "active", y pedir el permiso aquí
    // abría otro diálogo, que al cerrarse volvía a disparar "active": la
    // pantalla quedaba atrapada en ese ciclo y parecía congelada.
    let estadoAnterior = AppState.currentState;
    let obteniendo = false;
    const cambioApp = AppState.addEventListener("change", (estado) => {
      const volvio = estadoAnterior === "background" && estado === "active";
      estadoAnterior = estado;
      if (!volvio || obteniendo) {
        return;
      }
      void cargar();
      obteniendo = true;
      obtenerUbicacionActual(MENSAJE_PERMISO, false)
        .then(enviar, (e: unknown) => {
          if (activo) {
            setErrorUbicacion(mensajeError(e, "No se pudo obtener tu ubicación."));
          }
        })
        .finally(() => {
          obteniendo = false;
        });
    });

    return () => {
      activo = false;
      dejarDeObservar?.();
      clearInterval(reenvio);
      cambioApp.remove();
    };
  }, [enServicio, cargar]);

  return {
    perfil,
    vehiculo,
    reservas,
    pendientes: reservas.filter((reserva) => reserva.estado === "pendiente"),
    activas: reservas.filter((reserva) => esReservaActiva(reserva.estado)),
    historial: reservas.filter((reserva) => !esReservaActiva(reserva.estado)),
    cargando,
    refrescando,
    error,
    cargar,
    refrescar,
    enServicio,
    /** En servicio y con una ubicación reciente: los clientes lo ven. */
    visibleParaClientes: enServicio && ubicacionVigente(perfil?.ubicacionActualizadaEn ?? null),
    cambiandoServicio,
    errorUbicacion,
    cambiarEstadoServicio,
    procesandoReservaId,
    procesandoAccion,
    responderReserva,
    guardarPerfil,
    guardarVehiculo,
  };
}

type TaxistaContexto = ReturnType<typeof useTaxistaEstado>;

const Contexto = createContext<TaxistaContexto | null>(null);

export function TaxistaProvider({ children }: { children: ReactNode }) {
  const estado = useTaxistaEstado();
  return <Contexto.Provider value={estado}>{children}</Contexto.Provider>;
}

export function useTaxista(): TaxistaContexto {
  const contexto = useContext(Contexto);
  if (!contexto) {
    throw new Error("useTaxista debe usarse dentro de TaxistaProvider.");
  }
  return contexto;
}
