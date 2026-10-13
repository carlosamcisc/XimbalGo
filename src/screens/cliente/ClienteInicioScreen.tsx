import { SafeAreaView } from "react-native-safe-area-context";
import { View, StyleSheet, Pressable, ActivityIndicator, RefreshControl } from "react-native";
import AppText from "../../components/AppText";
import { StatusBar } from "expo-status-bar";
import Colors from "../../theme/colors";
import UserHeader from "../../components/UserHeader";
import { ToastMessage } from "../../components/ToastMessaje";
import KeyboardAwareScroll from "../../components/KeyboardAwareScroll";
import SelectInput from "../../components/SelectInput";
import { useState, type ReactNode } from "react";
import BottomSheet from "../../components/BottomSheet";
import Button from "../../components/Button";
import OptionList from "../../components/OptionList";
import { BottomTabBar, BottomTabId } from "../../components/BottomTabBar";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { ClienteStackParamList } from "../../navigation/types";
import { Icono, IconoFontAwesome6 } from "../../components/Icono";
import TaxiCard from "../../components/TaxiCard";
import Card from "../../components/Card";
import ParadaItem from "../../components/ParadaItem";
import { formatearDistancia, type TaxiCercano } from "../../modules/cliente/ubicacion";
import type { ParaderoViaje } from "../../modules/cliente/types";
import { useClienteInicio } from "./useClienteInicio";

type SelectorActivo = "origen" | "destino" | null;

const mostrarAviso = (mensaje: string | null) => {
    if (mensaje) {
        ToastMessage.show(mensaje);
    }
};

interface EstadoListaProps {
    cargando: boolean;
    error: string | null;
    vacio: boolean;
    textoCargando: string;
    textoVacio: string;
    onReintentar: () => void;
    children: ReactNode;
}

// Muestra carga, error o vacío antes de renderizar los elementos de la lista.
const EstadoLista = ({ cargando, error, vacio, textoCargando, textoVacio, onReintentar, children }: EstadoListaProps) => {
    if (cargando) {
        return (
            <View style={styles.estadoLista}>
                <ActivityIndicator color={Colors.primary} />
                <AppText style={styles.textoEstado}>{textoCargando}</AppText>
            </View>
        );
    }
    if (error) {
        return (
            <View style={styles.estadoLista}>
                <AppText style={styles.textoEstado}>{error}</AppText>
                <Pressable onPress={onReintentar} accessibilityRole="button">
                    <AppText weight="semibold" style={styles.textoReintentar}>Reintentar</AppText>
                </Pressable>
            </View>
        );
    }
    if (vacio) {
        return (
            <View style={styles.estadoLista}>
                <AppText style={styles.textoEstado}>{textoVacio}</AppText>
            </View>
        );
    }
    return <>{children}</>;
};

type Props = NativeStackScreenProps<ClienteStackParamList, 'ClienteInicio'>;

