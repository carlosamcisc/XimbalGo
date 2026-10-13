import { SafeAreaView } from "react-native-safe-area-context";
import { View, StyleSheet, Pressable, ActivityIndicator, RefreshControl, ScrollView, TextInput } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import AppText from "../../components/AppText";
import Colors from "../../theme/colors";
import Card from "../../components/Card";
import Button from "../../components/Button";
import BottomSheet from "../../components/BottomSheet";
import RutaCard from "../../components/RutaCard";
import { BottomTabBar, TABS_CLIENTE, type BottomTabId } from "../../components/BottomTabBar";
import { Icono, type NombreIcono } from "../../components/Icono";
import type { ClienteStackParamList } from "../../navigation/types";
import { formatearPrecio } from "../../modules/cliente/reservas";
import {
    coincideBusqueda,
    formatearDuracion,
    formatearKilometros,
    type RutaCliente,
    type TaxistaRuta,
} from "../../modules/cliente/rutas";
import { useClienteRutas } from "./useClienteRutas";

type Filtro = "todas" | "enServicio";

type Props = NativeStackScreenProps<ClienteStackParamList, "ClienteRutas">;

const DetalleFila = ({ icono, etiqueta, valor }: { icono: NombreIcono; etiqueta: string; valor: string }) => (
    <View style={styles.detalleFila}>
        <Icono nombre={icono} tamanio={20} color={Colors.primary} />
        <View style={styles.detalleTexto}>
            <AppText style={styles.detalleEtiqueta}>{etiqueta}</AppText>
            <AppText weight="medium" style={styles.detalleValor}>{valor}</AppText>
        </View>
    </View>
);

const TaxistaItem = ({ taxista }: { taxista: TaxistaRuta }) => {
    const precio = formatearPrecio(taxista.precio);
    return (
        <View style={styles.taxista}>
            <View style={styles.taxistaEncabezado}>
                <AppText weight="semibold" style={styles.taxistaNombre} numberOfLines={1}>
                    {taxista.nombre}
                </AppText>
                <View style={[styles.estado, taxista.enServicio ? styles.estadoActivo : styles.estadoInactivo]}>
                    <AppText
                        weight="semibold"
                        style={[styles.textoBadge, { color: taxista.enServicio ? Colors.success : Colors.outline }]}
                    >
                        {taxista.enServicio ? "En servicio" : "Fuera de servicio"}
                    </AppText>
                </View>
            </View>
            {taxista.horario && (
                <AppText style={styles.taxistaDato}>Horario: {taxista.horario}</AppText>
            )}
            {precio && <AppText style={styles.taxistaDato}>Precio: {precio}</AppText>}
            {taxista.telefono && <AppText style={styles.taxistaDato}>Teléfono: {taxista.telefono}</AppText>}
            {taxista.vehiculos.length === 0 ? (
                <AppText style={styles.taxistaDato}>Sin vehículo registrado.</AppText>
            ) : (
                taxista.vehiculos.map((vehiculo) => (
                    <View key={vehiculo.id} style={styles.vehiculo}>
                        <Icono nombre="localTaxi" tamanio={16} color={Colors.onSurfaceVariant} />
                        <AppText style={styles.vehiculoTexto} numberOfLines={1}>
                            {[vehiculo.matricula, vehiculo.descripcion].filter(Boolean).join(" · ")}
                        </AppText>
                        <AppText weight="semibold" style={styles.vehiculoAsientos}>
                            {vehiculo.asientosDisponibles}/{vehiculo.totalAsientos} libres
                        </AppText>
                    </View>
                ))
            )}
        </View>
    );
};

