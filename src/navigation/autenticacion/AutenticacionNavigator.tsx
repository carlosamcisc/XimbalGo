import { createNativeStackNavigator } from "@react-navigation/native-stack";
import BienvenidaScreen from "../../screens/autenticacion/BienvenidaScreen";
import IncioSesionScreen from "../../screens/autenticacion/InicioSesionScreen";
import SeleccionRolScreen from "../../screens/autenticacion/SelecionRolScreen";
import RegistroScreen from "../../screens/autenticacion/RegistroScreen";
import type { AuthStackParamList } from "../types";

const Stack = createNativeStackNavigator<AuthStackParamList>();

export default function AutenticacionNavigator(){
    return(
        <Stack.Navigator
            initialRouteName="Bienvenida"
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
        </Stack.Navigator>
    );
}