const ClienteInicioScreen = ({ navigation }: Props) => {
    const [selectorActivo, setSelectorActivo] = useState<SelectorActivo>(null);
    const [taxiPorReservar, setTaxiPorReservar] = useState<TaxiCercano | null>(null);
    const inicio = useClienteInicio();

    const handlePressTab = (tab: BottomTabId) => {
        switch (tab) {
            case 'inicio':
                break;
            case 'rutas':
                ToastMessage.show("Rutas");
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
        setTaxiPorReservar(taxi);
    };

    const confirmarReserva = async () => {
        if (!taxiPorReservar) {
            return;
        }
        const error = await inicio.reservar(taxiPorReservar);
        if (error) {
            ToastMessage.show(error);
            return;
        }
        setTaxiPorReservar(null);
        ToastMessage.show("Reservación enviada al taxista");
        navigation.navigate("ClienteReservaciones");
    };

    const opcionesParaderos = inicio.paraderos.map((paradero) => ({
        ...paradero,
        titulo: paradero.nombre,
    }));
    const textoSinParaderos = inicio.cargandoDatos
        ? "Cargando paraderos..."
        : "No hay paraderos disponibles.";

    const usarUbicacionActual = async () => {
        setSelectorActivo(null);
        mostrarAviso(await inicio.usarUbicacionActual());
    };

    const seleccionarParaderoCercano = (paradero: ParaderoViaje) => {
        const aviso = inicio.seleccionarOrigenParadero(paradero);
        mostrarAviso(aviso ?? `${paradero.nombre} seleccionado como origen`);
    };

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
                        nombre={inicio.nombre}
                        inicial={inicio.inicial}
                        saludo={inicio.saludo}
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

                    {inicio.errorDatos && (
                        <Card>
                            <View style={styles.estadoLista}>
                                <AppText style={styles.textoEstado}>
                                    No se pudieron cargar tus datos: {inicio.errorDatos}
                                </AppText>
                                <Pressable onPress={() => void inicio.cargarDatos()} accessibilityRole="button">
                                    <AppText weight="semibold" style={styles.textoReintentar}>Reintentar</AppText>
                                </Pressable>
                            </View>
                        </Card>
                    )}

                    <Card>
                        <SelectInput
                            label="Origen"
                            value={inicio.etiquetaOrigen}
                            placeholder={inicio.obteniendoUbicacion ? "Obteniendo ubicación..." : "Seleccione el origen"}
                            onPress={() => setSelectorActivo("origen")}
                            active={selectorActivo === "origen"}
                            iconLeft="locationHistory"
                            iconRight="ArrowDown"
                        />
                        <SelectInput
                            label="Destino"
                            value={inicio.destino?.nombre ?? ""}
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
                                data={opcionesParaderos}
                                style={styles.listaOpciones}
                                emptyText={textoSinParaderos}
                                onSelect={(paradero) => mostrarAviso(inicio.seleccionarOrigenParadero(paradero))}
                                onClose={() => setSelectorActivo(null)}
                            />

                            <Button
                                titulo={inicio.obteniendoUbicacion ? "Obteniendo ubicación..." : "Mi ubicación actual"}
                                disabled={inicio.obteniendoUbicacion}
                                onPress={() => void usarUbicacionActual()}
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
                                data={opcionesParaderos}
                                style={styles.listaOpciones}
                                emptyText={textoSinParaderos}
                                onSelect={(paradero) => mostrarAviso(inicio.seleccionarDestino(paradero))}
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
                    {/**ButtomSheet para confirmar la reservación */}
                    <BottomSheet
                        visible={taxiPorReservar !== null}
                        onClose={() => !inicio.reservando && setTaxiPorReservar(null)}
                    >
                        {taxiPorReservar && (
                            <View>
                                <AppText style={styles.tituloItems}>Confirma tu reservación</AppText>
                                <View style={styles.filaResumen}>
                                    <Icono nombre="locationHistory" tamanio={20} color={Colors.primary} />
                                    <AppText style={styles.textoResumen} numberOfLines={2}>
                                        <AppText weight="semibold">Origen: </AppText>{inicio.etiquetaOrigen}
                                    </AppText>
                                </View>
                                <View style={styles.filaResumen}>
                                    <Icono nombre="locationOn" tamanio={20} color={Colors.primary} />
                                    <AppText style={styles.textoResumen} numberOfLines={2}>
                                        <AppText weight="semibold">Destino: </AppText>{inicio.destino?.nombre}
                                    </AppText>
                                </View>
                                <TaxiCard
                                    nombre={`${taxiPorReservar.matricula} · ${taxiPorReservar.nombreTaxista}`}
                                    distancia={formatearDistancia(taxiPorReservar.distanciaMetros)}
                                    asientos={taxiPorReservar.asientosDisponibles}
                                />
                                <AppText style={styles.textoEstado}>
                                    Apartaremos un asiento y el taxista recibirá tu solicitud.
                                </AppText>
                                <Button
                                    titulo={inicio.reservando ? "Reservando..." : "Reservar asiento"}
                                    disabled={inicio.reservando}
                                    onPress={() => void confirmarReserva()}
                                />
                            </View>
                        )}
                    </BottomSheet>
                    <View style={styles.conteParaderoCerca}>
                        <Icono nombre="business" tamanio={22} color={Colors.primary} />
                        <AppText style={styles.textParadero}> Paraderos cercanos a ti</AppText>
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
                                        formatearDistancia(paradero.distanciaMetros),
                                    ].filter(Boolean).join(" · ")}
                                    onPress={() => seleccionarParaderoCercano(paradero)}
                                />
                            ))}
                        </EstadoLista>
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
    listaOpciones: {
        maxHeight: 320,
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
    filaResumen: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        paddingVertical: 6,
    },
    textoResumen: {
        flex: 1,
        fontSize: 14,
        color: Colors.brandText,
    },
});

export default ClienteInicioScreen;