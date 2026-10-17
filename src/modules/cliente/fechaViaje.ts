import { DIAS_ANTICIPACION_RESERVA } from "./reservas";

/** Separación entre los horarios que se ofrecen. */
export const MINUTOS_ENTRE_HORARIOS = 15;
// Un horario de hoy debe dejar margen para que el taxista vea la solicitud.
const MINUTOS_MINIMOS_ANTICIPACION = 15;

export interface DiaViaje {
  /** `AAAA-MM-DD` en la zona horaria del dispositivo. */
  clave: string;
  etiqueta: string;
  detalle: string;
  fecha: Date;
}

const claveDia = (fecha: Date) =>
  [
    fecha.getFullYear(),
    String(fecha.getMonth() + 1).padStart(2, "0"),
    String(fecha.getDate()).padStart(2, "0"),
  ].join("-");

/** Hoy y los días siguientes que admite `crear_reserva_cliente`. */
export function diasDisponibles(ahora = new Date()): DiaViaje[] {
  return Array.from({ length: DIAS_ANTICIPACION_RESERVA }, (_, indice) => {
    const fecha = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate() + indice);
    const detalle = fecha.toLocaleDateString("es-MX", { day: "numeric", month: "short" });
    const etiqueta =
      indice === 0
        ? "Hoy"
        : indice === 1
          ? "Mañana"
          : fecha.toLocaleDateString("es-MX", { weekday: "short" });
    return {
      clave: claveDia(fecha),
      etiqueta: etiqueta.charAt(0).toUpperCase() + etiqueta.slice(1),
      detalle,
      fecha,
    };
  });
}

/**
 * Horarios cada 15 minutos del día elegido. En hoy empiezan con al menos 15
 * minutos de anticipación; el último día termina antes del límite de 7 días.
 */
export function horariosDelDia(dia: DiaViaje, ahora = new Date()): Date[] {
  const minimo = ahora.getTime() + MINUTOS_MINIMOS_ANTICIPACION * 60_000;
  const maximo = ahora.getTime() + DIAS_ANTICIPACION_RESERVA * 24 * 60 * 60_000;
  const horarios: Date[] = [];
  for (let minutos = 0; minutos < 24 * 60; minutos += MINUTOS_ENTRE_HORARIOS) {
    const horario = new Date(
      dia.fecha.getFullYear(),
      dia.fecha.getMonth(),
      dia.fecha.getDate(),
      Math.floor(minutos / 60),
      minutos % 60
    );
    if (horario.getTime() >= minimo && horario.getTime() <= maximo) {
      horarios.push(horario);
    }
  }
  return horarios;
}
