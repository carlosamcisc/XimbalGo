import type { Database } from "./database.types";

type NearbyFunctions = {
  obtener_paraderos_cercanos: {
    Args: {
      p_latitud: number;
      p_longitud: number;
      p_limite?: number;
    };
    Returns: {
      id: string;
      nombre: string;
      referencia: string | null;
      distancia_metros: number;
    }[];
  };
  obtener_taxis_cercanos: {
    Args: {
      p_latitud: number;
      p_longitud: number;
      p_limite?: number;
    };
    Returns: {
      vehiculo_id: string;
      matricula: string;
      nombre_taxista: string;
      asientos_disponibles: number;
      distancia_metros: number;
    }[];
  };
  crear_reserva_cliente: {
    Args: {
      p_vehiculo_id: string;
      p_paradero_destino_id: string;
      p_paradero_origen_id?: string | null;
      p_fecha_hora_viaje?: string | null;
      p_notas?: string | null;
    };
    Returns: string;
  };
  cancelar_reserva_cliente: {
    Args: {
      p_reserva_id: string;
    };
    Returns: undefined;
  };
};

type PublicSchema = Database["public"];

// Los tipos generados no admiten `null` en los parámetros opcionales: estas
// definiciones reemplazan a las generadas en lugar de combinarse con ellas.
export type DatabaseWithNearbyFunctions = Omit<Database, "public"> & {
  public: Omit<PublicSchema, "Functions"> & {
    Functions: Omit<PublicSchema["Functions"], keyof NearbyFunctions> & NearbyFunctions;
  };
};
