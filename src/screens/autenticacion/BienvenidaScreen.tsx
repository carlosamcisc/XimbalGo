import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { AuthStackParamList } from "../../navigation/types";
import Button from "../../components/Button";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useState } from "react";
import { Alert, useWindowDimensions, View, StyleSheet } from "react-native";
import Colors from "../../theme/colors";
import { StatusBar } from "expo-status-bar";
import KeyboardAwareScroll from "../../components/KeyboardAwareScroll";
import AppText from "../../components/AppText";
import BottomWavePrimary from "../../components/BottomWavePrimary";
import DecorativeBubble from "../../components/DecorativeBubble";
import LottieView from "lottie-react-native";
import AreaMap from "../../../assets/lotties/area-map.json";
import { marcarBienvenidaCompletada } from "../../store/autenticacionStore";

type Props = NativeStackScreenProps<AuthStackParamList, 'Bienvenida'>;

//crear la pantalla de bienvenida
const BienvenidaScreen = ({ navigation }: Props) => {
    const { height } = useWindowDimensions();
    const [guardandoBienvenida, setGuardandoBienvenida] = useState(false);

    const handleSiniciar = async () => {
        setGuardandoBienvenida(true);
        try {
            await marcarBienvenidaCompletada();
            navigation.navigate('SeleccionRol');
        } catch (error: unknown) {
            const mensaje =
                error instanceof Error
                    ? error.message
                    : 'No se pudo guardar el estado de bienvenida.';
            Alert.alert('No se pudo continuar', mensaje);
        } finally {
            setGuardandoBienvenida(false);
        }
    }

    return (
        <SafeAreaView style={styles.statusBAR} edges={['top', 'bottom']}>
            <StatusBar style="light" />
            <View style={styles.pantalla}>
                {/* =========================
                    DECORACIONES
                ========================== */}

                <DecorativeBubble
                    size={110}
                    color={Colors.primaryContainer}
                    opacity={0.55}
                    style={{
                        top: 20,
                        right: -45,
                    }}
                />

                <DecorativeBubble
                    size={70}
                    color={Colors.primaryContainer}
                    opacity={0.45}
                    style={{
                        top: height * 0.48,
                        left: -35,
                    }}
                />

                <DecorativeBubble
                    size={45}
                    color={Colors.primaryContainer}
                    opacity={0.8}
                    style={{
                        top: height * 0.38,
                        right: 20,
                    }}
                />
                <BottomWavePrimary />

                <KeyboardAwareScroll contentContainerStyle={styles.scrollContent}>
                    <View style={styles.contenedorText}>
                        <AppText style={styles.titulo}>Bienvenido a </AppText>
                        <View style={styles.contentTitulos}>
                            <AppText weight="bold" style={styles.subtitulo}>Ximbal</AppText>
                            <AppText weight="bold" style={styles.subtituloGO}> Go</AppText>
                        </View>
                        <AppText style={styles.informacion}>Descubre, explora y encuentra lo mejor de tu entorno.</AppText>
                    </View>
                    <LottieView
                        source={AreaMap}
                        loop
                        autoPlay
                        style={styles.lottie}
                    />

                    <View style={styles.contenedorButton}>
                        <Button
                            titulo={guardandoBienvenida ? "Cargando..." : "Comienza tu experiencia   "}
                            icono="navigateNext"
                            onPress={handleSiniciar}
                            disabled={guardandoBienvenida}
                        />
                    </View>
                </KeyboardAwareScroll>

            </View>

        </SafeAreaView>
    );

};

//crear estilos de la pantalla
const styles = StyleSheet.create({
    statusBAR: {
        flex: 1,
        backgroundColor: Colors.primary,
    },
    pantalla: {
        flex: 1,
        backgroundColor: Colors.surface,
    },
    scrollContent: {
        paddingBottom: 100,
    },
    titulo: {
        fontSize: 25,
    },
    contentTitulos: {
        flexDirection: "row"
    },
    subtitulo: {
        fontSize: 40,
    },
    subtituloGO: {
        fontSize: 40,
        color: Colors.primary,
    },
    informacion: {
        fontSize: 17,
        lineHeight: 24,
    },
    contenedorText: {
        marginTop: 30,
        marginInlineStart: 20,
    },
    lottie: {
        width: '100%',
        height: 250,
    },
    contenedorButton: {
        marginTop: 200,
        margin: 20,
        marginBottom: 20,
    },
});

export default BienvenidaScreen;