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
import type { AuthStackParamList, Rol } from "../../navigation/types";
import { registrarUsuario } from "../../infrastructure/supabase/auth/auth.service";
import type { DatosRegistro, RolRegistrable } from "../../infrastructure/supabase/auth/auth.types";
import { obtenerCatalogoRutas } from "../../infrastructure/supabase/repositories/rutas.repository";
import SelectInput from "../../components/SelectInput";
import BottomSheet from "../../components/BottomSheet";
import OptionList from "../../components/OptionList";
import type { RutaCatalogo } from "../../modules/cliente/rutas";
import Colors from "../../theme/colors";

type Props = NativeStackScreenProps<AuthStackParamList, "Registro">;

const ROL_LABELS: Record<Rol, string> = {
    cliente: "Cliente",
    taxista: "Taxista",
    administrador: "Administrador",
};

// Límites de las columnas en Supabase: si un dato no cabe, `handle_new_user`
// falla y no se crea la cuenta.
const LARGO_NOMBRE = 100; // nombres, apellidos: varchar(100)
const LARGO_TELEFONO = 20; // telefono, numero_telefono: varchar(20)
const LARGO_HORARIO = 100; // taxistas.horario_trabajo: varchar(100)
const LARGO_MINIMO_CONTRASENIA = 6; // auth.minimum_password_length
const EDAD_MAXIMA = 120;

interface Formulario {
    rol: RolRegistrable;
    nombres: string;
    apellidos: string;
    correo: string;
    telefono: string;
    contrasenia: string;
    confirmarContrasenia: string;
    edad: string;
    direccion: string;
    ruta: RutaCatalogo | null;
    horarioTrabajo: string;
    precioRuta: string;
}

