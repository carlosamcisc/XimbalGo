import { SafeAreaView } from "react-native-safe-area-context";
import { View, StyleSheet, Pressable, ActivityIndicator, RefreshControl, ScrollView } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import AppText from "../../components/AppText";
import Colors from "../../theme/colors";
import Card from "../../components/Card";
import ReservaCard from "../../components/ReservaCard";
import { BottomTabBar, TABS_CLIENTE, type BottomTabId } from "../../components/BottomTabBar";
import { Icono } from "../../components/Icono";
import type { ClienteStackParamList } from "../../navigation/types";
import EncabezadoPantalla from "../../components/EncabezadoPantalla";
import ClienteSideBar, { BotonMenuCliente } from "./ClienteSideBar";
import { useClienteReservaciones } from "./useClienteReservaciones";

type Filtro = "activas" | "historial";

type Props = NativeStackScreenProps<ClienteStackParamList, "ClienteReservaciones">;

const ClienteReservacionesScreen = ({ navigation }: Props) => {
    const [menuVisible, setMenuVisible] = useState(false);
    const reservaciones = useClienteReservaciones();
    const [filtro, setFiltro] = useState<Filtro>("activas");

    const lista = filtro === "activas" ? reservaciones.activas : reservaciones.historial;

    const handlePressTab = (tab: BottomTabId) => {
        switch (tab) {
            case "inicio":
                navigation.navigate("ClienteInicio");
                break;
            case "rutas":
                navigation.navigate("ClienteRutas");
                break;
            case "reservaciones":
                break;
        }
    };

    const renderContenido = () => {
        if (reservaciones.cargando) {
            return (
                <View style={styles.estadoLista}>
                    <ActivityIndicator color={Colors.primary} />
                    <AppText style={styles.textoEstado}>Cargando tus reservaciones...</AppText>
                </View>
            );
        }
        if (reservaciones.error) {
            return (
                <Card>
                    <View style={styles.estadoLista}>
                        <AppText style={styles.textoEstado}>{reservaciones.error}</AppText>
                        <Pressable onPress={() => void reservaciones.cargar()} accessibilityRole="button">
                            <AppText weight="semibold" style={styles.textoReintentar}>Reintentar</AppText>
                        </Pressable>
                    </View>
                </Card>
            );
        }
        if (lista.length === 0) {
            return (
                <Card>
                    <View style={styles.estadoLista}>
                        <Icono nombre="bookMarks" tamanio={36} color={Colors.outlineVariant} />
                        <AppText style={styles.textoEstado}>
                            {filtro === "activas"
                                ? "No tienes reservaciones en curso."
                                : "Aún no tienes reservaciones anteriores."}
                        </AppText>
                        {filtro === "activas" && (
                            <Pressable onPress={() => navigation.navigate("ClienteInicio")} accessibilityRole="button">
                                <AppText weight="semibold" style={styles.textoReintentar}>Reservar un viaje</AppText>
                            </Pressable>
                        )}
                    </View>
                </Card>
            );
        }
        return lista.map((reserva) => (
            <ReservaCard
                key={reserva.id}
                reserva={reserva}
                onPress={() => navigation.navigate("ClienteReserva", { reservaId: reserva.id })}
            />
        ));
    };

    return (
        <SafeAreaView style={styles.statusBar} edges={["top", "bottom"]}>
            <StatusBar style="light" />
            <EncabezadoPantalla
                titulo="Mis reservaciones"
                subtitulo="Consulta y administra tus viajes"
                accion={<BotonMenuCliente onPress={() => setMenuVisible(true)} />}
            />
            <View style={styles.pantalla}>
                <View style={styles.filtros} accessibilityRole="tablist">
                    {(["activas", "historial"] as const).map((opcion) => {
                        const activo = filtro === opcion;
                        const total = opcion === "activas"
                            ? reservaciones.activas.length
                            : reservaciones.historial.length;
                        return (
                            <Pressable
                                key={opcion}
                                onPress={() => setFiltro(opcion)}
                                accessibilityRole="tab"
                                accessibilityState={{ selected: activo }}
                                style={[styles.filtro, activo && styles.filtroActivo]}
                            >
                                <AppText
                                    weight={activo ? "semibold" : "regular"}
                                    style={[styles.textoFiltro, activo && styles.textoFiltroActivo]}
                                >
                                    {opcion === "activas" ? "En curso" : "Historial"}
                                    {!reservaciones.cargando && ` (${total})`}
                                </AppText>
                            </Pressable>
                        );
                    })}
                </View>

                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    refreshControl={
                        <RefreshControl
                            refreshing={reservaciones.refrescando}
                            onRefresh={() => void reservaciones.refrescar()}
                            tintColor={Colors.primary}
                            colors={[Colors.primary]}
                        />
                    }
                >
                    {renderContenido()}
                </ScrollView>
            </View>

            <BottomTabBar tabs={TABS_CLIENTE} activeTab="reservaciones" onPressTab={handlePressTab} />
            <ClienteSideBar visible={menuVisible} onClose={() => setMenuVisible(false)} />
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
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        overflow: "hidden",
    },
    filtros: {
        flexDirection: "row",
        margin: 12,
        marginTop: 18,
        padding: 4,
        borderRadius: 16,
        backgroundColor: Colors.surfaceMuted,
    },
    filtro: {
        flex: 1,
        alignItems: "center",
        paddingVertical: 10,
        borderRadius: 12,
    },
    filtroActivo: {
        backgroundColor: Colors.white,
        elevation: 1,
        shadowColor: Colors.brandDeep,
        shadowOpacity: 0.08,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 2 },
    },
    textoFiltro: {
        fontSize: 14,
        color: Colors.onSurfaceVariant,
    },
    textoFiltroActivo: {
        color: Colors.primary,
    },
    scrollContent: {
        paddingBottom: 120,
    },
    estadoLista: {
        alignItems: "center",
        gap: 8,
        padding: 16,
    },
    textoEstado: {
        fontSize: 14,
        textAlign: "center",
        color: Colors.onSurfaceVariant,
    },
    textoReintentar: {
        fontSize: 14,
        color: Colors.primary,
    },
});

export default ClienteReservacionesScreen;
