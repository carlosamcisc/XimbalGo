import Button from "../../components/Button";
import OpcionRol from "../../components/OpcionRol";
import { NombreIcono } from "../../components/Icono";
import { View, Text, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useState } from "react";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { AuthStackParamList, Rol } from "../../navigation/types";
import Colors from "../../theme/colors";
import { StatusBar } from "expo-status-bar";
import KeyboardAwareScroll from "../../components/KeyboardAwareScroll";
import AppText from "../../components/AppText";
import BottomWave from "../../components/BottomWave";
type Props = NativeStackScreenProps<AuthStackParamList, 'SeleccionRol'>;

//opciones de rol que puede elegir el usuario al registrarse
const OPCIONES_ROL: { rol: Rol; icono: NombreIcono; titulo: string; descripcion: string }[] = [
    {
        rol: 'cliente',
        icono: 'person',
        titulo: 'Cliente',
        descripcion: 'Visualizacion de rutas de transporte',
    },
    {
        rol: 'taxista',
        icono: 'localTaxi',
        titulo: 'Taxista',
        descripcion: 'Ofrece viajes y administra tus rutas',
    },
    {
        rol: 'administrador',
        icono: 'adminPanelSettings',
        titulo: 'Administrador',
        descripcion: 'Gestiona rutas, unidades y usuarios',
    },
];

const SeleccionRolScreen = ({ navigation }: Props) => {
    const [rolSeleccionado, setRolSeleccionado] = useState<Rol | null>(null);

    const continuar = () => {
        if (!rolSeleccionado) return;
        navigation.navigate('Registro', { rol: rolSeleccionado });
    };

    return (
        <SafeAreaView style={styles.statusBAR} edges={['top', 'bottom']}>
            <StatusBar style="light" />
            <View style={styles.pantalla}>
                <KeyboardAwareScroll contentContainerStyle={styles.scrollContent}>
                    <View style={styles.contentPasos}>
                        <AppText weight="bold" style={styles.textPasos}>Paso </AppText>
                        <AppText weight="bold" style={styles.textPasoNumero}> 1</AppText>
                        <AppText weight="bold" style={styles.textPasos}> de 2</AppText>
                    </View>
                    <View style={styles.contentEncabezado}>
                        <AppText weight="bold" style={styles.encabezado}>¿Como quieres usar Ximbal Go</AppText>
                    </View>
                    <View style={styles.contentOpciones}>
                        {OPCIONES_ROL.map((opcion) => {
                            const seleccionado = rolSeleccionado === opcion.rol;
                            return (
                                <OpcionRol
                                    key={opcion.rol}
                                    onPress={() => setRolSeleccionado(opcion.rol)}
                                    icono={opcion.icono}
                                    titulo={opcion.titulo}
                                    descripcion={opcion.descripcion}
                                    seleccionado={seleccionado}
                                />
                            );
                        })}
                    </View>
                    <View style={styles.contentBoton}>
                        <Button
                            titulo="Continuar   "
                            onPress={continuar}
                            icono="arrowForward"
                            disabled={!rolSeleccionado}
                        />
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
    contentEncabezado: {
        alignItems: "center",
        marginTop: 30,
        marginBottom: 30,
        paddingHorizontal: 24,
    },
    encabezado: {
        fontSize: 20,
        textAlign: "center",
    },
    contentPasos: {
        marginTop: 20,
        flexDirection: "row",
        justifyContent: "flex-end",
        marginRight: 20,
    },
    textPasos: {
        fontSize: 17,
    },
    textPasoNumero:{
        fontSize: 17,
        color: Colors.primary
    },
    contentOpciones: {
        paddingHorizontal: 20,
    },
    contentBoton: {
        paddingHorizontal: 20,
        marginTop: "auto",
        marginBottom: 20,
    },

});

export default SeleccionRolScreen;
