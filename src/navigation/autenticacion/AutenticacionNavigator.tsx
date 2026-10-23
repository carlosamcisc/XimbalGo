import { createNativeStackNavigator } from "@react-navigation/native-stack";
import BienvenidaScreen from "../../screens/autenticacion/BienvenidaScreen";
import IncioSesionScreen from "../../screens/autenticacion/InicioSesionScreen";
import SeleccionRolScreen from "../../screens/autenticacion/SelecionRolScreen";
import RecuperarContraseniaScreen from "../../screens/autenticacion/RecuperarContraseniaScreen";
import RestablecerContraseniaScreen from "../../screens/autenticacion/RestablecerContraseniaScreen";
import RegistroScreen from "../../screens/autenticacion/RegistroScreen";
import type { AuthStackParamList } from "../types";

const Stack = createNativeStackNavigator<AuthStackParamList>();

interface AutenticacionNavigatorProps {
    initialRouteName: keyof AuthStackParamList;
}

export default function AutenticacionNavigator({
    initialRouteName,
}: AutenticacionNavigatorProps) {
    return(
        <Stack.Navigator
            initialRouteName={initialRouteName}
            screenOptions={{headerShown: false}}
        >
            <Stack.Screen name="Bienvenida" component={BienvenidaScreen}/>
            <Stack.Screen 
                name="InicioSesion" 
                component={IncioSesionScreen}
                options={{
                    headerShown: false, 
                    title: "Inicio de sesion"
                }}
            />
            <Stack.Screen
                name="SeleccionRol"
                component={SeleccionRolScreen}
                options={{
                    headerShown: false,
                    title: "Selecciona tu rol"
                }}

            />
            <Stack.Screen
                name="Registro"
                component={RegistroScreen}
                options={{
                    headerShown: false,
                    title: "Registro"
                }}

            />
            <Stack.Screen
                name="RecuperarContrasenia"
                component={RecuperarContraseniaScreen}
                options={{
                    headerShown: false,
                    title: "Recupera tu contraseña"
                }}
            />
            <Stack.Screen
                name="RestablecerContrasenia"
                component={RestablecerContraseniaScreen}
                options={{
                    headerShown: false,
                    title: "Restablece tu contraseña"
                }}
            />
        </Stack.Navigator>
    );
}