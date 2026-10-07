import { createNativeStackNavigator } from "@react-navigation/native-stack";
import TaxistaInicioScreen from "../../screens/taxista/TaxistaInicioScreen";
import type { TaxistaStackParamList } from "../types";

const Stack = createNativeStackNavigator<TaxistaStackParamList>();

export default function TaxistaNavigator() {
    return (
        <Stack.Navigator
            initialRouteName="TaxistaInicio"
            screenOptions={{ headerShown: false }}
        >
            <Stack.Screen name="TaxistaInicio" component={TaxistaInicioScreen} />
        </Stack.Navigator>
    );
}