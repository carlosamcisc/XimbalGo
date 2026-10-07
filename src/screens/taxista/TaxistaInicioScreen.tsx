import { StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import AppText from "../../components/AppText";
import Colors from "../../theme/colors";

export default function TaxistaInicioScreen() {
    return (
        <SafeAreaView style={styles.contenedor} edges={["top", "bottom"]}>
            <StatusBar style="dark" />
            <View style={styles.contenido}>
                <AppText weight="bold" style={styles.titulo}>
                    Inicio de taxista
                </AppText>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    contenedor: {
        flex: 1,
        backgroundColor: Colors.surface,
    },
    contenido: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
    },
    titulo: {
        fontSize: 24,
    },
});