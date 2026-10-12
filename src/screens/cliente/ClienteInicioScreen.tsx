import { SafeAreaView } from "react-native-safe-area-context";
import { View, StyleSheet, Pressable } from "react-native";
import AppText from "../../components/AppText";
import { StatusBar } from "expo-status-bar";
import Colors from "../../theme/colors";
import UserHeader from "../../components/UserHeader";
import { ToastMessage } from "../../components/ToastMessaje";
import KeyboardAwareScroll from "../../components/KeyboardAwareScroll";
import SelectInput from "../../components/SelectInput";
import { useState } from "react";
import BottomSheet from "../../components/BottomSheet";
import Button from "../../components/Button";
import Divider from "../../components/Divider";
import OptionList from "../../components/OptionList";
import { BottomTabBar, BottomTabId } from "../../components/BottomTabBar";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { ClienteStackParamList } from "../../navigation/types";
import { Icono, IconoFontAwesome6 } from "../../components/Icono";
import TaxiCard from "../../components/TaxiCard";
import Card from "../../components/Card";
import ParadaItem from "../../components/ParadaItem";

const origenes = [
    { id: '1', titulo: 'Tekax' },
    { id: '2', titulo: 'Akil' },
    { id: '3', titulo: 'Ticul' },
];

const destinos = [
    { id: '1', titulo: 'Tekax' },
    { id: '2', titulo: 'Oxkutzcab' },
    { id: '3', titulo: 'Peto' },
    { id: '4', titulo: 'Ticul' },
];

type SelectorActivo = "origen" | "destino" | null;

const handlePressTab = (tab: BottomTabId) => {
    switch (tab) {
        case 'inicio':
            break;
        case 'rutas':
            ToastMessage.show("Rutas");
            break;
        case 'reservaciones':
            ToastMessage.show("Reservaciones");
            break;
    }

};

type Props = NativeStackScreenProps<ClienteStackParamList, 'ClienteInicio'>;

