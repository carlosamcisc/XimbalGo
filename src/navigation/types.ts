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
    ClienteReservaciones: undefined;
    /** Desde «Buscar ruta»: muestra solo las rutas de ese origen y destino. */
    ClienteRutas: { origen?: string; destino?: string } | undefined;
    ClientePerfil: undefined;
    ClienteNotificaciones: undefined;
    ClienteSeguridad: undefined;
    ClienteAyuda: undefined;
};

export type TaxistaStackParamList = {
    TaxistaInicio: undefined;
    TaxistaViajes: undefined;
    TaxistaVehiculo: undefined;
    TaxistaPerfil: undefined;
};

export type AdminStackParamList = {
    AdminInicio: undefined;
};