const ClienteRutasScreen = ({ navigation }: Props) => {
    const rutasCliente = useClienteRutas();
    const [filtro, setFiltro] = useState<Filtro>("todas");
    const [busqueda, setBusqueda] = useState("");
    const [seleccionadaClave, setSeleccionadaClave] = useState<string | null>(null);

    const enServicio = rutasCliente.rutas.filter((ruta) => ruta.taxistasEnServicio > 0);
    const lista = (filtro === "todas" ? rutasCliente.rutas : enServicio)
        .filter((ruta) => coincideBusqueda(ruta, busqueda));
    // Se busca por clave para que el detalle refleje los cambios en tiempo real.
    const seleccionada: RutaCliente | undefined = rutasCliente.rutas
        .find((ruta) => ruta.clave === seleccionadaClave);

    const handlePressTab = (tab: BottomTabId) => {
        switch (tab) {
            case "inicio":
                navigation.navigate("ClienteInicio");
                break;
            case "rutas":
                break;
            case "reservaciones":
                navigation.navigate("ClienteReservaciones");
                break;
        }
    };

    const buscarTaxis = () => {
        setSeleccionadaClave(null);
        navigation.navigate("ClienteInicio");
    };

    const renderContenido = () => {
        if (rutasCliente.cargando) {
            return (
                <View style={styles.estadoLista}>
                    <ActivityIndicator color={Colors.primary} />
                    <AppText style={styles.textoEstado}>Cargando rutas...</AppText>
                </View>
            );
        }
        if (rutasCliente.error) {
            return (
                <Card>
                    <View style={styles.estadoLista}>
                        <AppText style={styles.textoEstado}>{rutasCliente.error}</AppText>
                        <Pressable onPress={() => void rutasCliente.cargar()} accessibilityRole="button">
                            <AppText weight="semibold" style={styles.textoReintentar}>Reintentar</AppText>
                        </Pressable>
                    </View>
                </Card>
            );
        }
        if (lista.length === 0) {
            const textoVacio = busqueda.trim()
                ? `No hay rutas que coincidan con «${busqueda.trim()}».`
                : filtro === "enServicio"
                    ? "Ahora no hay taxistas en servicio en ninguna ruta."
                    : "Todavía no hay rutas disponibles.";
            return (
                <Card>
                    <View style={styles.estadoLista}>
                        <Icono nombre="map" tamanio={36} color={Colors.outlineVariant} />
                        <AppText style={styles.textoEstado}>{textoVacio}</AppText>
                        {filtro === "enServicio" && !busqueda.trim() && (
                            <Pressable onPress={() => setFiltro("todas")} accessibilityRole="button">
                                <AppText weight="semibold" style={styles.textoReintentar}>Ver todas las rutas</AppText>
                            </Pressable>
                        )}
                    </View>
                </Card>
            );
        }
        return lista.map((ruta) => (
            <RutaCard key={ruta.clave} ruta={ruta} onPress={() => setSeleccionadaClave(ruta.clave)} />
        ));
    };

    const precioSeleccionada = seleccionada ? formatearPrecio(seleccionada.precioDesde) : null;
    const distanciaSeleccionada = seleccionada ? formatearKilometros(seleccionada.distanciaKm) : null;
    const duracionSeleccionada = seleccionada ? formatearDuracion(seleccionada.tiempoEstimadoMin) : null;

    return (
        <SafeAreaView style={styles.statusBar} edges={["top", "bottom"]}>
            <StatusBar style="light" />
            <View style={styles.encabezado}>
                <AppText weight="bold" style={styles.titulo}>Rutas</AppText>
                <AppText style={styles.subtitulo}>Conoce los trayectos y los taxistas que los cubren</AppText>
            </View>
            <View style={styles.pantalla}>
                <View style={styles.buscador}>
                    <Icono nombre="search" tamanio={20} color={Colors.outline} />
                    <TextInput
                        style={styles.inputBusqueda}
                        value={busqueda}
                        onChangeText={setBusqueda}
                        placeholder="Buscar por origen o destino"
                        placeholderTextColor={Colors.outline}
                        autoCorrect={false}
                        returnKeyType="search"
                        accessibilityLabel="Buscar ruta"
                    />
                    {busqueda.length > 0 && (
                        <Pressable onPress={() => setBusqueda("")} accessibilityRole="button" accessibilityLabel="Limpiar búsqueda">
                            <Icono nombre="close" tamanio={20} color={Colors.outline} />
                        </Pressable>
                    )}
                </View>

                <View style={styles.filtros} accessibilityRole="tablist">
                    {(["todas", "enServicio"] as const).map((opcion) => {
                        const activo = filtro === opcion;
                        const total = opcion === "todas" ? rutasCliente.rutas.length : enServicio.length;
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
                                    {opcion === "todas" ? "Todas" : "En servicio"}
                                    {!rutasCliente.cargando && ` (${total})`}
                                </AppText>
                            </Pressable>
                        );
                    })}
                </View>

                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    keyboardShouldPersistTaps="handled"
                    refreshControl={
                        <RefreshControl
                            refreshing={rutasCliente.refrescando}
                            onRefresh={() => void rutasCliente.refrescar()}
                            tintColor={Colors.primary}
                            colors={[Colors.primary]}
                        />
                    }
                >
                    {renderContenido()}
                </ScrollView>
            </View>

            <BottomSheet visible={seleccionada !== undefined} onClose={() => setSeleccionadaClave(null)}>
                {seleccionada && (
                    <View>
                        <AppText weight="semibold" style={styles.tituloDetalle}>{seleccionada.nombre}</AppText>
                        <AppText style={styles.descripcionRuta}>
                            {seleccionada.taxistasEnServicio > 0
                                ? `${seleccionada.taxistasEnServicio} en servicio · ${seleccionada.asientosDisponibles} asientos libres`
                                : "No hay taxistas en servicio en esta ruta ahora."}
                        </AppText>

                        <DetalleFila icono="locationHistory" etiqueta="Origen" valor={seleccionada.origen} />
                        <DetalleFila icono="locationOn" etiqueta="Destino" valor={seleccionada.destino} />
                        {distanciaSeleccionada && (
                            <DetalleFila icono="straighten" etiqueta="Distancia" valor={distanciaSeleccionada} />
                        )}
                        {duracionSeleccionada && (
                            <DetalleFila icono="timer" etiqueta="Tiempo estimado" valor={duracionSeleccionada} />
                        )}
                        {precioSeleccionada && (
                            <DetalleFila icono="payments" etiqueta="Precio" valor={`Desde ${precioSeleccionada}`} />
                        )}

                        <AppText weight="semibold" style={styles.tituloSeccion}>Taxistas en esta ruta</AppText>
                        {seleccionada.taxistas.length === 0 ? (
                            <AppText style={styles.textoEstado}>Aún no hay taxistas registrados en esta ruta.</AppText>
                        ) : (
                            <ScrollView style={styles.listaTaxistas}>
                                {seleccionada.taxistas.map((taxista) => (
                                    <TaxistaItem key={taxista.id} taxista={taxista} />
                                ))}
                            </ScrollView>
                        )}

                        <Button titulo="Buscar taxis cercanos" onPress={buscarTaxis} />
                    </View>
                )}
            </BottomSheet>

            <BottomTabBar tabs={TABS_CLIENTE} activeTab="rutas" onPressTab={handlePressTab} />
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
    buscador: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        marginHorizontal: 12,
        marginTop: 18,
        paddingHorizontal: 12,
        borderWidth: 1,
        borderColor: Colors.outlineVariant,
        borderRadius: 16,
        backgroundColor: Colors.white,
    },
    inputBusqueda: {
        flex: 1,
        fontSize: 15,
        paddingVertical: 10,
        color: Colors.onSurfaceVariant,
    },
    filtros: {
        flexDirection: "row",
        margin: 12,
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
    tituloDetalle: {
        fontSize: 18,
    },
    descripcionRuta: {
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
    tituloSeccion: {
        fontSize: 15,
        marginTop: 14,
        marginBottom: 6,
    },
    listaTaxistas: {
        maxHeight: 240,
    },
    taxista: {
        gap: 3,
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: Colors.divider,
    },
    taxistaEncabezado: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 8,
    },
    taxistaNombre: {
        flexShrink: 1,
        fontSize: 14,
        color: Colors.brandText,
    },
    taxistaDato: {
        fontSize: 13,
        color: Colors.onSurfaceVariant,
    },
    estado: {
        borderRadius: 10,
        paddingHorizontal: 9,
        paddingVertical: 4,
    },
    estadoActivo: {
        backgroundColor: Colors.brandAccentContainer,
    },
    estadoInactivo: {
        backgroundColor: Colors.surfaceMuted,
    },
    textoBadge: {
        fontSize: 11,
    },
    vehiculo: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        marginTop: 2,
    },
    vehiculoTexto: {
        flex: 1,
        fontSize: 13,
        color: Colors.onSurfaceVariant,
    },
    vehiculoAsientos: {
        fontSize: 12,
        color: Colors.brandText,
    },
});

export default ClienteRutasScreen;
