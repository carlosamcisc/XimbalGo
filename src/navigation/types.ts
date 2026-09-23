//roles disponibles para un usuario de XimbalGo
export type Rol = 'cliente' | 'taxista' | 'administrador';

//crear las rutas de las pantallas de Auntenticacion
export type AuthStackParamList ={
    Bienvenida: undefined;
    InicioSesion: undefined;
    RecuperarContrasenia: undefined;
    Registro: { rol: Rol };
    SeleccionRol: undefined;
};
