import type { RolUsuario } from "../../../modules/usuarios/types";

export type RolRegistrable = Exclude<RolUsuario, "administrador">;

export interface DatosRegistro {
  correo: string;
  password: string;

  nombres: string;
  apellidos: string;

  telefono: string;

  rol: RolRegistrable;

  edad?: number;
  direccion?: string;

  puntoPartida?: string;
  puntoDestino?: string;
  horarioTrabajo?: string;
  precioRuta?: number;
}