import { SafeAreaView } from "react-native-safe-area-context";
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import AppText from "../../components/AppText";
import Button from "../../components/Button";
import Card from "../../components/Card";
import UserHeader from "../../components/UserHeader";
import ReservaTaxistaCard from "../../components/ReservaTaxistaCard";
import { BottomTabBar, TABS_TAXISTA } from "../../components/BottomTabBar";
import { Icono } from "../../components/Icono";
import { ToastMessage } from "../../components/ToastMessaje";
import Colors from "../../theme/colors";
import { formatearPrecio } from "../../modules/cliente/reservas";
import type { TaxistaStackParamList } from "../../navigation/types";
import { obtenerSaludo } from "../cliente/useClienteInicio";
import { useTaxista } from "./TaxistaContext";
import { useAccionReserva } from "./useAccionReserva";
import { pantallaDePestania } from "./navegacion";
import DetalleReservaTaxista from "./DetalleReservaTaxista";

type Props = NativeStackScreenProps<TaxistaStackParamList, "TaxistaInicio">;

const Requisito = ({ cumplido, texto, accion, onPress }: {
    cumplido: boolean;
    texto: string;
    accion: string;
    onPress: () => void;
}) => (
    <View style={styles.requisito}>
        <View style={[styles.marca, cumplido ? styles.marcaCumplida : styles.marcaPendiente]} />
        <AppText style={styles.textoRequisito}>{texto}</AppText>
        {!cumplido && (
            <Pressable onPress={onPress} accessibilityRole="button">
                <AppText weight="semibold" style={styles.enlace}>{accion}</AppText>
            </Pressable>
        )}
    </View>
);

