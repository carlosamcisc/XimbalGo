import { formatearDuracion } from "./rutas";

export interface Coordenadas {
  latitud: number;
  longitud: number;
}

export interface ParaderoCercano {
  id: string;
  nombre: string;
  referencia: string | null;
  /** Por calle caminando; en línea recta si no se pudo calcular la ruta. */
  distanciaMetros: number;
  /** null cuando no se pudo calcular la ruta. */
  segundosCaminando: number | null;
  distanciaMotoMetros: number | null;
  segundosMoto: number | null;
}

export interface TaxiCercano {
  id: string;
  matricula: string;
  nombreTaxista: string;
  asientosDisponibles: number;
  distanciaMetros: number;
}

/** Taxi de la lista completa; sin GPS del cliente no hay distancia. */
export interface TaxiDisponible extends Omit<TaxiCercano, "distanciaMetros"> {
  distanciaMetros: number | null;
  ruta: string | null;
  precio: number | null;
}

/** Datos del taxi elegido, leídos de nuevo al abrir la pantalla de reserva. */
export interface TaxiReserva {
  id: string;
  matricula: string;
  vehiculo: string | null;
  nombreTaxista: string;
  ruta: string | null;
  /** Precio por pasajero. */
  precio: number | null;
  asientosDisponibles: number;
  totalAsientos: number;
  enServicio: boolean;
}

export function formatearDistancia(distanciaMetros: number): string {
  return distanciaMetros < 1000
    ? `${Math.round(distanciaMetros)} m`
    : `${(distanciaMetros / 1000).toFixed(1)} km`;
}

const formatearSegundos = (segundos: number) =>
  formatearDuracion(Math.max(1, Math.round(segundos / 60)));

// Más lejos ya no se camina al paradero: se muestra solo la moto.
const METROS_MAXIMOS_CAMINANDO = 2000;

/**
 * «850 m · 11 min caminando · 3 min en moto», o «17.9 km · 22 min en moto»
 * si el paradero está a más de 2 km. Omite los tiempos que falten.
 */
export function formatearTrayectoParadero(
  paradero: Pick<
    ParaderoCercano,
    "distanciaMetros" | "segundosCaminando" | "distanciaMotoMetros" | "segundosMoto"
  >
): string {
  if (paradero.distanciaMetros > METROS_MAXIMOS_CAMINANDO) {
    return [
      formatearDistancia(paradero.distanciaMotoMetros ?? paradero.distanciaMetros),
      paradero.segundosMoto !== null && `${formatearSegundos(paradero.segundosMoto)} en moto`,
    ].filter(Boolean).join(" · ");
  }
  return [
    formatearDistancia(paradero.distanciaMetros),
    paradero.segundosCaminando !== null && `${formatearSegundos(paradero.segundosCaminando)} caminando`,
    paradero.segundosMoto !== null && `${formatearSegundos(paradero.segundosMoto)} en moto`,
  ].filter(Boolean).join(" · ");
}
