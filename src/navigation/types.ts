//roles disponibles para un usuario de XimbalGo
import type { RolUsuario } from "../modules/usuarios/types";

export type Rol = RolUsuario;

//crear las rutas de las pantallas de Auntenticacion
export type AuthStackParamList ={
    Bienvenida: undefined;
    InicioSesion: undefined;
    RecuperarContrasenia: undefined;
    RestablecerContrasenia: { recovery?: string } | undefined;
    Registro: { rol: Exclude<Rol, 'administrador'> };
    SeleccionRol: undefined;
};

//crear las rutas de las pantallas de Cliente
export type ClienteStackParamList ={
    ClienteInicio: undefined;
};

export type TaxistaStackParamList = {
    TaxistaInicio: undefined;
};

export type AdminStackParamList = {
    AdminInicio: undefined;
};
