import TextInputField from "../../components/TextInputField";
import Button from "../../components/Button";
import {View, Text, StyleSheet, Image, Pressable, Alert, ToastAndroid} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useState } from "react";
import Colors from "../../theme/colors";

const logoXimbalGo = require('../../../assets/icon.png');
const width = 100;
const height = 100

const IncioSesionScreen = () =>{
    const [correo, setCorreo] = useState("");
    const [contrasenia, setContrasenia] = useState("");

    const mostrarToast = (titulo: string) =>{
        ToastAndroid.show(titulo,
            ToastAndroid.SHORT
        );

    };
    return (
        <SafeAreaView style={styles.pantalla}>
            <View style={styles.imagen}>
                <Image
                    source={logoXimbalGo}
                    style={[StyleSheet.absoluteFill, {width, height}]}
                    resizeMode="cover"
                />
            </View>
            <View style={styles.contentText}>
                <Text style={styles.text}>Bienvenido de nuevo</Text>
            </View>
            <View style={styles.contenedor}>
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
                />
                <View style={styles.contentOlviContrasnia}>
                    <Pressable
                    onPress={() => Alert.alert('Estara disponible pronto')}
                    >
                        <Text style={styles.textOlviContrasnia}>¿Olvidaste tu contraseña?</Text>
                    </Pressable>
                </View>

                <View style={styles.contenBoton}>
                    <Button
                    titulo="Iniciar sesion "
                    onPress={() => mostrarToast("Iniciando sesion...")}
                    icono="login"
                    />
                </View>
            
            </View>
            <View style={styles.contentOpciones}>
                <Text>¿Ya tienes una cuenta?</Text>
                <Text style={styles.registrarse}>Registrate</Text>
            </View>
 
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    pantalla:{
        flex: 1,
        backgroundColor: Colors.surface,
    },
    imagen:{
        marginLeft: 150,
    },
    contentText:{
        marginTop: 100,
        justifyContent: "center",
        alignItems: "center",
    },
    text:{
        color: Colors.dark,
        fontSize: 25,
        fontWeight: "bold",
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
    contentOlviContrasnia:{
        alignItems: "flex-end",
        marginRight: 10,
    },
    textOlviContrasnia:{
        color: Colors.primary,
        fontWeight: "bold",
    },
    contenBoton:{
        margin: 10,
    },
    contentOpciones:{
        margin: 1,
        flexDirection: "row",
        justifyContent: "center",
    },
    registrarse:{
        color: Colors.primary,
        marginLeft: 9,
        fontWeight: "bold",
    }
});

export default IncioSesionScreen;