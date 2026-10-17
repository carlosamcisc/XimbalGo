import type { Coordenadas } from "./ubicacion";

/** De dónde sale el punto de abordaje (ver `obtener_seguimiento_reserva`). */
export type TipoPuntoAbordaje = "ubicacion" | "paradero" | "cliente";

export interface PuntoMapa {
  nombre: string;
  coordenadas: Coordenadas;
}

export interface SeguimientoReserva {
  taxistaId: string;
  /** En servicio y con una ubicación de los últimos 15 minutos. */
  enServicio: boolean;
  /** Solo llega mientras la reserva está en curso. */
  taxi: Coordenadas | null;
  ubicacionActualizadaEn: string | null;
  tipoPunto: TipoPuntoAbordaje | null;
  /** Punto donde el taxi recoge al cliente. */
  punto: PuntoMapa | null;
  /** Paradero activo más cercano al punto de abordaje. */
  paraderoCercano: PuntoMapa | null;
  velocidadKmh: number;
}

export interface EstimacionLlegada {
  distanciaMetros: number;
  minutosRestantes: number;
  llegada: Date;
  /** El taxi ya está prácticamente en el punto. */
  llegando: boolean;
}

const RADIO_TIERRA_METROS = 6_371_000;
// La distancia es en línea recta; por calle suele ser un 30 % mayor.
const FACTOR_CALLES = 1.3;
const METROS_LLEGANDO = 150;

const aRadianes = (grados: number) => (grados * Math.PI) / 180;

/** Distancia en línea recta (fórmula del haversine). */
export function distanciaEntre(a: Coordenadas, b: Coordenadas): number {
  const dLat = aRadianes(b.latitud - a.latitud);
  const dLon = aRadianes(b.longitud - a.longitud);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(aRadianes(a.latitud)) * Math.cos(aRadianes(b.latitud)) * Math.sin(dLon / 2) ** 2;
  return 2 * RADIO_TIERRA_METROS * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Cuándo pasará el taxi por el punto de abordaje, según su última ubicación
 * y la velocidad promedio de la ruta. El tiempo cuenta desde que el taxi
 * envió esa ubicación, así los minutos bajan aunque no llegue otra.
 */
export function estimarLlegada(
  seguimiento: SeguimientoReserva,
  ahora = Date.now()
): EstimacionLlegada | null {
  const { taxi, punto, enServicio, ubicacionActualizadaEn, velocidadKmh } = seguimiento;
  if (!enServicio || !taxi || !punto || !ubicacionActualizadaEn || velocidadKmh <= 0) {
    return null;
  }

  const distanciaMetros = distanciaEntre(taxi, punto.coordenadas);
  const llegando = distanciaMetros <= METROS_LLEGANDO;
  const minutosViaje = llegando
    ? 0
    : ((distanciaMetros * FACTOR_CALLES) / 1000 / velocidadKmh) * 60;
  const llegada = new Date(new Date(ubicacionActualizadaEn).getTime() + minutosViaje * 60_000);

  return {
    distanciaMetros,
    minutosRestantes: Math.max(0, Math.ceil((llegada.getTime() - ahora) / 60_000)),
    llegada: llegada.getTime() < ahora ? new Date(ahora) : llegada,
    llegando,
  };
}

export function formatearMinutos(minutos: number): string {
  if (minutos < 1) {
    return "menos de 1 min";
  }
  if (minutos < 60) {
    return `${minutos} min`;
  }
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  return resto === 0 ? `${horas} h` : `${horas} h ${resto} min`;
}

/** «hace 2 min» para la última ubicación del taxi. */
export function formatearAntiguedad(fechaIso: string, ahora = Date.now()): string {
  const minutos = Math.floor((ahora - new Date(fechaIso).getTime()) / 60_000);
  if (minutos < 1) {
    return "hace un momento";
  }
  return `hace ${formatearMinutos(minutos)}`;
}
