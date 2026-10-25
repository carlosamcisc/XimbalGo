import { formatearHora } from "./reservas";

/** Ubicación que el cliente comparte con un familiar por un enlace. */
export interface UbicacionCompartida {
  id: string;
  expiraEn: string;
}

export interface DuracionCompartir {
  minutos: number;
  etiqueta: string;
}

export const DURACIONES_COMPARTIR: readonly DuracionCompartir[] = [
  { minutos: 30, etiqueta: "30 min" },
  { minutos: 60, etiqueta: "1 hora" },
  { minutos: 240, etiqueta: "4 horas" },
];

// Página web de `web/compartir/`; ver docs/cliente-compartir-ubicacion.md.
const URL_PAGINA = process.env.EXPO_PUBLIC_URL_UBICACION_COMPARTIDA ?? "";

export const paginaUbicacionConfigurada = URL_PAGINA !== "";

export function enlaceUbicacionCompartida(id: string): string {
  if (!URL_PAGINA) {
    throw new Error("Falta configurar la página para ver la ubicación compartida.");
  }
  return `${URL_PAGINA.replace(/\/+$/, "")}/?id=${encodeURIComponent(id)}`;
}

export function mensajeUbicacionCompartida(
  nombre: string,
  compartida: UbicacionCompartida
): string {
  return (
    `${nombre} te comparte su ubicación en tiempo real con Xímbal Go ` +
    `hasta las ${formatearHora(compartida.expiraEn)}: ${enlaceUbicacionCompartida(compartida.id)}`
  );
}
