import type { Coordenadas } from "./ubicacion";

export interface PerfilCliente {
  nombres: string;
  apellidos: string;
}

export interface ParaderoViaje {
  id: string;
  nombre: string;
  referencia: string | null;
}

export type OrigenViaje =
  | { tipo: "paradero"; paradero: ParaderoViaje }
  | { tipo: "ubicacion"; coordenadas: Coordenadas; direccion: string | null };
