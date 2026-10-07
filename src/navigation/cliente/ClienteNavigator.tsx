import { createNativeStackNavigator } from "@react-navigation/native-stack";
import ClienteInicioScreen from "../../screens/cliente/ClienteInicioScreen";
import type { ClienteStackParamList } from "../types";

const Stack = createNativeStackNavigator<ClienteStackParamList>();

export default function ClienteNavigator(){
    return(
        <Stack.Navigator
            initialRouteName="ClienteInicio"
            screenOptions={{headerShown: false}}
        >
            <Stack.Screen name="ClienteInicio" component={ClienteInicioScreen}/>
        </Stack.Navigator>
    );
}