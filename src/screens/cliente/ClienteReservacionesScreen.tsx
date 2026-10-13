import { SafeAreaView } from "react-native-safe-area-context";
import { View, StyleSheet, Pressable, ActivityIndicator, RefreshControl, ScrollView } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import AppText from "../../components/AppText";
import Colors from "../../theme/colors";
import Card from "../../components/Card";
import Button from "../../components/Button";
import BottomSheet from "../../components/BottomSheet";
import ReservaCard from "../../components/ReservaCard";
import { ToastMessage } from "../../components/ToastMessaje";
import { BottomTabBar, TABS_CLIENTE, type BottomTabId } from "../../components/BottomTabBar";
import { Icono, type NombreIcono } from "../../components/Icono";
import type { ClienteStackParamList } from "../../navigation/types";
import {
    PRESENTACION_ESTADO,
    formatearFecha,
    formatearPrecio,
    puedeCancelarse,
    type ReservaCliente,
} from "../../modules/cliente/reservas";
import { useClienteReservaciones } from "./useClienteReservaciones";

type Filtro = "activas" | "historial";

type Props = NativeStackScreenProps<ClienteStackParamList, "ClienteReservaciones">;

const DetalleFila = ({ icono, etiqueta, valor }: { icono: NombreIcono; etiqueta: string; valor: string }) => (
    <View style={styles.detalleFila}>
        <Icono nombre={icono} tamanio={20} color={Colors.primary} />
        <View style={styles.detalleTexto}>
            <AppText style={styles.detalleEtiqueta}>{etiqueta}</AppText>
            <AppText weight="medium" style={styles.detalleValor}>{valor}</AppText>
        </View>
    </View>
);

