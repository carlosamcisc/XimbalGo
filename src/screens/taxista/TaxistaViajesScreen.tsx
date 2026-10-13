import { SafeAreaView } from "react-native-safe-area-context";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import AppText from "../../components/AppText";
import Card from "../../components/Card";
import ReservaTaxistaCard from "../../components/ReservaTaxistaCard";
import { BottomTabBar, TABS_TAXISTA } from "../../components/BottomTabBar";
import { Icono } from "../../components/Icono";
import Colors from "../../theme/colors";
import type { TaxistaStackParamList } from "../../navigation/types";
import { useTaxista } from "./TaxistaContext";
import { useAccionReserva } from "./useAccionReserva";
import { pantallaDePestania } from "./navegacion";
import DetalleReservaTaxista from "./DetalleReservaTaxista";

type Filtro = "activas" | "historial";

type Props = NativeStackScreenProps<TaxistaStackParamList, "TaxistaViajes">;

const TaxistaViajesScreen = ({ navigation }: Props) => {
    const taxista = useTaxista();
    const ejecutarAccion = useAccionReserva();
    const [filtro, setFiltro] = useState<Filtro>("activas");
    const [reservaId, setReservaId] = useState<string | null>(null);

    const lista = filtro === "activas" ? taxista.activas : taxista.historial;

    const renderContenido = () => {
        if (taxista.cargando) {
            return (
                <View style={styles.estadoLista}>
                    <ActivityIndicator color={Colors.primary} />
                    <AppText style={styles.textoEstado}>Cargando tus viajes...</AppText>
                </View>
            );
        }
        if (taxista.error) {
            return (
                <Card>
                    <View style={styles.estadoLista}>
                        <AppText style={styles.textoEstado}>{taxista.error}</AppText>
                        <Pressable onPress={() => void taxista.cargar()} accessibilityRole="button">
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
                                ? taxista.enServicio
                                    ? "No tienes viajes en curso. Las nuevas solicitudes aparecerán aquí."
                                    : "No tienes viajes en curso. Inicia tu servicio para recibir solicitudes."
                                : "Aún no tienes viajes anteriores."}
                        </AppText>
                    </View>
                </Card>
            );
        }
        return lista.map((reserva) => (
            <ReservaTaxistaCard
                key={reserva.id}
                reserva={reserva}
                procesando={taxista.procesandoReservaId === reserva.id}
                onPress={() => setReservaId(reserva.id)}
                onAceptar={() => ejecutarAccion(reserva.id, "aceptada")}
                onRechazar={() => ejecutarAccion(reserva.id, "rechazada")}
            />
        ));
    };

    return (
        <SafeAreaView style={styles.statusBar} edges={["top", "bottom"]}>
            <StatusBar style="light" />
            <View style={styles.encabezado}>
                <AppText weight="bold" style={styles.titulo}>Mis viajes</AppText>
                <AppText style={styles.subtitulo}>Solicitudes, viajes en curso e historial</AppText>
            </View>
            <View style={styles.pantalla}>
                <View style={styles.filtros} accessibilityRole="tablist">
                    {(["activas", "historial"] as const).map((opcion) => {
                        const activo = filtro === opcion;
                        const total = opcion === "activas" ? taxista.activas.length : taxista.historial.length;
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
                                    {!taxista.cargando && ` (${total})`}
                                </AppText>
                            </Pressable>
                        );
                    })}
                </View>

                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    refreshControl={
                        <RefreshControl
                            refreshing={taxista.refrescando}
                            onRefresh={() => void taxista.refrescar()}
                            tintColor={Colors.primary}
                            colors={[Colors.primary]}
                        />
                    }
                >
                    {renderContenido()}
                </ScrollView>
            </View>

            <DetalleReservaTaxista reservaId={reservaId} onClose={() => setReservaId(null)} />
            <BottomTabBar
                tabs={TABS_TAXISTA}
                activeTab="viajes"
                onPressTab={(tab) => navigation.navigate(pantallaDePestania(tab))}
            />
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    statusBar: {
        backgroundColor: Colors.primary,
        flex: 1,
    },
    encabezado: {
        paddingHorizontal: 24,
        paddingTop: 16,
        paddingBottom: 24,
    },
    titulo: {
        fontSize: 24,
        color: Colors.white,
    },
    subtitulo: {
        fontSize: 15,
        color: Colors.brandSubtitle,
        marginTop: 4,
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

export default TaxistaViajesScreen;
