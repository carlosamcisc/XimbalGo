import { useEffect, useState } from "react";
import {
    Alert,
    Pressable,
    StyleSheet,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import TextInputField from "../../components/TextInputField";
import Button from "../../components/Button";
import { Icono } from "../../components/Icono";
import AppText from "../../components/AppText";
import KeyboardAwareScroll from "../../components/KeyboardAwareScroll";
import type { AuthStackParamList } from "../../navigation/types";
import {
    cambiarContrasena,
    obtenerSesion,
} from "../../infrastructure/supabase/auth/auth.service";
import Colors from "../../theme/colors";

type Props = NativeStackScreenProps<
    AuthStackParamList,
    "RestablecerContrasenia"
>;

const RestablecerContraseniaScreen = ({ navigation, route }: Props) => {
    const [contrasena, setContrasena] = useState("");
    const [confirmarContrasena, setConfirmarContrasena] = useState("");
    const [cargando, setCargando] = useState(true);
    const [enlaceValido, setEnlaceValido] = useState(false);
    const [enviando, setEnviando] = useState(false);

    useEffect(() => {
        let activo = true;

        const validarEnlace = async () => {
            if (route.params?.recovery !== "verified") {
                setCargando(false);
                return;
            }

            try {
                const sesion = await obtenerSesion();
                if (activo) {
                    setEnlaceValido(!!sesion);
                }
            } catch (error: unknown) {
                if (activo) {
                    setEnlaceValido(false);
                    const mensaje =
                        error instanceof Error
                            ? error.message
                            : "Intenta nuevamente en unos momentos.";
                    Alert.alert("No se pudo verificar el enlace", mensaje);
                }
            } finally {
                if (activo) {
                    setCargando(false);
                }
            }
        };

        void validarEnlace();
        return () => {
            activo = false;
        };
    }, [route.params?.recovery]);

    const handleRestablecerContrasena = async () => {
        if (!contrasena || !confirmarContrasena) {
            Alert.alert("Completa todos los campos");
            return;
        }

        if (contrasena !== confirmarContrasena) {
            Alert.alert("Las contraseñas no coinciden");
            return;
        }

        setEnviando(true);
        try {
            await cambiarContrasena(contrasena);
            Alert.alert(
                "Contraseña actualizada",
                "Ya puedes iniciar sesión con tu nueva contraseña.",
                [
                    {
                        text: "Ir a iniciar sesión",
                        onPress: () =>
                            navigation.reset({
                                index: 0,
                                routes: [{ name: "InicioSesion" }],
                            }),
                    },
                ]
            );
        } catch (error: unknown) {
            const mensaje =
                error instanceof Error
                    ? error.message
                    : "Intenta nuevamente en unos momentos.";
            Alert.alert("No se pudo actualizar la contraseña", mensaje);
        } finally {
            setEnviando(false);
        }
    };

    return (
        <SafeAreaView style={styles.statusBAR} edges={["top", "bottom"]}>
            <StatusBar style="light" />
            <View style={styles.pantalla}>
                <KeyboardAwareScroll contentContainerStyle={styles.scrollContent}>
                    <View style={styles.contentNavigation}>
                        <Pressable
                            style={styles.botonAtras}
                            onPress={() => {
                                if (navigation.canGoBack()) {
                                    navigation.goBack();
                                } else {
                                    navigation.replace("InicioSesion");
                                }
                            }}
                        >
                            <Icono nombre="arrowBack" tamanio={26} color={Colors.black} />
                        </Pressable>
                        <AppText style={styles.textAtras}>Atrás</AppText>
                    </View>

                    <View style={styles.conteinerTitulos}>
                        <AppText weight="bold" style={styles.titulo}>
                            Crea una nueva contraseña
                        </AppText>
                        <AppText style={styles.subTitulo}>
                            Elige una contraseña nueva y confírmala para recuperar el acceso
                            a tu cuenta.
                        </AppText>
                    </View>

                    {cargando ? (
                        <AppText style={styles.mensajeEstado}>
                            Verificando el enlace...
                        </AppText>
                    ) : enlaceValido ? (
                        <>
                            <View style={styles.card}>
                                <TextInputField
                                    label="Nueva contraseña"
                                    value={contrasena}
                                    placeholder="Escribe tu nueva contraseña..."
                                    onChangeText={setContrasena}
                                    icono="lock"
                                    secureTextEntry
                                    autoCapitalize="none"
                                />
                                <TextInputField
                                    label="Confirma tu contraseña"
                                    value={confirmarContrasena}
                                    placeholder="Vuelve a escribir tu contraseña..."
                                    onChangeText={setConfirmarContrasena}
                                    icono="lock"
                                    secureTextEntry
                                    autoCapitalize="none"
                                />
                            </View>
                            <View style={styles.contenedorBoton}>
                                <Button
                                    titulo={
                                        enviando
                                            ? "Actualizando contraseña..."
                                            : "Guardar contraseña"
                                    }
                                    onPress={handleRestablecerContrasena}
                                    icono="arrowForward"
                                    disabled={enviando}
                                />
                            </View>
                        </>
                    ) : (
                        <View style={styles.cardAviso}>
                            <Icono nombre="info" tamanio={24} color={Colors.primary} />
                            <View style={styles.contenidoAviso}>
                                <AppText style={styles.textAviso}>
                                    Este enlace no es válido o ya venció. Solicita uno nuevo
                                    para continuar.
                                </AppText>
                                <Pressable
                                    onPress={() =>
                                        navigation.replace("RecuperarContrasenia")
                                    }
                                >
                                    <AppText style={styles.textoEnlace}>
                                        Solicitar otro enlace
                                    </AppText>
                                </Pressable>
                            </View>
                        </View>
                    )}
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
        flexGrow: 1,
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
    card: {
        marginTop: 24,
        justifyContent: "center",
        alignItems: "stretch",
        marginHorizontal: 20,
        paddingVertical: 8,
        backgroundColor: Colors.onPrimary,
        borderColor: Colors.onPrimary,
        borderWidth: 1,
        borderRadius: 20,
        elevation: 2,
    },
    contenedorBoton: {
        justifyContent: "center",
        alignItems: "stretch",
        margin: 10,
    },
    mensajeEstado: {
        margin: 24,
        textAlign: "center",
        fontSize: 16,
    },
    cardAviso: {
        flexDirection: "row",
        alignItems: "flex-start",
        margin: 20,
        padding: 14,
        borderRadius: 12,
        backgroundColor: Colors.secondaryContainer,
    },
    contenidoAviso: {
        flex: 1,
        marginLeft: 10,
    },
    textAviso: {
        color: Colors.primary,
        fontSize: 14,
        lineHeight: 20,
    },
    textoEnlace: {
        marginTop: 12,
        color: Colors.primary,
        fontSize: 15,
        fontWeight: "bold",
    },
});

export default RestablecerContraseniaScreen;