const ClienteReservacionesScreen = ({ navigation }: Props) => {
    const reservaciones = useClienteReservaciones();
    const [filtro, setFiltro] = useState<Filtro>("activas");
    const [seleccionadaId, setSeleccionadaId] = useState<string | null>(null);
    const [confirmandoCancelacion, setConfirmandoCancelacion] = useState(false);

    const lista = filtro === "activas" ? reservaciones.activas : reservaciones.historial;
    // Se busca por id para que el detalle refleje los cambios en tiempo real.
    const seleccionada: ReservaCliente | undefined = [...reservaciones.activas, ...reservaciones.historial]
        .find((reserva) => reserva.id === seleccionadaId);
    const cancelando = seleccionada !== undefined && reservaciones.cancelandoId === seleccionada.id;

    const cerrarDetalle = () => {
        setSeleccionadaId(null);
        setConfirmandoCancelacion(false);
    };

    const confirmarCancelacion = async () => {
        if (!seleccionada) {
            return;
        }
        const error = await reservaciones.cancelar(seleccionada.id);
        setConfirmandoCancelacion(false);
        if (error) {
            ToastMessage.show(error);
            return;
        }
        cerrarDetalle();
        ToastMessage.show("Reservación cancelada");
    };

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
            <ReservaCard key={reserva.id} reserva={reserva} onPress={() => setSeleccionadaId(reserva.id)} />
        ));
    };

    const estadoSeleccionada = seleccionada ? PRESENTACION_ESTADO[seleccionada.estado] : null;
    const precioSeleccionada = seleccionada ? formatearPrecio(seleccionada.precio) : null;

    return (
        <SafeAreaView style={styles.statusBar} edges={["top", "bottom"]}>
            <StatusBar style="light" />
            <View style={styles.encabezado}>
                <AppText weight="bold" style={styles.titulo}>Mis reservaciones</AppText>
                <AppText style={styles.subtitulo}>Consulta y administra tus viajes</AppText>
            </View>
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

            <BottomSheet visible={seleccionada !== undefined} onClose={cerrarDetalle}>
                {seleccionada && estadoSeleccionada && (
                    <View>
                        <View style={styles.detalleEncabezado}>
                            <AppText weight="semibold" style={styles.tituloDetalle}>Detalle de la reservación</AppText>
                            <View style={[styles.estado, { backgroundColor: estadoSeleccionada.fondo }]}>
                                <AppText weight="semibold" style={[styles.textoEstadoDetalle, { color: estadoSeleccionada.color }]}>
                                    {estadoSeleccionada.etiqueta}
                                </AppText>
                            </View>
                        </View>
                        <AppText style={styles.descripcionEstado}>{estadoSeleccionada.descripcion}</AppText>

                        <DetalleFila icono="locationHistory" etiqueta="Origen" valor={seleccionada.origen ?? "Mi ubicación"} />
                        <DetalleFila icono="locationOn" etiqueta="Destino" valor={seleccionada.destino ?? "Paradero no disponible"} />
                        <DetalleFila
                            icono="localTaxi"
                            etiqueta="Taxi"
                            valor={[seleccionada.matricula, seleccionada.vehiculo].filter(Boolean).join(" · ") || "No disponible"}
                        />
                        {seleccionada.nombreTaxista && (
                            <DetalleFila
                                icono="phone"
                                etiqueta="Taxista"
                                valor={[seleccionada.nombreTaxista, seleccionada.telefonoTaxista].filter(Boolean).join(" · ")}
                            />
                        )}
                        {seleccionada.numeroAsiento !== null && (
                            <DetalleFila icono="eventSeat" etiqueta="Asiento" valor={`Número ${seleccionada.numeroAsiento}`} />
                        )}
                        <DetalleFila
                            icono="schedule"
                            etiqueta={seleccionada.fechaViaje ? "Fecha del viaje" : "Solicitada"}
                            valor={formatearFecha(seleccionada.fechaViaje ?? seleccionada.fechaReserva)}
                        />
                        {precioSeleccionada && (
                            <DetalleFila icono="payments" etiqueta="Precio" valor={precioSeleccionada} />
                        )}
                        {seleccionada.notas && (
                            <DetalleFila icono="notes" etiqueta="Notas" valor={seleccionada.notas} />
                        )}

                        {puedeCancelarse(seleccionada.estado) && (
                            confirmandoCancelacion ? (
                                <View style={styles.confirmacion}>
                                    <AppText style={styles.textoConfirmacion}>
                                        ¿Seguro que quieres cancelar? Tu asiento quedará libre para otro pasajero.
                                    </AppText>
                                    <Button
                                        titulo={cancelando ? "Cancelando..." : "Sí, cancelar reservación"}
                                        color={Colors.danger}
                                        borderColor={Colors.danger}
                                        disabled={cancelando}
                                        onPress={() => void confirmarCancelacion()}
                                    />
                                    <Pressable
                                        onPress={() => setConfirmandoCancelacion(false)}
                                        disabled={cancelando}
                                        accessibilityRole="button"
                                        style={styles.botonSecundario}
                                    >
                                        <AppText weight="semibold" style={styles.textoReintentar}>Conservar reservación</AppText>
                                    </Pressable>
                                </View>
                            ) : (
                                <Button
                                    titulo="Cancelar reservación"
                                    color={Colors.danger}
                                    borderColor={Colors.danger}
                                    onPress={() => setConfirmandoCancelacion(true)}
                                />
                            )
                        )}
                    </View>
                )}
            </BottomSheet>

            <BottomTabBar tabs={TABS_CLIENTE} activeTab="reservaciones" onPressTab={handlePressTab} />
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
    detalleEncabezado: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 8,
    },
    tituloDetalle: {
        fontSize: 18,
        flexShrink: 1,
    },
    estado: {
        borderRadius: 10,
        paddingHorizontal: 9,
        paddingVertical: 5,
    },
    textoEstadoDetalle: {
        fontSize: 12,
    },
    descripcionEstado: {
        fontSize: 13,
        color: Colors.onSurfaceVariant,
        marginTop: 6,
        marginBottom: 8,
    },
    detalleFila: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: Colors.divider,
    },
    detalleTexto: {
        flex: 1,
    },
    detalleEtiqueta: {
        fontSize: 12,
        color: Colors.outline,
    },
    detalleValor: {
        fontSize: 14,
        color: Colors.brandText,
    },
    confirmacion: {
        marginTop: 12,
    },
    textoConfirmacion: {
        fontSize: 14,
        textAlign: "center",
        color: Colors.onSurface,
    },
    botonSecundario: {
        alignItems: "center",
        paddingVertical: 8,
    },
});

export default ClienteReservacionesScreen;
