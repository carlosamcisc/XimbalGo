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
};

type PublicSchema = Database["public"];

export type DatabaseWithNearbyFunctions = Omit<Database, "public"> & {
  public: Omit<PublicSchema, "Functions"> & {
    Functions: PublicSchema["Functions"] & NearbyFunctions;
  };
};
