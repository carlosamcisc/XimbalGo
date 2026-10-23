import { SafeAreaView } from "react-native-safe-area-context";
import { View, StyleSheet, Pressable, RefreshControl } from "react-native";
import AppText from "../../components/AppText";
import { StatusBar } from "expo-status-bar";
import Colors from "../../theme/colors";
import UserHeader from "../../components/UserHeader";
import { ToastMessage } from "../../components/ToastMessaje";
import KeyboardAwareScroll from "../../components/KeyboardAwareScroll";
import { useEffect, useState } from "react";
import Button from "../../components/Button";
import EstadoLista from "../../components/EstadoLista";
import { BottomTabBar, TABS_CLIENTE, BottomTabId } from "../../components/BottomTabBar";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { ClienteStackParamList } from "../../navigation/types";
import { Icono, IconoFontAwesome6 } from "../../components/Icono";
import TaxiCard from "../../components/TaxiCard";
import Card from "../../components/Card";
import ParadaItem from "../../components/ParadaItem";
import {
    formatearDistancia,
    formatearTrayectoParadero,
    type TaxiCercano,
} from "../../modules/cliente/ubicacion";
import type { ParaderoViaje } from "../../modules/cliente/types";
import { useClienteInicio } from "./useClienteInicio";
import SelectorViaje from "./SelectorViaje";
import { useCliente } from "./ClienteContext";
import ClienteSideBar from "./ClienteSideBar";

const mostrarAviso = (mensaje: string | null) => {
    if (mensaje) {
        ToastMessage.show(mensaje);
    }
};

type Props = NativeStackScreenProps<ClienteStackParamList, 'ClienteInicio'>;

