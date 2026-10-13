import { supabase } from "../client";
import {
  formatearHorario,
  type RutaCatalogo,
  type TaxistaRuta,
} from "../../../modules/cliente/rutas";

export async function obtenerCatalogoRutas(): Promise<RutaCatalogo[]> {
  // La política `rutas_ver_todos` ya oculta las rutas inactivas.
  const { data, error } = await supabase
    .from("rutas")
    .select("id, nombre, origen, destino, distancia_km, tiempo_estimado_min, precio_base")
    .eq("activa", true)
    .order("nombre");

  if (error) {
    throw error;
  }

  return data.map((ruta) => ({
    id: ruta.id,
    nombre: ruta.nombre,
    origen: ruta.origen,
    destino: ruta.destino,
    distanciaKm: ruta.distancia_km,
    tiempoEstimadoMin: ruta.tiempo_estimado_min,
    precioBase: ruta.precio_base,
  }));
}

// `asientos` también se relaciona con la vista de asientos, por eso se indica
// la llave foránea.
const SELECT_TAXISTA_RUTA = `
  id, nombres, apellidos, telefono, ruta_id, punto_partida, punto_destino, precio_ruta,
  horario_trabajo, hora_inicio_trabajo, hora_fin_trabajo, taxista_activo,
  vehiculos(id, matricula, marca, modelo, activo,
    asientos!asientos_vehiculo_id_fkey(estado))
`;

/**
 * Taxistas con una ruta. `trigger_sincronizar_ruta_taxista` copia el origen y
 * destino de la ruta elegida en `punto_partida` y `punto_destino`, así que
 * ambos existen también cuando hay `ruta_id`.
 */
export async function obtenerTaxistasConRuta(): Promise<TaxistaRuta[]> {
  const { data, error } = await supabase
    .from("taxistas")
    .select(SELECT_TAXISTA_RUTA)
    .not("punto_partida", "is", null)
    .not("punto_destino", "is", null);

  if (error) {
    throw error;
  }

  return data
    .filter((taxista) => taxista.punto_partida?.trim() && taxista.punto_destino?.trim())
    .map((taxista) => ({
      rutaId: taxista.ruta_id,
      id: taxista.id,
      nombre: `${taxista.nombres} ${taxista.apellidos}`.trim(),
      telefono: taxista.telefono,
      horario: formatearHorario(
        taxista.horario_trabajo,
        taxista.hora_inicio_trabajo,
        taxista.hora_fin_trabajo
      ),
      precio: taxista.precio_ruta,
      enServicio: taxista.taxista_activo,
      origen: taxista.punto_partida!.trim(),
      destino: taxista.punto_destino!.trim(),
      // Las políticas RLS solo devuelven vehículos activos al cliente.
      vehiculos: taxista.vehiculos
        .filter((vehiculo) => vehiculo.activo)
        .map((vehiculo) => ({
          id: vehiculo.id,
          matricula: vehiculo.matricula,
          descripcion:
            [vehiculo.marca, vehiculo.modelo].filter(Boolean).join(" ") || null,
          asientosDisponibles: vehiculo.asientos.filter(
            (asiento) => asiento.estado === "disponible"
          ).length,
          totalAsientos: vehiculo.asientos.length,
        })),
    }));
}

let suscripciones = 0;

/**
 * Avisa cuando un taxista entra o sale de servicio, cambia su ruta o se
 * ocupa un asiento. `rutas` y `vehiculos` no están en la publicación de
 * Realtime, así que esos cambios se ven al recargar.
 */
export function escucharDisponibilidadRutas(onChange: () => void) {
  // Nombre único por suscripción: ver `escucharReservasCliente`.
  const channel = supabase
    .channel(`rutas-cliente-${++suscripciones}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "taxistas" }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "asientos" }, onChange)
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}
