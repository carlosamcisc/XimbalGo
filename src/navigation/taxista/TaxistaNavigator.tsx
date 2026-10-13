import { createNativeStackNavigator } from "@react-navigation/native-stack";
import TaxistaInicioScreen from "../../screens/taxista/TaxistaInicioScreen";
import TaxistaViajesScreen from "../../screens/taxista/TaxistaViajesScreen";
import TaxistaVehiculoScreen from "../../screens/taxista/TaxistaVehiculoScreen";
import TaxistaPerfilScreen from "../../screens/taxista/TaxistaPerfilScreen";
import { TaxistaProvider } from "../../screens/taxista/TaxistaContext";
import type { TaxistaStackParamList } from "../types";

const Stack = createNativeStackNavigator<TaxistaStackParamList>();

// El proveedor envuelve todas las pantallas: comparten datos, una sola
// suscripción en tiempo real y el envío de ubicación mientras está en servicio.
export default function TaxistaNavigator() {
    return (
        <TaxistaProvider>
            <Stack.Navigator
                initialRouteName="TaxistaInicio"
                screenOptions={{ headerShown: false, animation: "fade" }}
            >
                <Stack.Screen name="TaxistaInicio" component={TaxistaInicioScreen} />
                <Stack.Screen name="TaxistaViajes" component={TaxistaViajesScreen} />
                <Stack.Screen name="TaxistaVehiculo" component={TaxistaVehiculoScreen} />
                <Stack.Screen name="TaxistaPerfil" component={TaxistaPerfilScreen} />
            </Stack.Navigator>
        </TaxistaProvider>
    );
}
