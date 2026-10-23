import { createNativeStackNavigator } from "@react-navigation/native-stack";
import AdminInicioScreen from "../../screens/administrador/AdminInicioScreen";
import type { AdminStackParamList } from "../types";

const Stack = createNativeStackNavigator<AdminStackParamList>();

export default function AdminNavigator() {
    return (
        <Stack.Navigator
            initialRouteName="AdminInicio"
            screenOptions={{ headerShown: false }}
        >
            <Stack.Screen name="AdminInicio" component={AdminInicioScreen} />
        </Stack.Navigator>
    );
}