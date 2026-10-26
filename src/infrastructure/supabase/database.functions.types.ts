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
      latitud: number;
      longitud: number;
    }[];
  };
  obtener_paradero: {
    Args: {
      p_paradero_id: string;
    };
    Returns: {
      id: string;
      nombre: string;
      referencia: string | null;
      foto_url: string | null;
      latitud: number | null;
      longitud: number | null;
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
      p_destino: string;
      p_origen?: string | null;
      p_paradero_origen_id?: string | null;
      p_latitud?: number | null;
      p_longitud?: number | null;
      p_fecha_hora_viaje?: string | null;
      p_notas?: string | null;
      p_cantidad_asientos?: number;
    };
    Returns: string;
  };
  obtener_taxis_disponibles: {
    Args: {
      p_latitud?: number | null;
      p_longitud?: number | null;
    };
    Returns: {
      vehiculo_id: string;
      matricula: string;
      nombre_taxista: string;
      asientos_disponibles: number;
      distancia_metros: number | null;
      ruta: string | null;
      precio: number | null;
    }[];
  };
  obtener_seguimiento_reserva: {
    Args: {
      p_reserva_id: string;
    };
    Returns: {
      estado: string;
      taxista_id: string;
      en_servicio: boolean;
      taxi_latitud: number | null;
      taxi_longitud: number | null;
      ubicacion_actualizada_en: string | null;
      punto_tipo: string | null;
      punto_nombre: string | null;
      punto_latitud: number | null;
      punto_longitud: number | null;
      paradero_nombre: string | null;
      paradero_latitud: number | null;
      paradero_longitud: number | null;
      velocidad_kmh: number;
    }[];
  };
  cancelar_reserva_cliente: {
    Args: {
      p_reserva_id: string;
    };
    Returns: undefined;
  };
  obtener_reservas_taxista: {
    Args: never;
    Returns: {
      id: string;
      estado: string;
      fecha_hora_reserva: string;
      fecha_hora_viaje: string | null;
      precio: number | null;
      notas: string | null;
      origen: string | null;
      destino: string | null;
      matricula: string | null;
      numero_asiento: number | null;
      cantidad_asientos: number;
      numeros_asientos: number[];
      nombre_cliente: string;
      telefono_cliente: string | null;
      motivo_taxista: string | null;
      asientos_ofrecidos: number | null;
    }[];
  };
  actualizar_reserva_taxista: {
    Args: {
      p_reserva_id: string;
      p_estado: string;
      p_motivo?: string | null;
    };
    Returns: undefined;
  };
  iniciar_ubicacion_compartida: {
    Args: {
      p_latitud: number;
      p_longitud: number;
      p_minutos: number;
    };
    Returns: {
      id: string;
      expira_en: string;
    }[];
  };
  actualizar_ubicacion_compartida: {
    Args: {
      p_id: string;
      p_latitud: number;
      p_longitud: number;
    };
    Returns: boolean;
  };
  detener_ubicacion_compartida: {
    Args: {
      p_id: string;
    };
    Returns: undefined;
  };
  obtener_ubicacion_compartida_activa: {
    Args: never;
    Returns: {
      id: string;
      expira_en: string;
    }[];
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
