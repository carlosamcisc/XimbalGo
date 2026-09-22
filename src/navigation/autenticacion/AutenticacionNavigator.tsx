import { createNativeStackNavigator } from "@react-navigation/native-stack";
import BienvenidaScreen from "../../screens/autenticacion/BienvenidaScreen";
import IncioSesionScreen from "../../screens/autenticacion/InicioSesionScreen";
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
                options={{headerShown: true, title: "Inicio de sesion"}}
                />
        </Stack.Navigator>
    );
}