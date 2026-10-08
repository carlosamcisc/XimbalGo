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

export function formatearDistancia(distanciaMetros: number): string {
  return distanciaMetros < 1000
    ? `${Math.round(distanciaMetros)} m`
    : `${(distanciaMetros / 1000).toFixed(1)} km`;
}
