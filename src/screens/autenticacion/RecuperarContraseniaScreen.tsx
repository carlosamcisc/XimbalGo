import { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { AuthStackParamList } from "../../navigation/types";
import { SafeAreaView } from "react-native-safe-area-context";
import { View, StyleSheet, Alert, Pressable } from "react-native";
import Colors from "../../theme/colors";
import { StatusBar } from "expo-status-bar";
import TextInputField from "../../components/TextInputField";
import { useState } from "react";
import Button from "../../components/Button";
import { Icono } from "../../components/Icono";
import BottomWave from "../../components/BottomWave";
import LottieView from "lottie-react-native";
import ForgotPassword from "../../../assets/lotties/ForgotPassword.json";
import AppText from "../../components/AppText";
import KeyboardAwareScroll from "../../components/KeyboardAwareScroll";
import { recuperarContrasena } from "../../infrastructure/supabase/auth/auth.service";

type Props = NativeStackScreenProps<AuthStackParamList, 'RecuperarContrasenia'>;
const RecuperarContraseniaScreen = ({ navigation }: Props) => {
    const [correo, setCorreo] = useState("");
    const [cargando, setCargando] = useState(false);

    const handleRecuperarContrasena = async () => {
        const correoLimpio = correo.trim();

        if (!correoLimpio) {
            Alert.alert("Ingresa tu correo electrónico");
            return;
        }

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correoLimpio)) {
            Alert.alert("Correo inválido", "Ingresa un correo electrónico válido.");
            return;
        }

        setCargando(true);
        try {
            await recuperarContrasena(correoLimpio);
            Alert.alert(
                "Solicitud enviada",
                "Si el correo está registrado, recibirás un enlace para recuperar tu contraseña."
            );
        } catch (error: unknown) {
            const mensaje =
                error instanceof Error
                    ? error.message
                    : "Intenta nuevamente en unos momentos.";
            Alert.alert("No se pudo enviar el enlace", mensaje);
        } finally {
            setCargando(false);
        }
    };

    return (
        <SafeAreaView style={styles.statusBAR} edges={['top', 'bottom']}>
            <StatusBar style="light" />
            <View style={styles.pantalla}>
                {/* FIGURA CURVA */}
                <BottomWave />
                <KeyboardAwareScroll contentContainerStyle={styles.scrollContent}>
                    <View style={styles.contentNavigation}>
                        <Pressable style={styles.botonAtras} onPress={() => navigation.goBack()}>
                            <Icono nombre="arrowBack" tamanio={26} color={Colors.dark} />
                        </Pressable>
                        <AppText style={styles.textAtras}>Atras</AppText>
                    </View>

                    <View style={styles.conteinerTitulos}>
                        <AppText weight="bold" style={styles.titulo}>Recupera tu contraseña</AppText>
                        <AppText style={styles.subTitulo}>Te enviaremos un enlace para que puedas recuperar tu contraseña.</AppText>
                    </View>
                    {/**Animacion */}
                    <LottieView
                        source={ForgotPassword}
                        loop
                        autoPlay
                        style={styles.lottie}
                    />

                    <View style={styles.card}>
                        <TextInputField
                            label="Correo electronico"
                            value={correo}
                            placeholder="Escribe tu correo..."
                            onChangeText={setCorreo}
                            icono="email"
                            keyboardType="email-address"
                            autoCapitalize="none"
                        />

                        <View style={styles.cardAviso}>
                            <Icono nombre="info" tamanio={24} color={Colors.primary} />
                            <AppText style={styles.textAviso}>Ten en cuenta que tu correo debe estar registrado a nuestro sistema</AppText>
                        </View>
                    </View>
                    <View style={styles.contenedorBoton}>
                        <Button
                            titulo={cargando ? "Enviando enlace..." : "Enviar enlace"}
                            onPress={handleRecuperarContrasena}
                            icono="arrowForward"
                            disabled={cargando}
                        />
                    </View>

                </KeyboardAwareScroll>

            </View>


        </SafeAreaView>
    );
};

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
    contentNavigation: {
        flexDirection: "row",
    },
    botonAtras: {
        marginTop: 10,
        marginLeft: 10,
        alignSelf: "flex-start",
        padding: 6,
    },
    textAtras: {
        marginTop: 15,
        fontSize: 20,
        marginLeft: 10,
    },
    conteinerTitulos: {
        marginTop: 20,
        justifyContent: "flex-start",
        marginLeft: 20,

    },
    titulo: {
        fontSize: 24,
    },
    subTitulo: {
        marginTop: 10,
        marginRight: 10,
        fontSize: 14,
        lineHeight: 20,
    },
    lottie: {
        width: '100%',
        height: 250,
    },
    card: {
        marginTop: 1,
        justifyContent: "center",
        alignItems: "stretch",
        margin: 20,
        backgroundColor: Colors.onPrimary,
        borderColor: Colors.onPrimary,
        borderWidth: 1,
        borderRadius: 20,
        elevation: 2,
        marginBottom: 5,
    },
    cardAviso: {
        backgroundColor: Colors.secondaryContainer,
        margin: 7,
        padding: 10,
        borderRadius: 10,
        flexDirection: "row",
        alignItems: "center",
    },
    textAviso: {
        marginLeft: 8,
        fontSize: 13,
        color: Colors.primary,
        lineHeight: 20,
        flex: 1,
    },
    contenedorBoton: {
        justifyContent: "center",
        alignItems: "stretch",
        margin: 10,
    },
});
export default RecuperarContraseniaScreen;