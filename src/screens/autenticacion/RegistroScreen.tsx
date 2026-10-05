import { useState } from "react";
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
import type { AuthStackParamList, Rol } from "../../navigation/types";
import { registrarUsuario } from "../../infrastructure/supabase/auth/auth.service";
import Colors from "../../theme/colors";

type Props = NativeStackScreenProps<AuthStackParamList, "Registro">;

const ROL_LABELS: Record<Rol, string> = {
    cliente: "Cliente",
    taxista: "Taxista",
    administrador: "Administrador",
};

const RegistroScreen = ({ navigation, route }: Props) => {
    const { rol } = route.params;
    const [nombres, setNombres] = useState("");
    const [apellidos, setApellidos] = useState("");
    const [correo, setCorreo] = useState("");
    const [telefono, setTelefono] = useState("");
    const [contrasenia, setContrasenia] = useState("");
    const [confirmarContrasenia, setConfirmarContrasenia] = useState("");
    const [edad, setEdad] = useState("");
    const [direccion, setDireccion] = useState("");
    const [puntoPartida, setPuntoPartida] = useState("");
    const [puntoDestino, setPuntoDestino] = useState("");
    const [horarioTrabajo, setHorarioTrabajo] = useState("");
    const [precioRuta, setPrecioRuta] = useState("");
    const [cargando, setCargando] = useState(false);

    const handleRegistro = async () => {
        if (rol === "administrador") {
            Alert.alert(
                "Registro no disponible",
                "Las cuentas de administrador no se crean desde la aplicación."
            );
            return;
        }

        const correoLimpio = correo.trim();
        if (
            !nombres.trim() ||
            !apellidos.trim() ||
            !correoLimpio ||
            !telefono.trim() ||
            !contrasenia ||
            !confirmarContrasenia
        ) {
            Alert.alert("Completa todos los campos obligatorios");
            return;
        }

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correoLimpio)) {
            Alert.alert("Correo inválido", "Ingresa un correo electrónico válido.");
            return;
        }

        if (contrasenia !== confirmarContrasenia) {
            Alert.alert("Las contraseñas no coinciden");
            return;
        }

        const edadNumero = edad.trim() ? Number(edad) : undefined;
        if (
            rol === "cliente" &&
            edadNumero !== undefined &&
            (!Number.isInteger(edadNumero) || edadNumero < 1)
        ) {
            Alert.alert("Edad inválida", "Ingresa una edad válida.");
            return;
        }

        const precioNumero = precioRuta.trim() ? Number(precioRuta) : undefined;
        if (
            rol === "taxista" &&
            precioNumero !== undefined &&
            (!Number.isFinite(precioNumero) || precioNumero < 0)
        ) {
            Alert.alert("Precio inválido", "Ingresa un precio válido.");
            return;
        }

        setCargando(true);
        try {
            await registrarUsuario({
                correo: correoLimpio,
                password: contrasenia,
                nombres: nombres.trim(),
                apellidos: apellidos.trim(),
                telefono: telefono.trim(),
                rol,
                ...(rol === "cliente" && edadNumero !== undefined
                    ? { edad: edadNumero }
                    : {}),
                ...(direccion.trim() ? { direccion: direccion.trim() } : {}),
                ...(rol === "taxista" && puntoPartida.trim()
                    ? { puntoPartida: puntoPartida.trim() }
                    : {}),
                ...(rol === "taxista" && puntoDestino.trim()
                    ? { puntoDestino: puntoDestino.trim() }
                    : {}),
                ...(rol === "taxista" && horarioTrabajo.trim()
                    ? { horarioTrabajo: horarioTrabajo.trim() }
                    : {}),
                ...(rol === "taxista" && precioNumero !== undefined
                    ? { precioRuta: precioNumero }
                    : {}),
            });

            Alert.alert(
                "Cuenta creada",
                "Tu registro fue exitoso. Ya puedes iniciar sesión.",
                [
                    {
                        text: "Ir a iniciar sesión",
                        onPress: () => navigation.navigate("InicioSesion"),
                    },
                ]
            );
        } catch (error: unknown) {
            const mensaje =
                error instanceof Error
                    ? error.message
                    : "Intenta nuevamente en unos momentos.";
            Alert.alert("No se pudo crear la cuenta", mensaje);
        } finally {
            setCargando(false);
        }
    };

    return (
        <SafeAreaView style={styles.pantalla}>
            <StatusBar style="dark" />
            <KeyboardAwareScroll contentContainerStyle={styles.scrollContent}>
                <View style={styles.contentNavegacion}>
                    <Pressable
                        style={styles.botonAtras}
                        onPress={() => navigation.goBack()}
                        accessibilityRole="button"
                        accessibilityLabel="Regresar a selección de rol"
                    >
                        <Icono nombre="arrowBack" tamanio={26} color={Colors.dark} />
                    </Pressable>
                    <AppText weight="bold" style={styles.textPasos}>
                        Paso 2 de 2
                    </AppText>
                </View>

                <View style={styles.contentEncabezado}>
                    <AppText weight="bold" style={styles.encabezado}>
                        Crea tu cuenta
                    </AppText>
                    <AppText style={styles.subEncabezado}>
                        Te estás registrando como {ROL_LABELS[rol]}
                    </AppText>
                </View>

                <View style={styles.contenedor}>
                    <TextInputField
                        label="Nombre(s) *"
                        value={nombres}
                        placeholder="Escribe tu nombre..."
                        onChangeText={setNombres}
                        autoCapitalize="words"
                    />
                    <TextInputField
                        label="Apellidos *"
                        value={apellidos}
                        placeholder="Escribe tus apellidos..."
                        onChangeText={setApellidos}
                        autoCapitalize="words"
                    />
                    <TextInputField
                        label="Correo electrónico *"
                        value={correo}
                        placeholder="Escribe tu correo..."
                        onChangeText={setCorreo}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        icono="email"
                    />
                    <TextInputField
                        label="Teléfono *"
                        value={telefono}
                        placeholder="Escribe tu teléfono..."
                        onChangeText={setTelefono}
                        keyboardType="phone-pad"
                    />

                    {rol === "cliente" && (
                        <TextInputField
                            label="Edad (opcional)"
                            value={edad}
                            placeholder="Escribe tu edad..."
                            onChangeText={setEdad}
                            keyboardType="number-pad"
                        />
                    )}

                    <TextInputField
                        label="Dirección (opcional)"
                        value={direccion}
                        placeholder="Escribe tu dirección..."
                        onChangeText={setDireccion}
                        autoCapitalize="sentences"
                    />

                    {rol === "taxista" && (
                        <>
                            <AppText weight="bold" style={styles.subtituloCampos}>
                                Datos de tu servicio (opcionales)
                            </AppText>
                            <TextInputField
                                label="Punto de partida"
                                value={puntoPartida}
                                placeholder="Ej. Centro de la ciudad"
                                onChangeText={setPuntoPartida}
                                autoCapitalize="sentences"
                            />
                            <TextInputField
                                label="Punto de destino"
                                value={puntoDestino}
                                placeholder="Ej. Terminal de autobuses"
                                onChangeText={setPuntoDestino}
                                autoCapitalize="sentences"
                            />
                            <TextInputField
                                label="Horario de trabajo"
                                value={horarioTrabajo}
                                placeholder="Ej. Lunes a viernes, 8:00 a 17:00"
                                onChangeText={setHorarioTrabajo}
                                autoCapitalize="sentences"
                            />
                            <TextInputField
                                label="Precio de la ruta"
                                value={precioRuta}
                                placeholder="Escribe el precio..."
                                onChangeText={setPrecioRuta}
                                keyboardType="decimal-pad"
                            />
                        </>
                    )}

                    <TextInputField
                        label="Contraseña *"
                        value={contrasenia}
                        placeholder="Crea una contraseña..."
                        onChangeText={setContrasenia}
                        secureTextEntry
                        autoCapitalize="none"
                        icono="lock"
                    />
                    <TextInputField
                        label="Confirmar contraseña *"
                        value={confirmarContrasenia}
                        placeholder="Escribe de nuevo tu contraseña..."
                        onChangeText={setConfirmarContrasenia}
                        secureTextEntry
                        autoCapitalize="none"
                        icono="lock"
                    />

                    <View style={styles.contenBoton}>
                        <Button
                            titulo={cargando ? "Creando cuenta..." : "Registrarse"}
                            onPress={handleRegistro}
                            disabled={cargando}
                        />
                    </View>
                </View>

                <View style={styles.contentOpciones}>
                    <AppText>¿Ya tienes una cuenta?</AppText>
                    <Pressable onPress={() => navigation.navigate("InicioSesion")}>
                        <AppText weight="bold" style={styles.iniciarSesion}>
                            Inicia sesión
                        </AppText>
                    </Pressable>
                </View>
            </KeyboardAwareScroll>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    pantalla: {
        flex: 1,
        backgroundColor: Colors.surface,
    },
    scrollContent: {
        flexGrow: 1,
        paddingBottom: 32,
    },
    contentNavegacion: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingRight: 20,
    },
    botonAtras: {
        marginTop: 10,
        marginLeft: 10,
        alignSelf: "flex-start",
        padding: 6,
    },
    textPasos: {
        color: Colors.dark,
        fontSize: 17,
    },
    contentEncabezado: {
        marginTop: 10,
        alignItems: "center",
        paddingHorizontal: 24,
    },
    encabezado: {
        color: Colors.dark,
        fontSize: 25,
    },
    subEncabezado: {
        color: Colors.onSurfaceVariant,
        fontSize: 14,
        marginTop: 6,
    },
    contenedor: {
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
    subtituloCampos: {
        color: Colors.dark,
        fontSize: 16,
        marginHorizontal: 20,
        marginTop: 8,
    },
    contenBoton: {
        margin: 10,
    },
    contentOpciones: {
        margin: 1,
        flexDirection: "row",
        justifyContent: "center",
    },
    iniciarSesion: {
        color: Colors.primary,
        marginLeft: 9,
    },
});

export default RegistroScreen;
