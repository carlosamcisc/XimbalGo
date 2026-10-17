export interface Coordenadas {
  latitud: number;
  longitud: number;
}

export interface ParaderoCercano {
  id: string;
  nombre: string;
  referencia: string | null;
  distanciaMetros: number;
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
