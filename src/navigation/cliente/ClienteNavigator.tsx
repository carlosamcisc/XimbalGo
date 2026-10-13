import { createNativeStackNavigator } from "@react-navigation/native-stack";
import ClienteInicioScreen from "../../screens/cliente/ClienteInicioScreen";
import ClienteReservacionesScreen from "../../screens/cliente/ClienteReservacionesScreen";
import type { ClienteStackParamList } from "../types";

const Stack = createNativeStackNavigator<ClienteStackParamList>();

export default function ClienteNavigator(){
    return(
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
        </Stack.Navigator>
    );
}
