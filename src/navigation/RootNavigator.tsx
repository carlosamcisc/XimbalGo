import { useEffect } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import AppText from "../components/AppText";
import Colors from "../theme/colors";
import {
    inicializarAutenticacion,
    useAutenticacionStore,
} from "../store/autenticacionStore";
import AdminNavigator from "./aministrador/AdminNavigator";
import AutenticacionNavigator from "./autenticacion/AutenticacionNavigator";
import ClienteNavigator from "./cliente/ClienteNavigator";
import TaxistaNavigator from "./taxista/TaxistaNavigator";

export default function RootNavigator() {
    const {
        bienvenidaCompletada,
        errorInicializacion,
        inicializando,
        rol,
        usuario,
    } = useAutenticacionStore();

    useEffect(() => {
        void inicializarAutenticacion();
    }, []);

    if (inicializando) {
        return (
            <View style={styles.estado}>
                <ActivityIndicator color={Colors.primary} />
            </View>
        );
    }

    if (errorInicializacion) {
        return (
            <View style={styles.estado}>
                <AppText style={styles.error}>
                    No se pudo preparar la aplicación: {errorInicializacion}
                </AppText>
                <Pressable onPress={() => void inicializarAutenticacion()}>
                    <AppText weight="bold" style={styles.reintentar}>
                        Intentar de nuevo
                    </AppText>
                </Pressable>
            </View>
        );
    }

    if (usuario && rol === "cliente") {
        return <ClienteNavigator />;
    }

    if (usuario && rol === "taxista") {
        return <TaxistaNavigator />;
    }

    if (usuario && rol === "administrador") {
        return <AdminNavigator />;
    }

    return (
        <AutenticacionNavigator
            initialRouteName={
                bienvenidaCompletada || usuario
                    ? "InicioSesion"
                    : "Bienvenida"
            }
        />
    );
}

const styles = StyleSheet.create({
    estado: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        backgroundColor: Colors.surface,
    },
    error: {
        textAlign: "center",
    },
    reintentar: {
        marginTop: 16,
        color: Colors.primary,
    },
});