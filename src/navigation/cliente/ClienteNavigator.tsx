import { createNativeStackNavigator } from "@react-navigation/native-stack";
import ClienteInicioScreen from "../../screens/cliente/ClienteInicioScreen";
import ClienteReservacionesScreen from "../../screens/cliente/ClienteReservacionesScreen";
import ClienteRutasScreen from "../../screens/cliente/ClienteRutasScreen";
import ClientePerfilScreen from "../../screens/cliente/ClientePerfilScreen";
import ClienteNotificacionesScreen from "../../screens/cliente/ClienteNotificacionesScreen";
import ClienteSeguridadScreen from "../../screens/cliente/ClienteSeguridadScreen";
import ClienteAyudaScreen from "../../screens/cliente/ClienteAyudaScreen";
import { ClienteProvider } from "../../screens/cliente/ClienteContext";
import type { ClienteStackParamList } from "../types";

const Stack = createNativeStackNavigator<ClienteStackParamList>();

// El proveedor comparte el perfil, el resumen de viajes y las notificaciones
// entre el menú lateral y las pantallas, con una sola suscripción en tiempo real.
export default function ClienteNavigator(){
    return(
        <ClienteProvider>
            <Stack.Navigator
                initialRouteName="ClienteInicio"
                screenOptions={{headerShown: false}}
            >
                <Stack.Screen name="ClienteInicio" component={ClienteInicioScreen}/>
                <Stack.Screen
                    name="ClienteReservaciones"
                    component={ClienteReservacionesScreen}
                    options={{animation: "fade"}}
                />
                <Stack.Screen
                    name="ClienteRutas"
                    component={ClienteRutasScreen}
                    options={{animation: "fade"}}
                />
                <Stack.Screen name="ClientePerfil" component={ClientePerfilScreen}/>
                <Stack.Screen name="ClienteNotificaciones" component={ClienteNotificacionesScreen}/>
                <Stack.Screen name="ClienteSeguridad" component={ClienteSeguridadScreen}/>
                <Stack.Screen name="ClienteAyuda" component={ClienteAyudaScreen}/>
            </Stack.Navigator>
        </ClienteProvider>
    );
}
