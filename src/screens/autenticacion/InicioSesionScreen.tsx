import TextInputField from "../../components/TextInputField";
import Button from "../../components/Button";
import { View, Text, StyleSheet, Image, Pressable, Alert, ToastAndroid } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useState } from "react";
import Colors from "../../theme/colors";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { AuthStackParamList, Rol } from "../../navigation/types";
import { StatusBar } from "expo-status-bar";
import BottomWave from "../../components/BottomWave";
import KeyboardAwareScroll from "../../components/KeyboardAwareScroll";
import AppText from "../../components/AppText";

type Props = NativeStackScreenProps<AuthStackParamList, 'InicioSesion'>;

const logoXimbalGo = require('../../../assets/icon.png');
const width = 100;
const height = 100

const IncioSesionScreen = ({ navigation }: Props) => {
    const [correo, setCorreo] = useState("");
    const [contrasenia, setContrasenia] = useState("");

    const mostrarToast = (titulo: string) => {
        ToastAndroid.show(titulo,
            ToastAndroid.SHORT
        );

    };
    return (
        <SafeAreaView style={styles.statusBAR} edges={['top']}>
            <StatusBar style="light" />
            <View style={styles.pantalla}>
                <KeyboardAwareScroll contentContainerStyle={styles.scrollContent}>
                    <View style={styles.imagen}>
                        <Image
                            source={logoXimbalGo}
                            style={[StyleSheet.absoluteFill, { width, height }]}
                            resizeMode="cover"
                        />
                    </View>
                    <View style={styles.contentText}>
                        <AppText weight="bold" style={styles.text}>Bienvenido de nuevo</AppText>
                    </View>
                    <View style={styles.contenedor}>
                        <TextInputField
                            label="Correo electronico"
                            value={correo}
                            placeholder="Escribe tu correo..."
                            onChangeText={setCorreo}
                            icono="email"
                        />
                        <TextInputField
                            label="Contraseña"
                            value={contrasenia}
                            placeholder="Escribe tu contraseña..."
                            onChangeText={setContrasenia}
                            icono="lock"
                            secureTextEntry
                        />
                        <View style={styles.contentOlviContrasnia}>
                            <Pressable
                                onPress={() => navigation.navigate('RecuperarContrasenia')}
                            >
                                <AppText style={styles.textOlviContrasnia}>¿Olvidaste tu contraseña?</AppText>
                            </Pressable>
                        </View>

                        <View style={styles.contenBoton}>
                            <Button
                                titulo="Iniciar sesion "
                                onPress={() => mostrarToast("Iniciando sesion...")}
                            />
                        </View>

                    </View>
                    <View style={styles.contentOpciones}>
                        <AppText style={styles.noCuenta}>¿No tienes una cuenta?</AppText>
                        <Pressable onPress={() => navigation.navigate('SeleccionRol')}>
                            <AppText weight="bold" style={styles.registrarse}>Registrate</AppText>
                        </Pressable>
                    </View>

                </KeyboardAwareScroll>
                <BottomWave />
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
    imagen: {
        marginTop: 80,
        marginLeft: 150,
    },
    contentText: {
        marginTop: 100,
        justifyContent: "center",
        alignItems: "center",
    },
    text: {
        fontSize: 25,
    },
    contenedor: {
        marginTop: 10,
        justifyContent: "center",
        alignItems: "stretch",
        paddingVertical: 20,
        margin: 20,
        backgroundColor: Colors.onPrimary,
        borderColor: Colors.onPrimary,
        borderWidth: 1,
        borderRadius: 20,
        elevation: 2,
    },
    contentOlviContrasnia: {
        alignItems: "flex-end",
        marginRight: 10,
    },
    textOlviContrasnia: {
        color: Colors.primary,
        fontSize: 15,
    },
    contenBoton: {
        margin: 10,
    },
    contentOpciones: {
        margin: 1,
        flexDirection: "row",
        justifyContent: "center",
    },
    noCuenta:{
        fontSize: 15
    },
    registrarse: {
        color: Colors.primary,
        marginLeft: 9,
        fontSize: 15,
    }
});

export default IncioSesionScreen;