const ClienteInicioScreen = ({ navigation, route }: Props) => {
    const [menuVisible, setMenuVisible] = useState(false);
    const inicio = useClienteInicio();
    const cliente = useCliente();

    const handlePressTab = (tab: BottomTabId) => {
        switch (tab) {
            case 'inicio':
                break;
            case 'rutas':
                navigation.navigate("ClienteRutas");
                break;
            case 'reservaciones':
                navigation.navigate("ClienteReservaciones");
                break;
        }
    };

    const elegirTaxi = (taxi: TaxiCercano) => {
        if (!inicio.origen || !inicio.destino) {
            ToastMessage.show("Elige tu origen y destino para reservar en este taxi.");
            return;
        }
        navigation.navigate("ClienteReservar", {
            vehiculoId: taxi.id,
            origen: inicio.origen,
            destino: inicio.destino,
            distanciaMetros: taxi.distanciaMetros,
        });
    };

    const verTodosLosTaxis = () => {
        navigation.navigate("ClienteTaxis", {
            origen: inicio.origen ?? undefined,
            destino: inicio.destino ?? undefined,
        });
    };

    // El GPS y los paraderos no son orígenes del catálogo: entonces solo se
    // filtra por destino.
    const buscarRuta = () => {
        if (!inicio.destino) {
            ToastMessage.show("Elige tu destino para buscar rutas.");
            return;
        }
        navigation.navigate("ClienteRutas", {
            origen: inicio.origen?.tipo === "ruta" ? inicio.origen.nombre : undefined,
            destino: inicio.destino,
        });
    };

    const seleccionarParaderoOrigen = (paradero: ParaderoViaje) => {
        const aviso = inicio.seleccionarOrigenParadero(paradero);
        mostrarAviso(aviso ?? `${paradero.nombre} seleccionado como origen`);
    };

    // El detalle del paradero regresa aquí con el paradero elegido como origen.
    const paraderoOrigen = route.params?.paraderoOrigen;
    useEffect(() => {
        if (!paraderoOrigen) {
            return;
        }
        seleccionarParaderoOrigen(paraderoOrigen);
        navigation.setParams({ paraderoOrigen: undefined });
        // Solo debe reaccionar a un paradero nuevo en los parámetros.
    }, [paraderoOrigen]);

    return (
        <SafeAreaView style={styles.statusBar} edges={['top', 'bottom']}>
            <StatusBar style="light" />
            <View style={styles.pantalla}>
                <KeyboardAwareScroll
                    contentContainerStyle={styles.scrollContent}
                    refreshControl={
                        <RefreshControl
                            refreshing={inicio.refrescando}
                            onRefresh={() => void inicio.refrescar()}
                            tintColor={Colors.primary}
                            colors={[Colors.primary]}
                        />
                    }
                >
                    <UserHeader
                        nombre={cliente.primerNombre}
                        inicial={cliente.inicial}
                        saludo={inicio.saludo}
                        onPress={() => setMenuVisible(true)}
                        indicador={cliente.noLeidas > 0}
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

                    <SelectorViaje viaje={inicio}>
                        <Button titulo="Buscar ruta" onPress={buscarRuta} />
                    </SelectorViaje>
                    <View style={styles.conteTaxisCerca}>
                        <Icono nombre="locationHistory" tamanio={25} color={Colors.primary} />
                        <AppText style={styles.textTaxis}> Taxis cerca de ti</AppText>
                        <Pressable
                            style={styles.verParaderos}
                            onPress={verTodosLosTaxis}
                            accessibilityRole="button"
                            accessibilityLabel="Ver todos los taxis disponibles"
                        >
                            <AppText style={styles.textVerParaderos}>Ver todo</AppText>
                            <Icono nombre="ArrowRight" tamanio={25} color={Colors.outlineVariant} />
                        </Pressable>
                    </View>
                    <Card>
                        <EstadoLista
                            cargando={inicio.cargandoCercanos}
                            error={inicio.errorCercanos}
                            vacio={inicio.taxisCercanos.length === 0}
                            textoCargando="Buscando taxis cercanos..."
                            textoVacio="No hay taxis cercanos con asientos disponibles."
                            onReintentar={() => void inicio.buscarCercanos()}
                        >
                            {inicio.taxisCercanos.map((taxi) => (
                                <TaxiCard
                                    key={taxi.id}
                                    nombre={`${taxi.matricula} · ${taxi.nombreTaxista}`}
                                    distancia={formatearDistancia(taxi.distanciaMetros)}
                                    asientos={taxi.asientosDisponibles}
                                    lleno={taxi.asientosDisponibles <= 0}
                                    onPress={() => elegirTaxi(taxi)}
                                />
                            ))}
                        </EstadoLista>
                    </Card>
                    <View style={styles.conteParaderoCerca}>
                        <Icono nombre="business" tamanio={22} color={Colors.primary} />
                        <AppText style={styles.textParadero}> Paraderos cercanos a ti</AppText>
                        <Pressable
                            style={styles.verParaderos}
                            onPress={() => navigation.navigate("ClienteParaderos")}
                            accessibilityRole="button"
                            accessibilityLabel="Ver todos los paraderos"
                        >
                            <AppText style={styles.textVerParaderos}>Ver todo</AppText>
                            <Icono nombre="ArrowRight" tamanio={25} color={Colors.outlineVariant} />
                        </Pressable>
                    </View>
                    <Card>
                        <EstadoLista
                            cargando={inicio.cargandoCercanos}
                            error={inicio.errorCercanos}
                            vacio={inicio.paraderosCercanos.length === 0}
                            textoCargando="Buscando paraderos cercanos..."
                            textoVacio="No hay paraderos cercanos con ubicación registrada."
                            onReintentar={() => void inicio.buscarCercanos()}
                        >
                            {inicio.paraderosCercanos.map((paradero) => (
                                <ParadaItem
                                    key={paradero.id}
                                    nombre={paradero.nombre}
                                    descripcion={[
                                        paradero.referencia,
                                        formatearTrayectoParadero(paradero),
                                    ].filter(Boolean).join(" · ")}
                                    onPress={() => navigation.navigate("ClienteParadero", {
                                        paraderoId: paradero.id,
                                        distanciaMetros: paradero.distanciaMetros,
                                        segundosCaminando: paradero.segundosCaminando,
                                        distanciaMotoMetros: paradero.distanciaMotoMetros,
                                        segundosMoto: paradero.segundosMoto,
                                    })}
                                />
                            ))}
                        </EstadoLista>
                    </Card>
                </KeyboardAwareScroll>
            </View>
            <BottomTabBar tabs={TABS_CLIENTE} activeTab="inicio" onPressTab={handlePressTab} />
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
    conteTaxisCerca: {
        flexDirection: "row",
        alignItems: "center",
        margin: 10,
    },
    textTaxis: {
        flex: 1,
        fontSize: 15,
    },
    conteParaderoCerca: {
        flexDirection: "row",
        alignItems: "center",
        margin: 10,
    },
    textParadero: {
        flex: 1,
        fontSize: 15,
    },
    verParaderos: {
        flexDirection: "row",
        alignItems: "center",
    },
    textVerParaderos: {
        color: Colors.primary,
        fontSize: 15,
    },
});

export default ClienteInicioScreen;