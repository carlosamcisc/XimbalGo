import { normalizarTexto } from "./rutas";
import type { OrigenViaje } from "./types";

/** GPS y paraderos no tienen asociación con rutas: se valida el destino. */
export function taxiCompatible(taxi: { origenRuta: string | null; destinoRuta: string | null }, origen: OrigenViaje, destino: string): boolean {
  const iguales = (a: string | null, b: string) => !!a?.trim() && normalizarTexto(a) === normalizarTexto(b);
  return iguales(taxi.destinoRuta, destino) && (origen.tipo !== "ruta" || iguales(taxi.origenRuta, origen.nombre));
}
export const MENSAJE_TAXI_INCOMPATIBLE = "La ruta de este taxi no corresponde a tu viaje. Elige otro taxi.";