const TaxistaInicioScreen = ({ navigation }: Props) => {
    const taxista = useTaxista();
    const ejecutarAccion = useAccionReserva();
    const [reservaId, setReservaId] = useState<string | null>(null);

    const { perfil, vehiculo } = taxista;
    const nombre = perfil?.nombres.trim().split(/\s+/)[0] || "Taxista";
    const tieneRuta = perfil?.ruta != null;
    const tieneVehiculo = vehiculo?.activo === true;
    const puedeIniciar = tieneRuta && tieneVehiculo;
    const aceptadas = taxista.activas.filter((reserva) => reserva.estado === "aceptada");

    const asientos = vehiculo?.asientos ?? [];
    const conteo = {
        libres: asientos.filter((asiento) => asiento.estado === "disponible").length,
        reservados: asientos.filter((asiento) => asiento.estado === "reservado").length,
        ocupados: asientos.filter((asiento) => asiento.estado === "ocupado").length,
    };
    const precio = formatearPrecio(perfil?.precioRuta ?? perfil?.ruta?.precioBase ?? null);

    const cambiarServicio = async (enServicio: boolean) => {
        const error = await taxista.cambiarEstadoServicio(enServicio);
        ToastMessage.show(
            error ?? (enServicio ? "Estás en servicio. Los clientes ya pueden verte." : "Terminaste tu servicio."),
            error ? "long" : "short"
        );
    };

    const terminarServicio = () => {
        if (taxista.activas.length === 0) {
            void cambiarServicio(false);
            return;
        }
        Alert.alert(
            "Terminar servicio",
            `Tienes ${taxista.activas.length} viaje(s) en curso. Dejarás de recibir solicitudes, pero tus viajes en curso seguirán abiertos.`,
            [
                { text: "Volver", style: "cancel" },
                { text: "Terminar", style: "destructive", onPress: () => void cambiarServicio(false) },
            ]
        );
    };

    const renderEstadoServicio = () => {
        if (taxista.enServicio) {
            return (
                <>
                    <View style={styles.filaEstado}>
                        <View style={[styles.indicador, taxista.visibleParaClientes ? styles.indicadorActivo : styles.indicadorAviso]} />
                        <AppText weight="semibold" style={styles.tituloEstado}>En servicio</AppText>
                    </View>
                    <AppText style={styles.descripcionEstado}>
                        {taxista.visibleParaClientes
                            ? "Los clientes cercanos te ven y pueden reservar. Mantén la app abierta para seguir enviando tu ubicación."
                            : "Enviando tu ubicación... Hasta que llegue, los clientes no te verán."}
                    </AppText>
                    {taxista.errorUbicacion && (
                        <AppText style={styles.textoError}>{taxista.errorUbicacion}</AppText>
                    )}
                    <Button
                        titulo={taxista.cambiandoServicio ? "Procesando..." : "Terminar servicio"}
                        color={Colors.danger}
                        borderColor={Colors.danger}
                        disabled={taxista.cambiandoServicio}
                        onPress={terminarServicio}
                    />
                </>
            );
        }
        return (
            <>
                <View style={styles.filaEstado}>
                    <View style={[styles.indicador, styles.indicadorInactivo]} />
                    <AppText weight="semibold" style={styles.tituloEstado}>Fuera de servicio</AppText>
                </View>
                <AppText style={styles.descripcionEstado}>
                    Inicia tu servicio para aparecer a los clientes cercanos y recibir solicitudes.
                </AppText>
                <Requisito
                    cumplido={tieneRuta}
                    texto={tieneRuta ? `Ruta: ${perfil?.ruta?.nombre}` : "Elige tu ruta"}
                    accion="Ir a perfil"
                    onPress={() => navigation.navigate("TaxistaPerfil")}
                />
                <Requisito
                    cumplido={tieneVehiculo}
                    texto={tieneVehiculo ? `Vehículo: ${vehiculo?.matricula}` : vehiculo ? "Activa tu vehículo" : "Registra tu vehículo"}
                    accion="Ir a vehículo"
                    onPress={() => navigation.navigate("TaxistaVehiculo")}
                />
                <Button
                    titulo={taxista.cambiandoServicio ? "Obteniendo ubicación..." : "Iniciar servicio"}
                    disabled={!puedeIniciar || taxista.cambiandoServicio}
                    onPress={() => void cambiarServicio(true)}
                />
            </>
        );
    };

    const renderContenido = () => {
        if (taxista.cargando) {
            return (
                <View style={styles.estadoLista}>
                    <ActivityIndicator color={Colors.primary} />
                    <AppText style={styles.textoEstado}>Cargando tu información...</AppText>
                </View>
            );
        }
        if (taxista.error || !perfil) {
            return (
                <Card>
                    <View style={styles.estadoLista}>
                        <AppText style={styles.textoEstado}>{taxista.error ?? "No se pudo cargar tu información."}</AppText>
                        <Pressable onPress={() => void taxista.cargar()} accessibilityRole="button">
                            <AppText weight="semibold" style={styles.enlace}>Reintentar</AppText>
                        </Pressable>
                    </View>
                </Card>
            );
        }
        return (
            <>
                <Card style={styles.tarjeta}>{renderEstadoServicio()}</Card>

                {(perfil.ruta || vehiculo) && (
                    <Card style={styles.tarjeta}>
                        {perfil.ruta && (
                            <View style={styles.filaResumen}>
                                <Icono nombre="map" tamanio={20} color={Colors.primary} />
                                <View style={styles.textoResumen}>
                                    <AppText weight="semibold" style={styles.valorResumen} numberOfLines={1}>
                                        {perfil.ruta.origen} → {perfil.ruta.destino}
                                    </AppText>
                                    {precio && <AppText style={styles.etiquetaResumen}>Tu precio: {precio}</AppText>}
                                </View>
                            </View>
                        )}
                        {vehiculo && (
                            <View style={styles.asientos}>
                                <View style={styles.asiento}>
                                    <AppText weight="bold" style={[styles.numeroAsientos, { color: Colors.success }]}>{conteo.libres}</AppText>
                                    <AppText style={styles.etiquetaResumen}>Libres</AppText>
                                </View>
                                <View style={styles.asiento}>
                                    <AppText weight="bold" style={[styles.numeroAsientos, { color: Colors.primary }]}>{conteo.reservados}</AppText>
                                    <AppText style={styles.etiquetaResumen}>Reservados</AppText>
                                </View>
                                <View style={styles.asiento}>
                                    <AppText weight="bold" style={[styles.numeroAsientos, { color: Colors.brandText }]}>{conteo.ocupados}</AppText>
                                    <AppText style={styles.etiquetaResumen}>Ocupados</AppText>
                                </View>
                            </View>
                        )}
                    </Card>
                )}

                <View style={styles.seccion}>
                    <Icono nombre="bookMarks" tamanio={22} color={Colors.primary} />
                    <AppText weight="semibold" style={styles.tituloSeccion}>
                        Solicitudes pendientes ({taxista.pendientes.length})
                    </AppText>
                </View>
                {taxista.pendientes.length === 0 ? (
                    <Card>
                        <View style={styles.estadoLista}>
                            <AppText style={styles.textoEstado}>
                                {taxista.enServicio
                                    ? "Aún no hay solicitudes. Te avisaremos aquí en cuanto llegue una."
                                    : "No tienes solicitudes pendientes."}
                            </AppText>
                        </View>
                    </Card>
                ) : (
                    taxista.pendientes.map((reserva) => (
                        <ReservaTaxistaCard
                            key={reserva.id}
                            reserva={reserva}
                            accionProcesando={taxista.procesandoReservaId === reserva.id ? taxista.procesandoAccion : null}
                            onPress={() => setReservaId(reserva.id)}
                            onAceptar={() => ejecutarAccion(reserva.id, "aceptada")}
                            onRechazar={() => ejecutarAccion(reserva.id, "rechazada")}
                        />
                    ))
                )}

                {aceptadas.length > 0 && (
                    <Pressable
                        onPress={() => navigation.navigate("TaxistaViajes")}
                        accessibilityRole="button"
                        style={styles.enlaceViajes}
                    >
                        <AppText weight="semibold" style={styles.enlace}>
                            Tienes {aceptadas.length} viaje(s) aceptado(s). Ver viajes
                        </AppText>
                        <Icono nombre="ArrowRight" tamanio={20} color={Colors.primary} />
                    </Pressable>
                )}
            </>
        );
    };

    return (
        <SafeAreaView style={styles.statusBar} edges={["top", "bottom"]}>
            <StatusBar style="light" />
            <View style={styles.pantalla}>
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
                    <UserHeader
                        nombre={nombre}
                        inicial={nombre.charAt(0).toUpperCase()}
                        saludo={obtenerSaludo()}
                        onPress={() => navigation.navigate("TaxistaPerfil")}
                        backgroundColor={Colors.primary}
                        avatarBackground={Colors.primaryContainer}
                        avatarTextColor={Colors.secondary}
                        saludoTextColor={Colors.white}
                        buenasTextColor={Colors.white}
                    />
                    {renderContenido()}
                </ScrollView>
            </View>
            <DetalleReservaTaxista reservaId={reservaId} onClose={() => setReservaId(null)} />
            <BottomTabBar
                tabs={TABS_TAXISTA}
                activeTab="inicio"
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
    pantalla: {
        backgroundColor: Colors.surface,
        flex: 1,
    },
    scrollContent: {
        paddingBottom: 120,
    },
    tarjeta: {
        padding: 16,
    },
    filaEstado: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
    },
    indicador: {
        width: 12,
        height: 12,
        borderRadius: 6,
    },
    indicadorActivo: {
        backgroundColor: Colors.success,
    },
    indicadorAviso: {
        backgroundColor: Colors.secondary,
    },
    indicadorInactivo: {
        backgroundColor: Colors.outlineVariant,
    },
    tituloEstado: {
        fontSize: 18,
        color: Colors.brandText,
    },
    descripcionEstado: {
        fontSize: 14,
        color: Colors.onSurfaceVariant,
        marginTop: 6,
        marginBottom: 6,
    },
    textoError: {
        fontSize: 13,
        color: Colors.error,
        marginBottom: 4,
    },
    requisito: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        paddingVertical: 6,
    },
    marca: {
        width: 10,
        height: 10,
        borderRadius: 5,
    },
    marcaCumplida: {
        backgroundColor: Colors.success,
    },
    marcaPendiente: {
        borderWidth: 2,
        borderColor: Colors.danger,
    },
    textoRequisito: {
        flex: 1,
        fontSize: 14,
        color: Colors.brandText,
    },
    filaResumen: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: Colors.divider,
    },
    textoResumen: {
        flex: 1,
    },
    valorResumen: {
        fontSize: 15,
        color: Colors.brandText,
    },
    etiquetaResumen: {
        fontSize: 12,
        color: Colors.outline,
    },
    asientos: {
        flexDirection: "row",
        paddingTop: 12,
    },
    asiento: {
        flex: 1,
        alignItems: "center",
    },
    numeroAsientos: {
        fontSize: 22,
    },
    seccion: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        marginHorizontal: 14,
        marginTop: 10,
    },
    tituloSeccion: {
        fontSize: 16,
        color: Colors.brandText,
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
    enlace: {
        fontSize: 14,
        color: Colors.primary,
    },
    enlaceViajes: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 4,
        padding: 14,
    },
});

export default TaxistaInicioScreen;
