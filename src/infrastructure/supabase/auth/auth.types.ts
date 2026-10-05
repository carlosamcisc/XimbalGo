export type RolUsuario = "cliente" | "taxista";

export interface DatosRegistro {
  correo: string;
  password: string;

  nombres: string;
  apellidos: string;

  telefono: string;

  rol: RolUsuario;

  edad?: number;
  direccion?: string;

  puntoPartida?: string;
  puntoDestino?: string;
  horarioTrabajo?: string;
  precioRuta?: number;
}