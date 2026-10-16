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
import { BottomTabBar, TABS_CLIENTE, BottomTabId } from "../../components/BottomTabBar";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { ClienteStackParamList } from "../../navigation/types";
import { Icono, IconoFontAwesome6 } from "../../components/Icono";
import TaxiCard from "../../components/TaxiCard";
import Card from "../../components/Card";
import ParadaItem from "../../components/ParadaItem";
import { formatearDistancia, type TaxiCercano } from "../../modules/cliente/ubicacion";
import type { ParaderoViaje, TipoPuntoViaje } from "../../modules/cliente/types";
import { useClienteInicio } from "./useClienteInicio";
import { useCliente } from "./ClienteContext";
import ClienteSideBar from "./ClienteSideBar";

type SelectorActivo = TipoPuntoViaje | null;

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

    const abrirSelector = (tipo: TipoPuntoViaje) => {
        setSelectorActivo(tipo);
        void inicio.cargarOpciones(tipo);
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

    const aOpciones =(puntos: string[]) => puntos.map((punto) => ({ id: punto, titulo: punto }));

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

                    <Card>
                        <SelectInput
                            label="Origen"
                            value={inicio.etiquetaOrigen}
                            placeholder={inicio.obteniendoUbicacion ? "Obteniendo ubicación..." : "Seleccione el origen"}
                            onPress={() => abrirSelector("origen")}
                            active={selectorActivo === "origen"}
                            iconLeft="locationHistory"
                            iconRight="ArrowDown"
                        />
                        <SelectInput
                            label="Destino"
                            value={inicio.destino ?? ""}
                            placeholder="Seleccione el destino"
                            onPress={() => abrirSelector("destino")}
                            active={selectorActivo === "destino"}
                            iconLeft="locationOn"
                            iconRight="ArrowDown"
                        />
                        <Button titulo="Buscar ruta" onPress={buscarRuta} />
                    </Card>
                    {/**ButtomSheet para origen */}
                    <BottomSheet
                        visible={selectorActivo === "origen"}
                        onClose={() => setSelectorActivo(null)}
                    >
                        <View>
                            <AppText style={styles.tituloItems}>Elige tu origen</AppText>
                            <EstadoLista
                                cargando={inicio.cargandoOpciones && inicio.opciones.origen.length === 0}
                                error={inicio.errorOpciones}
                                vacio={inicio.opciones.origen.length === 0}
                                textoCargando="Cargando orígenes..."
                                textoVacio="No hay orígenes disponibles."
                                onReintentar={() => void inicio.cargarOpciones("origen")}
                            >
                                <OptionList
                                    data={aOpciones(inicio.opciones.origen)}
                                    style={styles.listaOpciones}
                                    onSelect={(opcion) => mostrarAviso(inicio.seleccionarOrigen(opcion.titulo))}
                                    onClose={() => setSelectorActivo(null)}
                                />
                            </EstadoLista>

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
                            <EstadoLista
                                cargando={inicio.cargandoOpciones && inicio.opciones.destino.length === 0}
                                error={inicio.errorOpciones}
                                vacio={inicio.opciones.destino.length === 0}
                                textoCargando="Cargando destinos..."
                                textoVacio="No hay destinos disponibles."
                                onReintentar={() => void inicio.cargarOpciones("destino")}
                            >
                                <OptionList
                                    data={aOpciones(inicio.opciones.destino)}
                                    style={styles.listaOpciones}
                                    onSelect={(opcion) => mostrarAviso(inicio.seleccionarDestino(opcion.titulo))}
                                    onClose={() => setSelectorActivo(null)}
                                />
                            </EstadoLista>

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
                                        <AppText weight="semibold">Destino: </AppText>{inicio.destino}
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