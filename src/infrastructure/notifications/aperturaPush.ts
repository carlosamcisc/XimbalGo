import type { TipoNotificacion } from "../../modules/cliente/types";

export type RolPush = "cliente" | "taxista";
export interface DatosAperturaPush {
  notificacionId: string;
  reservaId: string | null;
  tipo: TipoNotificacion;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TIPOS = new Set<TipoNotificacion>([
  "reserva_solicitada", "reserva_aceptada", "reserva_rechazada",
  "reserva_cancelada", "van_llegando", "viaje_completado",
  "asientos_ofrecidos", "cliente_abordo",
]);

/** El push identifica el aviso; nunca decide una URL ni una acción de reserva. */
export function interpretarDatosPush(data: unknown): DatosAperturaPush | null {
  if (!data || typeof data !== "object") return null;
  const { notificacionId, reservaId, tipo } = data as Record<string, unknown>;
  if (typeof notificacionId !== "string" || !UUID.test(notificacionId) ||
      typeof tipo !== "string" || !TIPOS.has(tipo as TipoNotificacion) ||
      (reservaId !== null && (typeof reservaId !== "string" || !UUID.test(reservaId)))) return null;
  return { notificacionId, reservaId, tipo: tipo as TipoNotificacion };
}

export interface ContextoAperturaPush {
  usuarioId: string | null;
  rol: RolPush | null;
  disponible: boolean;
}

interface Dependencias {
  contexto: () => ContextoAperturaPush;
  navegacionLista: (rol: RolPush) => boolean;
  consultar: (usuarioId: string, notificacionId: string) => Promise<DatosAperturaPush | null>;
  abrir: (rol: RolPush, reservaId: string, notificacionId: string) => void;
  marcarLeida: (usuarioId: string, notificacionId: string) => Promise<void>;
  consumir: (identificador: string) => void;
  avisar: (mensaje: string, reintentar?: () => void) => void;
}

/** Una intención pendiente: el último toque reemplaza los anteriores. */
export function crearControladorAperturaPush(dep: Dependencias) {
  let pendiente: { identificador: string; datos: DatosAperturaPush; usuarioId: string | null } | null = null;
  let revision = 0;
  let procesando = false;
  let esperandoReintento = false;
  let activo = true;
  const recibidos = new Set<string>();

  const terminar = (intencion: NonNullable<typeof pendiente>) => {
    if (pendiente === intencion) pendiente = null;
    dep.consumir(intencion.identificador);
  };

  const procesar = async (): Promise<void> => {
    if (!activo || procesando || esperandoReintento || !pendiente) return;
    const contexto = dep.contexto();
    const intencion = pendiente;
    if (intencion.usuarioId && contexto.usuarioId !== intencion.usuarioId) {
      terminar(intencion);
      return;
    }
    if (!contexto.disponible || !contexto.usuarioId || !contexto.rol ||
        !dep.navegacionLista(contexto.rol)) return;
    intencion.usuarioId = contexto.usuarioId;
    const actual = revision;
    const vigente = () => activo && actual === revision && pendiente === intencion &&
      dep.contexto().disponible && dep.contexto().usuarioId === contexto.usuarioId &&
      dep.contexto().rol === contexto.rol && dep.navegacionLista(contexto.rol!);
    procesando = true;
    try {
      const aviso = await dep.consultar(contexto.usuarioId, intencion.datos.notificacionId);
      if (!vigente()) return;
      if (!aviso || !aviso.reservaId) {
        terminar(intencion);
        dep.avisar("Esta notificación ya no tiene una reserva disponible para tu cuenta.");
        return;
      }
      // El destino se obtiene de la fila propia, no del reservaId del payload.
      dep.abrir(contexto.rol, aviso.reservaId, aviso.notificacionId);
      terminar(intencion);
      try {
        await dep.marcarLeida(contexto.usuarioId, aviso.notificacionId);
      } catch {
        if (activo && dep.contexto().usuarioId === contexto.usuarioId) {
          dep.avisar("Se abrió la reserva, pero no se pudo marcar el aviso como leído.");
        }
      }
    } catch {
      if (!vigente()) return;
      esperandoReintento = true;
      dep.avisar("No se pudo abrir el aviso. Comprueba tu conexión e inténtalo de nuevo.", () => {
        if (!activo || pendiente !== intencion) return;
        esperandoReintento = false;
        void procesar();
      });
    } finally {
      procesando = false;
      // Un toque nuevo pudo llegar mientras se consultaba el anterior.
      if (activo && pendiente) void procesar();
    }
  };

  return {
    iniciar() { activo = true; },
    recibir(identificador: string, data: unknown) {
      if (!activo || recibidos.has(identificador)) return;
      recibidos.add(identificador);
      if (recibidos.size > 100) recibidos.delete(recibidos.values().next().value!);
      const datos = interpretarDatosPush(data);
      if (!datos) {
        dep.consumir(identificador);
        return;
      }
      revision += 1;
      esperandoReintento = false;
      pendiente = { identificador, datos, usuarioId: dep.contexto().usuarioId };
      void procesar();
    },
    actualizar: () => {
      // Invalida también consultas en curso: volver a la misma cuenta después
      // de cerrar sesión no debe revivir el toque anterior.
      if (pendiente?.usuarioId && pendiente.usuarioId !== dep.contexto().usuarioId) {
        revision += 1;
        terminar(pendiente);
        esperandoReintento = false;
      }
      void procesar();
    },
    detener() { activo = false; revision += 1; pendiente = null; recibidos.clear(); esperandoReintento = false; },
  };
}
