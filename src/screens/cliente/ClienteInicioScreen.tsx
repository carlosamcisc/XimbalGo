import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { BottomTabBar, type BottomTabId } from "../../components/BottomTabBar";
import UserHeader from "../../components/UserHeader";
import KeyBoardAwareScroll from "../../components/KeyboardAwareScroll";
import Card from "../../components/Card";
import SelectInput from "../../components/SelectInput";
import AppText from "../../components/AppText";
import Badge from "../../components/Badge";
import TaxiCard from "../../components/TaxiCard";
import ParadaItem from "../../components/ParadaItem";
import { Icono } from "../../components/Icono";
import Colors from "../../theme/colors";
import { ToastMessage } from "../../components/ToastMessaje";

const ClienteInicioScreen = () => {
    const nombre = "Carlos";
    const inicial = "C";
    const saludo = "¡Buenos dias!";

    const [origen, setOrigen] = useState("");
    const ubicaciones = [
        { label: "Tekax", value: "tekax" },
        { label: "Ticul", value: "ticul" },
        { label: "Akil", value: "akil" },
    ];
    const [destino, setDestino] = useState("");

    const handlePressTab = (tab: BottomTabId) => {
        switch (tab) {
            case "inicio":
                console.log("Inicio");
                break;
            case "rutas":
                ToastMessage.show("Rutas");
                break;
            case "reservaciones":
                ToastMessage.show("Reservaciones")
                break;
        }
    };

    return (
        <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
            <StatusBar style="dark" />
            <View style={styles.screen}>
                <KeyBoardAwareScroll contentContainerStyle={styles.scrollContent}>
                    <View style={styles.hero}>
                        <View style={styles.heroOrb} />
                        <UserHeader
                            nombre={nombre}
                            inicial={inicial}
                            saludo={saludo}
                            onPress={() => ToastMessage.show("Mi perfil")}
                            avatarBackground={Colors.white}
                            avatarTextColor={Colors.primary}
                            saludoTextColor={Colors.white}
                            buenasTextColor={Colors.brandSubtitle}
                        />
                        <View style={styles.heroCopy}>
                            <AppText weight="bold" style={styles.heroTitle}>
                                ¿Donde vas {`\n`}hoy?
                            </AppText>
                        </View>
                        <View style={styles.heroIcon} pointerEvents="none">
                            <Icono nombre="localTaxi" tamanio={46} color={Colors.white} />
                        </View>
                    </View>

                    <View style={styles.section}>
                        <View style={styles.sectionHeading}>
                            <View style={styles.sectionIcon}>
                                <Icono nombre="map" tamanio={20} color={Colors.primary} />
                            </View>
                            <View style={styles.sectionHeadingText}>
                                <AppText weight="bold" style={styles.sectionTitle}>
                                    Tu viaje
                                </AppText>
                                <AppText style={styles.sectionSubtitle}>
                                    Elige origen y destino
                                </AppText>
                            </View>
                        </View>
                        <Card style={styles.formCard}>
                            <SelectInput
                                label="Origen"
                                options={ubicaciones}
                                value={origen}
                                onChange={setOrigen}
                                placeholder="Mi ubicacion actual"
                                iconLeft="locationArrow"
                            />
                            <View style={styles.routeDivider}>
                                <View style={styles.routeLine} />
                                <View style={styles.routeDot} />
                            </View>
                            <SelectInput
                                label="Destino"
                                options={ubicaciones}
                                value={destino}
                                onChange={setDestino}
                                placeholder="Seleccionar destino"
                                iconLeft="locationDot"
                            />
                        </Card>
                    </View>

                    <View style={styles.section}>
                        <View style={styles.sectionHeading}>
                            <View style={styles.sectionIcon}>
                                <Icono nombre="localTaxi" tamanio={21} color={Colors.primary} />
                            </View>
                            <View style={styles.sectionHeadingText}>
                                <View style={styles.titleWithBadge}>
                                    <AppText weight="bold" style={styles.sectionTitle}>
                                        Taxis cerca de ti
                                    </AppText>
                                    <Badge
                                        value={3}
                                        size={23}
                                        backgroundColor={Colors.brandAccentContainer}
                                        textColor={Colors.brandAccentStrong}
                                    />
                                </View>
                                <AppText style={styles.sectionSubtitle}>
                                    Unidades disponibles ahora
                                </AppText>
                            </View>
                            <Pressable
                                style={styles.viewAllButton}
                                onPress={() => ToastMessage.show("Disponible proximamente")}
                                accessibilityRole="button"
                                accessibilityLabel="Ver todos los taxis"
                            >
                                <AppText weight="semibold" style={styles.viewAllText}>
                                    Ver todos
                                </AppText>
                                <Icono nombre="ArrowRight" tamanio={19} color={Colors.primary} />
                            </Pressable>
                        </View>
                        <Card style={styles.listCard}>
                            <TaxiCard nombre="Taxista - FLOP09" distancia="2 km" asientos={4} />
                            <TaxiCard nombre="Taxista - QLFM78" distancia="0 km" asientos={0} lleno />
                            <TaxiCard nombre="Taxista - KLPV00" distancia="1.5 km" asientos={1} />
                        </Card>
                    </View>

                    <View style={styles.section}>
                        <View style={styles.sectionHeading}>
                            <View style={styles.sectionIcon}>
                                <Icono nombre="business" tamanio={20} color={Colors.primary} />
                            </View>
                            <View style={styles.sectionHeadingText}>
                                <AppText weight="bold" style={styles.sectionTitle}>
                                    Paraderos cercanos
                                </AppText>
                                <AppText style={styles.sectionSubtitle}>
                                    Puntos de salida en tu zona
                                </AppText>
                            </View>
                        </View>
                        <Card style={styles.listCard}>
                            <ParadaItem nombre="Akil" descripcion="Parada de autobuses" onPress={() => ToastMessage.show("Disponible proximamente")}/>
                            <ParadaItem nombre="Oxkutzcab" descripcion="ITTSY" onPress={() => ToastMessage.show("Disonible proximante")}/>
                        </Card>
                    </View>
                </KeyBoardAwareScroll>
            </View>
            <BottomTabBar activeTab="inicio" onPressTab={handlePressTab} />
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: Colors.surface,
    },
    screen: {
        flex: 1,
        backgroundColor: Colors.surface,
    },
    scrollContent: {
        paddingBottom: 120,
    },
    hero: {
        position: "relative",
        overflow: "hidden",
        paddingBottom: 28,
        backgroundColor: Colors.brandDeep,
        borderBottomLeftRadius: 30,
        borderBottomRightRadius: 30,
    },
    heroOrb: {
        position: "absolute",
        width: 220,
        height: 220,
        right: -95,
        top: 30,
        borderRadius: 110,
        backgroundColor: Colors.brandOverlay,
    },
    heroCopy: {
        marginTop: 26,
        marginHorizontal: 24,
        paddingRight: 58,
    },
    eyebrow: {
        color: Colors.brandAccent,
        fontSize: 10,
        letterSpacing: 1.2,
        marginBottom: 8,
    },
    heroTitle: {
        color: Colors.white,
        fontSize: 31,
        lineHeight: 37,
    },
    heroSubtitle: {
        color: Colors.brandSubtitle,
        fontSize: 14,
        lineHeight: 20,
        marginTop: 8,
    },
    heroIcon: {
        position: "absolute",
        right: 24,
        bottom: 34,
        opacity: 0.8,
    },
    section: {
        marginTop: 22,
        paddingHorizontal: 16,
    },
    sectionHeading: {
        flexDirection: "row",
        alignItems: "center",
        marginHorizontal: 4,
        marginBottom: 10,
    },
    sectionIcon: {
        width: 42,
        height: 42,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 15,
        backgroundColor: Colors.brandSoft,
    },
    sectionHeadingText: {
        flex: 1,
        marginLeft: 11,
    },
    sectionTitle: {
        color: Colors.brandText,
        fontSize: 16,
    },
    sectionSubtitle: {
        color: Colors.onSurfaceVariant,
        fontSize: 12,
        marginTop: 2,
    },
    titleWithBadge: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
    },
    formCard: {
        padding: 8,
        margin: 0,
        borderRadius: 22,
    },
    routeDivider: {
        position: "absolute",
        zIndex: 1,
        left: 31,
        top: "50%",
        height: 25,
        alignItems: "center",
        justifyContent: "center",
    },
    routeLine: {
        position: "absolute",
        width: 1,
        height: 22,
        backgroundColor: Colors.routeLine,
    },
    routeDot: {
        width: 5,
        height: 5,
        borderRadius: 3,
        backgroundColor: Colors.brandAccentBright,
    },
    viewAllButton: {
        flexDirection: "row",
        alignItems: "center",
        paddingLeft: 4,
    },
    viewAllText: {
        color: Colors.primary,
        fontSize: 12,
    },
    listCard: {
        paddingHorizontal: 10,
        paddingVertical: 5,
        margin: 0,
        borderRadius: 22,
    },
});

export default ClienteInicioScreen;
