import TextInputField from "../../components/TextInputField";
import Button from "../../components/Button";
import { Icono } from "../../components/Icono";
import {View, Text, StyleSheet, Pressable, Alert, ToastAndroid} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useState } from "react";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { AuthStackParamList, Rol } from "../../navigation/types";
import Colors from "../../theme/colors";
import { StatusBar } from "expo-status-bar";

type Props = NativeStackScreenProps<AuthStackParamList, 'Registro'>;

const ROL_LABELS: Record<Rol, string> = {
    cliente: 'Cliente',
    taxista: 'Taxista',
    administrador: 'Administrador',
};

const RegistroScreen = ({navigation, route}: Props) =>{
    const {rol} = route.params;

    const [nombre, setNombre] = useState("");
    const [correo, setCorreo] = useState("");
    const [contrasenia, setContrasenia] = useState("");
    const [confirmarContrasenia, setConfirmarContrasenia] = useState("");

    const mostrarToast = (titulo: string) =>{
        ToastAndroid.show(titulo,
            ToastAndroid.SHORT
        );
    };

    const handleRegistro = () =>{
        if(!nombre || !correo || !contrasenia || !confirmarContrasenia){
            Alert.alert('Completa todos los campos');
            return;
        }
        if(contrasenia !== confirmarContrasenia){
            Alert.alert('Las contraseñas no coinciden');
            return;
        }
        mostrarToast("Creando tu cuenta...");
        navigation.navigate('InicioSesion');
    };

    return (
        <SafeAreaView style={styles.pantalla}>

            <View style={styles.contentNavegacion}>
                <Pressable style={styles.botonAtras} onPress={() => navigation.goBack()}>
                  <Icono nombre="arrowBack" tamanio={26} color={Colors.dark}/>
                </Pressable>
                <View style={styles.contTextPasos}>
                    <Text style={styles.textPasos}>Paso 2 de 2</Text>
                </View>
            </View>
            <View style={styles.contentEncabezado}>
                <Text style={styles.encabezado}>Crea tu cuenta</Text>
                <Text style={styles.subEncabezado}>Te estas registrando como {ROL_LABELS[rol]}</Text>
            </View>
            <View style={styles.contenedor}>
                <TextInputField
                    label="Nombre completo"
                    value={nombre}
                    placeholder="Escribe tu nombre..."
                    onChangeText={setNombre}
                />
                <TextInputField
                    label="Correo electronico"
                    value={correo}
                    placeholder="Escribe tu correo..."
                    onChangeText={setCorreo}
                />
                <TextInputField
                    label="Contraseña"
                    value={contrasenia}
                    placeholder="Escribe tu contraseña..."
                    onChangeText={setContrasenia}
                    secureTextEntry
                />
                <TextInputField
                    label="Confirmar contraseña"
                    value={confirmarContrasenia}
                    placeholder="Vuelve a escribir tu contraseña..."
                    onChangeText={setConfirmarContrasenia}
                    secureTextEntry
                />
                <View style={styles.contenBoton}>
                    <Button
                    titulo="Registrarse"
                    onPress={handleRegistro}
                    />
                </View>
            </View>
            <View style={styles.contentOpciones}>
                <Text>¿Ya tienes una cuenta?</Text>
                <Pressable onPress={() => navigation.navigate('InicioSesion')}>
                    <Text style={styles.iniciarSesion}>Inicia sesion</Text>
                </Pressable>
            </View>

        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    pantalla:{
        flex: 1,
        backgroundColor: Colors.surface,
    },
    contentNavegacion:{
        flexDirection: "row",
    },
    contTextPasos:{
        alignItems: "flex-end",
        marginTop: 13,
        marginLeft: 240,
    },
    textPasos:{
        color: Colors.dark,
        fontSize: 17,
        fontWeight: "bold",
    },
    botonAtras:{
        marginTop: 10,
        marginLeft: 10,
        alignSelf: "flex-start",
        padding: 6,
    },
    contentEncabezado:{
        marginTop: 10,
        alignItems: "center",
        paddingHorizontal: 24,
    },
    encabezado:{
        color: Colors.dark,
        fontSize: 25,
        fontWeight: "bold",
    },
    subEncabezado:{
        color: Colors.onSurfaceVariant,
        fontSize: 14,
        marginTop: 6,
    },
    contenedor:{
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
    contenBoton:{
        margin: 10,
    },
    contentOpciones:{
        margin: 1,
        flexDirection: "row",
        justifyContent: "center",
    },
    iniciarSesion:{
        color: Colors.primary,
        marginLeft: 9,
        fontWeight: "bold",
    },
});

export default RegistroScreen;