/** Devuelve los datos listos para registrar, o un mensaje de error. */
function validar(formulario: Formulario): DatosRegistro | string {
    const { rol, contrasenia } = formulario;
    const nombres = formulario.nombres.trim();
    const apellidos = formulario.apellidos.trim();
    const correo = formulario.correo.trim();
    const telefono = formulario.telefono.trim();

    if (!nombres || !apellidos || !correo || !telefono || !contrasenia) {
        return "Completa todos los campos obligatorios.";
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
        return "Ingresa un correo electrónico válido.";
    }
    if (!/^\+?[\d\s-]{7,19}$/.test(telefono)) {
        return "Escribe un teléfono válido (solo números, espacios o guiones).";
    }
    // El inicio de sesión quita los espacios de los extremos de la contraseña.
    if (contrasenia !== contrasenia.trim()) {
        return "La contraseña no puede empezar ni terminar con espacios.";
    }
    if (contrasenia.length < LARGO_MINIMO_CONTRASENIA) {
        return `La contraseña debe tener al menos ${LARGO_MINIMO_CONTRASENIA} caracteres.`;
    }
    if (contrasenia !== formulario.confirmarContrasenia) {
        return "Las contraseñas no coinciden.";
    }

    const datos: DatosRegistro = {
        correo,
        password: contrasenia,
        nombres,
        apellidos,
        telefono,
        rol,
        ...(formulario.direccion.trim() ? { direccion: formulario.direccion.trim() } : {}),
    };

    if (rol === "cliente") {
        const edadTexto = formulario.edad.trim();
        if (edadTexto) {
            const edad = Number(edadTexto);
            if (!/^\d{1,3}$/.test(edadTexto) || edad < 1 || edad > EDAD_MAXIMA) {
                return "Escribe una edad válida.";
            }
            datos.edad = edad;
        }
        return datos;
    }

    // Sin ruta el taxista no aparece a los clientes ni puede iniciar servicio.
    if (!formulario.ruta) {
        return "Selecciona la ruta en la que trabajas.";
    }
    datos.rutaId = formulario.ruta.id;

    if (formulario.horarioTrabajo.trim()) {
        datos.horarioTrabajo = formulario.horarioTrabajo.trim();
    }

    // Algunos teclados escriben la coma como separador decimal.
    const precioTexto = formulario.precioRuta.trim().replace(",", ".");
    if (precioTexto) {
        // Igual que `taxistas.precio_ruta` en `handle_new_user`: decimal(10, 2).
        if (!/^\d{1,8}(\.\d{1,2})?$/.test(precioTexto)) {
            return "Escribe un precio válido, con hasta 2 decimales.";
        }
        datos.precioRuta = Number(precioTexto);
    }

    return datos;
}

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
    const [rutas, setRutas] = useState<RutaCatalogo[]>([]);
    const [cargandoRutas, setCargandoRutas] = useState(rol === "taxista");
    const [errorRutas, setErrorRutas] = useState(false);
    const [ruta, setRuta] = useState<RutaCatalogo | null>(null);
    const [selectorRutaVisible, setSelectorRutaVisible] = useState(false);
    const [horarioTrabajo, setHorarioTrabajo] = useState("");
    const [precioRuta, setPrecioRuta] = useState("");
    const [cargando, setCargando] = useState(false);

    const cargarRutas = async () => {
        setCargandoRutas(true);
        setErrorRutas(false);
        try {
            setRutas(await obtenerCatalogoRutas());
        } catch {
            setErrorRutas(true);
        } finally {
            setCargandoRutas(false);
        }
    };

    useEffect(() => {
        if (rol === "taxista") {
            void cargarRutas();
        }
    }, [rol]);

    const seleccionarRuta = (seleccionada: RutaCatalogo) => {
        setRuta(seleccionada);
        // Sugiere la tarifa base; el taxista puede cambiarla.
        if (!precioRuta.trim()) {
            setPrecioRuta(String(seleccionada.precioBase));
        }
    };

    const opcionesRutas = rutas.map((opcion) => ({
        ...opcion,
        titulo: `${opcion.nombre}\n${opcion.origen} → ${opcion.destino}`,
    }));
    const textoSinRutas = cargandoRutas
        ? "Cargando rutas..."
        : errorRutas
            ? "No se pudieron cargar las rutas."
            : "Todavía no hay rutas registradas.";

    const handleRegistro = async () => {
        const datos = validar({
            rol,
            nombres,
            apellidos,
            correo,
            telefono,
            contrasenia,
            confirmarContrasenia,
            edad,
            direccion,
            ruta,
            horarioTrabajo,
            precioRuta,
        });
        if (typeof datos === "string") {
            Alert.alert("Revisa tus datos", datos);
            return;
        }

        setCargando(true);
        try {
            await registrarUsuario(datos);

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
                        <Icono nombre="arrowBack" tamanio={26} color={Colors.black} />
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
                        maxLength={LARGO_NOMBRE}
                    />
                    <TextInputField
                        label="Apellidos *"
                        value={apellidos}
                        placeholder="Escribe tus apellidos..."
                        onChangeText={setApellidos}
                        autoCapitalize="words"
                        maxLength={LARGO_NOMBRE}
                    />
                    <TextInputField
                        label="Correo electrónico *"
                        value={correo}
                        placeholder="Escribe tu correo..."
                        onChangeText={setCorreo}
                        keyboardType="email-address"
                        autoCapitalize="none"
                    />
                    <TextInputField
                        label="Teléfono *"
                        value={telefono}
                        placeholder="Escribe tu teléfono..."
                        onChangeText={setTelefono}
                        keyboardType="phone-pad"
                        maxLength={LARGO_TELEFONO}
                    />

                    {rol === "cliente" && (
                        <TextInputField
                            label="Edad (opcional)"
                            value={edad}
                            placeholder="Escribe tu edad..."
                            onChangeText={setEdad}
                            keyboardType="number-pad"
                            maxLength={3}
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
                                Datos de tu servicio
                            </AppText>
                            <SelectInput
                                label="Ruta *"
                                value={ruta ? `${ruta.origen} → ${ruta.destino}` : ""}
                                placeholder={cargandoRutas ? "Cargando rutas..." : "Selecciona tu ruta"}
                                onPress={() => setSelectorRutaVisible(true)}
                                active={selectorRutaVisible}
                                iconLeft="map"
                                iconRight="ArrowDown"
                            />
                            {errorRutas && (
                                <Pressable
                                    onPress={() => void cargarRutas()}
                                    accessibilityRole="button"
                                    style={styles.reintentarRutas}
                                >
                                    <AppText weight="semibold" style={styles.textoReintentar}>
                                        No se pudieron cargar las rutas. Reintentar
                                    </AppText>
                                </Pressable>
                            )}
                            <BottomSheet
                                visible={selectorRutaVisible}
                                onClose={() => setSelectorRutaVisible(false)}
                            >
                                <View>
                                    <AppText weight="semibold" style={styles.tituloSelector}>
                                        Elige tu ruta
                                    </AppText>
                                    <OptionList
                                        data={opcionesRutas}
                                        style={styles.listaRutas}
                                        emptyText={textoSinRutas}
                                        onSelect={seleccionarRuta}
                                        onClose={() => setSelectorRutaVisible(false)}
                                    />
                                </View>
                            </BottomSheet>
                            <TextInputField
                                label="Horario de trabajo"
                                value={horarioTrabajo}
                                placeholder="Ej. Lunes a viernes, 8:00 a 17:00"
                                onChangeText={setHorarioTrabajo}
                                autoCapitalize="sentences"
                                maxLength={LARGO_HORARIO}
                            />
                            <TextInputField
                                label="Precio por pasajero"
                                value={precioRuta}
                                placeholder={ruta ? `Tarifa base: ${ruta.precioBase}` : "Escribe el precio..."}
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
        color: Colors.black,
        fontSize: 17,
    },
    contentEncabezado: {
        marginTop: 10,
        alignItems: "center",
        paddingHorizontal: 24,
    },
    encabezado: {
        color: Colors.black,
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
        color: Colors.black,
        fontSize: 16,
        marginHorizontal: 20,
        marginTop: 8,
    },
    contenBoton: {
        margin: 10,
    },
    reintentarRutas: {
        marginHorizontal: 20,
    },
    textoReintentar: {
        fontSize: 14,
        color: Colors.primary,
    },
    tituloSelector: {
        textAlign: "center",
        fontSize: 20,
        marginBottom: 12,
    },
    listaRutas: {
        maxHeight: 320,
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
