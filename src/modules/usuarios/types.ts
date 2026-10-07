export type RolUsuario = "cliente" | "taxista" | "administrador";

export type Usuario ={
    idUsuario: number;
    correo: string;
    contrasenia: string;
    rol: RolUsuario;
};