const ClienteInicioScreen = ({ navigation }: Props) => {
    const [origen, setOrigen] = useState("");
    const [destino, setDestino] = useState("");
    const [selectorActivo, setSelectorActivo] = useState<SelectorActivo>(null);
    return (
        <SafeAreaView style={styles.statusBar} edges={['top', 'bottom']}>
            <StatusBar style="light" />
            <View style={styles.pantalla}>
                <KeyboardAwareScroll contentContainerStyle={styles.scrollContent}>
                    <UserHeader
                        nombre="Carlos"
                        inicial="C"
                        saludo="Buenas tardes"
                        onPress={() => ToastMessage.show("Mi perfil")}
                        backgroundColor={Colors.primary}
                        avatarBackground={Colors.primaryContainer}
                        avatarTextColor={Colors.secondary}
                        saludoTextColor={Colors.white}
                        buenasTextColor={Colors.white}
                    />
                    <View style={styles.contentEncabezado}>
                        <View style={styles.icono}>
                            <IconoFontAwesome6 nombre="personWalkingLuggage" tamanio={25} />
                        </View>
                        <View style={styles.textoEncabezado}>
                            <AppText weight="semibold" style={styles.titulo}>Tu viaje</AppText>
                            <AppText style={styles.subtitulo}>Elige tu origen y destino</AppText>
                        </View>
                    </View>

                    <Card>
                        <SelectInput
                            label="Origen"
                            value={origen}
                            placeholder="Seleccione el origen"
                            onPress={() => setSelectorActivo("origen")}
                            active={selectorActivo === "origen"}
                            iconLeft="locationHistory"
                            iconRight="ArrowDown"
                        />
                        <SelectInput
                            label="Destino"
                            value={destino}
                            placeholder="Seleccione el destino"
                            onPress={() => setSelectorActivo("destino")}
                            active={selectorActivo === "destino"}
                            iconLeft="locationOn"
                            iconRight="ArrowDown"
                        />
                    </Card>
                    {/**ButtomSheet para origen */}
                    <BottomSheet
                        visible={selectorActivo === "origen"}
                        onClose={() => setSelectorActivo(null)}
                    >
                        <View>
                            <AppText style={styles.tituloItems}>Elige tu origen</AppText>
                            <OptionList
                                data={origenes}
                                onSelect={setOrigen}
                                onClose={() => setSelectorActivo(null)}
                            />

                            <Button
                                titulo="Mi ubicacion actual"
                                onPress={() => {
                                    setOrigen("Mi ubicacion actual");
                                    setSelectorActivo(null);
                                }}
                            />

                        </View>
                    </BottomSheet>

                    {/**ButtomSheet para destino */}
                    <BottomSheet
                        visible={selectorActivo === "destino"}
                        onClose={() => setSelectorActivo(null)}
                    >
                        <View>
                            <AppText style={styles.tituloItems}>Elige tu destino</AppText>
                            <OptionList
                                data={destinos}
                                onSelect={setDestino}
                                onClose={() => setSelectorActivo(null)}
                            />

                        </View>
                    </BottomSheet>
                    <View style={styles.conteTaxisCerca}>
                        <Icono nombre="locationHistory" tamanio={25} color={Colors.primary} />
                        <AppText style={styles.textTaxis}> Taxis cerca de ti</AppText>
                        <Pressable onPress={() => ToastMessage.show("Ver todo")}>
                            <AppText style={styles.textVerTaxis}>Ver todo</AppText>
                        </Pressable>
                        <Icono nombre="ArrowRight" tamanio={25} color={Colors.outlineVariant} />
                    </View>
                    <Card>
                        <TaxiCard nombre="XFT-980" distancia="2.5 km" asientos={3} />
                        <TaxiCard nombre="KLP-010" distancia="1.4 km" asientos={0} lleno />
                    </Card>
                    <View style={styles.conteParaderoCerca}>
                        <Icono nombre="business" tamanio={22} color={Colors.primary} />
                        <AppText style={styles.textParadero}> Paraderos cercanos a ti</AppText>
                    </View>
                    <Card>
                        <ParadaItem nombre="ITSSY" descripcion="Escuela" onPress={() => ToastMessage.show("Ittsy")}/>
                        <ParadaItem nombre="Centro" descripcion="Centro de oxcutzcab" onPress={() => ToastMessage.show("Centro")}/>
                    </Card>
                </KeyboardAwareScroll>
            </View>
            <BottomTabBar activeTab="inicio" onPressTab={handlePressTab} />
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    statusBar: {
        backgroundColor: Colors.primary,
        flex: 1,
    },
    pantalla: {
        backgroundColor: Colors.surface,
        flex: 1,
    },
    scrollContent: {
        paddingBottom: 100,
    },
    contentEncabezado: {
        marginLeft: 10,
        marginTop: 20,
        flexDirection: "row",
        alignItems: "center",
        marginHorizontal: 24,
    },
    textoEncabezado: {
        marginLeft: 12,
    },
    icono: {
        width: 48,
        height: 48,
        borderRadius: 20,
        justifyContent: "center",
        alignItems: "center",
        shadowOpacity: 0.12,
        backgroundColor: Colors.primaryContainer,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 3 },
    },
    titulo: {
        fontSize: 20,
    },
    subtitulo: {
        fontSize: 15,
        color: Colors.outline,
    },
    tituloItems: {
        textAlign: "center",
        fontSize: 20,
        marginBottom: 12,
    },
    conteTaxisCerca: {
        flexDirection: "row",
        margin: 10,
    },
    textTaxis: {
        fontSize: 15,
    },
    textVerTaxis: {
        color: Colors.primary,
        marginLeft: 150,
        fontSize: 15,

    },
    conteParaderoCerca: {
        flexDirection: "row",
        margin: 10,
    },
    textParadero: {
        fontSize: 15,
    },
});

export default ClienteInicioScreen;