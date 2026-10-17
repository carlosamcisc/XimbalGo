//roles disponibles para un usuario de XimbalGo
import type { RolUsuario } from "../modules/usuarios/types";
import type { ParaderoViaje } from "../modules/cliente/types";

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
    /** Desde el detalle de un paradero: lo selecciona como origen. */
    ClienteInicio: { paraderoOrigen?: ParaderoViaje } | undefined;
    ClienteReservaciones: undefined;
    /** Todos los paraderos activos. */
    ClienteParaderos: undefined;
    /** `distanciaMetros` llega desde los paraderos cercanos. */
    ClienteParadero: { paraderoId: string; distanciaMetros?: number };
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
