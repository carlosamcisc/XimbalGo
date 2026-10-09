import { useCallback, useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    Pressable,
    RefreshControl,
    StyleSheet,
    View,
} from "react-native";
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
import BottomSheet from "../../components/BottomSheet";
import { Icono } from "../../components/Icono";
import Colors from "../../theme/colors";
import { ToastMessage } from "../../components/ToastMessaje";
import {
    obtenerParaderosActivos,
    obtenerParaderosCercanos,
    obtenerPerfilCliente,
} from "../../infrastructure/supabase/repositories/cliente.repository";
import { obtenerTaxisCercanos } from "../../infrastructure/supabase/repositories/vehiculos.repository";
import {
    obtenerDireccionActual,
    obtenerUbicacionActual,
} from "../../infrastructure/location/location.service";
import { useAutenticacionStore } from "../../store/autenticacionStore";
import {
    formatearDistancia,
    type Coordenadas,
    type ParaderoCercano,
    type TaxiCercano,
} from "../../modules/cliente/ubicacion";

const ORIGEN_UBICACION_ACTUAL = "ubicacion-actual";

const ClienteInicioScreen = () => {
    const { usuario } = useAutenticacionStore();
    const usuarioId = usuario?.id ?? null;
    const [perfil, setPerfil] = useState<
        Awaited<ReturnType<typeof obtenerPerfilCliente>> | null
    >(null);
    const [paraderos, setParaderos] = useState<
        Awaited<ReturnType<typeof obtenerParaderosActivos>>
    >([]);
    const [taxisCercanos, setTaxisCercanos] = useState<TaxiCercano[]>([]);
    const [paraderosCercanos, setParaderosCercanos] = useState<ParaderoCercano[]>([]);
    const [cargando, setCargando] = useState(true);
    const [cargandoCercanos, setCargandoCercanos] = useState(false);
    const [solicitandoGps, setSolicitandoGps] = useState(false);
    const [mostrarUbicacion, setMostrarUbicacion] = useState(false);
    const [cargandoDireccion, setCargandoDireccion] = useState(false);
    const [direccionGps, setDireccionGps] = useState<string | null>(null);
    const [errorDireccion, setErrorDireccion] = useState<string | null>(null);
    const [coordenadasGps, setCoordenadasGps] = useState<Coordenadas | null>(null);
    const [errorCarga, setErrorCarga] = useState<string | null>(null);
    const [errorCercanos, setErrorCercanos] = useState<string | null>(null);
    const ubicacionGps = useRef<Coordenadas | null>(null);
    const [reintentoCercano, setReintentoCercano] = useState(0);
    const solicitudActual = useRef(0);
    const solicitudesCercanos = useRef(0);
    const solicitudUbicacion = useRef(0);

    const [origen, setOrigen] = useState("");
    const [destino, setDestino] = useState("");

    const cargarDatos = useCallback(async () => {
        const solicitud = ++solicitudActual.current;
        setCargando(true);
        setErrorCarga(null);

        if (!usuarioId) {
            setErrorCarga("No se encontró una sesión de cliente activa.");
            setCargando(false);
            return;
        }

        try {
            const [perfilCliente, paraderosActivos] =
                await Promise.all([
                    obtenerPerfilCliente(usuarioId),
                    obtenerParaderosActivos(),
                ]);

            if (solicitud !== solicitudActual.current) {
                return;
            }

            setPerfil(perfilCliente);
            setParaderos(paraderosActivos);
            setOrigen((actual) =>
                actual === ORIGEN_UBICACION_ACTUAL ||
                paraderosActivos.some((paradero) => paradero.id === actual)
                    ? actual
                    : ""
            );
            setDestino((actual) =>
                paraderosActivos.some((paradero) => paradero.id === actual)
                    ? actual
                    : ""
            );
        } catch (error: unknown) {
            if (solicitud !== solicitudActual.current) {
                return;
            }

            setErrorCarga(
                error instanceof Error
                    ? error.message
                    : "Ocurrió un error desconocido al cargar los datos."
            );
        } finally {
            if (solicitud === solicitudActual.current) {
                setCargando(false);
            }
        }
    }, [usuarioId]);

    const seleccionarOrigen = useCallback(async (valor: string) => {
        const solicitud = ++solicitudUbicacion.current;

        if (valor === ORIGEN_UBICACION_ACTUAL) {
            setDireccionGps(null);
            setErrorDireccion(null);
            setCargandoDireccion(true);
            setSolicitandoGps(true);
            try {
                const ubicacion = await obtenerUbicacionActual();
                if (solicitud !== solicitudUbicacion.current) {
                    return;
                }

                ubicacionGps.current = ubicacion;
                setCoordenadasGps(ubicacion);
                setOrigen(valor);
                setMostrarUbicacion(true);

                try {
                    const direccion = await obtenerDireccionActual(ubicacion);
                    if (solicitud !== solicitudUbicacion.current) {
                        return;
                    }

                    setDireccionGps(direccion);
                    if (!direccion) {
                        setErrorDireccion(
                            "No se encontró una dirección para esta ubicación."
                        );
                    }
                } catch (error: unknown) {
                    if (solicitud !== solicitudUbicacion.current) {
                        return;
                    }

                    setErrorDireccion(
                        error instanceof Error
                            ? error.message
                            : "No se pudo consultar la dirección de esta ubicación."
                    );
                } finally {
                    if (solicitud === solicitudUbicacion.current) {
                        setCargandoDireccion(false);
                    }
                }
            } catch (error: unknown) {
                if (solicitud === solicitudUbicacion.current) {
                    setCargandoDireccion(false);
                    ToastMessage.show(
                        error instanceof Error
                            ? error.message
                            : "No se pudo obtener tu ubicación actual."
                    );
                }
            } finally {
                if (solicitud === solicitudUbicacion.current) {
                    setSolicitandoGps(false);
                }
            }
            return;
        }

        setMostrarUbicacion(false);
        setCargandoDireccion(false);
        setSolicitandoGps(false);
        if (valor && valor === destino) {
            setDestino("");
            ToastMessage.show("El origen y el destino deben ser distintos.");
        }
        setOrigen(valor);
    }, [destino]);

    const seleccionarDestino = useCallback((valor: string) => {
        if (valor && valor === origen) {
            ToastMessage.show("El origen y el destino deben ser distintos.");
            return;
        }
        setDestino(valor);
    }, [origen]);

    useEffect(() => {
        if (!origen || !destino) {
            setTaxisCercanos([]);
            setParaderosCercanos([]);
            setErrorCercanos(null);
            setCargandoCercanos(false);
            return;
        }

        let activa = true;
        const solicitud = ++solicitudesCercanos.current;

        const cargarCercanos = async () => {
            setCargandoCercanos(true);
            setErrorCercanos(null);

            try {
                const ubicacion =
                    ubicacionGps.current ?? await obtenerUbicacionActual();
                if (!activa) {
                    return;
                }

                if (!ubicacionGps.current) {
                    ubicacionGps.current = ubicacion;
                }

                const [taxis, paraderosProximos] = await Promise.all([
                    obtenerTaxisCercanos(ubicacion, 5),
                    obtenerParaderosCercanos(ubicacion, 5),
                ]);

                if (!activa || solicitud !== solicitudesCercanos.current) {
                    return;
                }

                setTaxisCercanos(taxis);
                setParaderosCercanos(paraderosProximos);
            } catch (error: unknown) {
                if (!activa || solicitud !== solicitudesCercanos.current) {
                    return;
                }

                setTaxisCercanos([]);
                setParaderosCercanos([]);
                setErrorCercanos(
                    error instanceof Error
                        ? error.message
                        : "No se pudieron buscar taxis y paraderos cercanos."
                );
            } finally {
                if (activa && solicitud === solicitudesCercanos.current) {
                    setCargandoCercanos(false);
                }
            }
        };

        void cargarCercanos();

        return () => {
            activa = false;
        };
    }, [origen, destino, reintentoCercano]);

    useEffect(() => {
        void cargarDatos();

        return () => {
            solicitudActual.current += 1;
        };
    }, [cargarDatos]);

    const nombre = perfil
        ? `${perfil.nombres} ${perfil.apellidos}`.trim()
        : "Cliente";
    const inicial = nombre.charAt(0).toUpperCase() || "?";
    const saludo = "¡Buenos días!";
    const ubicaciones = paraderos.map((paradero) => ({
        label: paradero.nombre,
        value: paradero.id,
    }));
    const opcionesOrigen = [
        { label: "Mi ubicación actual", value: ORIGEN_UBICACION_ACTUAL },
        ...ubicaciones,
    ];

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
                <KeyBoardAwareScroll
                    contentContainerStyle={styles.scrollContent}
                    refreshControl={
                        <RefreshControl
                            refreshing={cargando}
                            onRefresh={() => {
                                void cargarDatos();
                                if (origen && destino) {
                                    setReintentoCercano((intento) => intento + 1);
                                }
                            }}
                            tintColor={Colors.primary}
                        />
                    }
                >
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
                                options={opcionesOrigen}
                                value={origen}
                                onChange={(valor) => void seleccionarOrigen(valor)}
                                placeholder={
                                    solicitandoGps
                                        ? "Obteniendo ubicación..."
                                        : cargando
                                        ? "Cargando paraderos..."
                                        : "Seleccionar paradero de origen"
                                }
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
                                onChange={seleccionarDestino}
                                placeholder={
                                    cargando
                                        ? "Cargando paraderos..."
                                        : "Seleccionar paradero de destino"
                                }
                                iconLeft="locationDot"
                            />
                        </Card>
                    </View>

                    {errorCarga && (
                        <View style={styles.loadError}>
                            <AppText style={styles.loadErrorText}>
                                No se pudieron cargar los datos del inicio: {errorCarga}
                            </AppText>
                            <Pressable
                                onPress={() => void cargarDatos()}
                                accessibilityRole="button"
                                accessibilityLabel="Reintentar cargar los datos"
                            >
                                <AppText weight="semibold" style={styles.retryText}>
                                    Reintentar
                                </AppText>
                            </Pressable>
                        </View>
                    )}

                    {errorCercanos && (
                        <View style={styles.loadError}>
                            <AppText style={styles.loadErrorText}>
                                No se pudieron buscar opciones cercanas: {errorCercanos}
                            </AppText>
                            <Pressable
                                onPress={() =>
                                    setReintentoCercano((intento) => intento + 1)
                                }
                                accessibilityRole="button"
                                accessibilityLabel="Reintentar búsqueda de opciones cercanas"
                            >
                                <AppText weight="semibold" style={styles.retryText}>
                                    Reintentar
                                </AppText>
                            </Pressable>
                        </View>
                    )}

                    <View style={styles.section}>
                        <View style={styles.sectionHeading}>
                            <View style={styles.sectionIcon}>
                                <Icono nombre="localTaxi" tamanio={21} color={Colors.primary} />
                            </View>
                            <View style={styles.sectionHeadingText}>
                                <View style={styles.titleWithBadge}>
                                    <AppText weight="bold" style={styles.sectionTitle}>
                                        Taxis cercanos
                                    </AppText>
                                    <Badge
                                        value={taxisCercanos.length}
                                        size={23}
                                        backgroundColor={Colors.brandAccentContainer}
                                        textColor={Colors.brandAccentStrong}
                                    />
                                </View>
                                <AppText style={styles.sectionSubtitle}>
                                    Ordenados por distancia
                                </AppText>
                            </View>
                        </View>
                        <Card style={styles.listCard}>
                            {cargandoCercanos ? (
                                <View style={styles.listState}>
                                    <ActivityIndicator color={Colors.primary} />
                                    <AppText style={styles.emptyText}>
                                        Buscando taxis cercanos...
                                    </AppText>
                                </View>
                            ) : !origen || !destino ? (
                                <AppText style={styles.emptyText}>
                                    Selecciona origen y destino para buscar taxis cercanos.
                                </AppText>
                            ) : taxisCercanos.length === 0 && !errorCercanos ? (
                                <AppText style={styles.emptyText}>
                                    No hay taxis cercanos con asientos disponibles.
                                </AppText>
                            ) : taxisCercanos.length === 0 ? (
                                <AppText style={styles.emptyText}>
                                    No se pudieron cargar los taxis cercanos.
                                </AppText>
                            ) : (
                                taxisCercanos.map((taxi) => (
                                    <TaxiCard
                                        key={taxi.id}
                                        nombre={`Taxi ${taxi.matricula} · ${taxi.nombreTaxista}`}
                                        distancia={formatearDistancia(taxi.distanciaMetros)}
                                        asientos={taxi.asientosDisponibles}
                                    />
                                ))
                            )}
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
                                    Ordenados por distancia
                                </AppText>
                            </View>
                        </View>
                        <Card style={styles.listCard}>
                            {cargandoCercanos ? (
                                <View style={styles.listState}>
                                    <ActivityIndicator color={Colors.primary} />
                                    <AppText style={styles.emptyText}>
                                        Buscando paraderos cercanos...
                                    </AppText>
                                </View>
                            ) : !origen || !destino ? (
                                <AppText style={styles.emptyText}>
                                    Selecciona origen y destino para buscar paraderos cercanos.
                                </AppText>
                            ) : paraderosCercanos.length === 0 && !errorCercanos ? (
                                <AppText style={styles.emptyText}>
                                    No hay paraderos cercanos con ubicación registrada.
                                </AppText>
                            ) : paraderosCercanos.length === 0 ? (
                                <AppText style={styles.emptyText}>
                                    No se pudieron cargar los paraderos cercanos.
                                </AppText>
                            ) : (
                                paraderosCercanos.map((paradero) => (
                                    <ParadaItem
                                        key={paradero.id}
                                        nombre={paradero.nombre}
                                        descripcion={[
                                            paradero.referencia,
                                            formatearDistancia(paradero.distanciaMetros),
                                        ].filter(Boolean).join(" · ")}
                                        onPress={() => {
                                            void seleccionarOrigen(paradero.id);
                                            ToastMessage.show(
                                                `${paradero.nombre} seleccionado como origen`
                                            );
                                        }}
                                    />
                                ))
                            )}
                        </Card>
                    </View>
                </KeyBoardAwareScroll>
            </View>
            <BottomTabBar activeTab="inicio" onPressTab={handlePressTab} />
            <BottomSheet
                visible={mostrarUbicacion}
                onClose={() => setMostrarUbicacion(false)}
            >
                <View style={styles.locationHeading}>
                    <View style={styles.locationIcon}>
                        <Icono nombre="myLocation" tamanio={23} color={Colors.primary} />
                    </View>
                    <View style={styles.locationHeadingText}>
                        <AppText weight="bold" style={styles.locationTitle}>
                            Estás aquí
                        </AppText>
                        <AppText style={styles.locationSubtitle}>
                            Esta ubicación se usará como origen de tu viaje.
                        </AppText>
                    </View>
                </View>

                <View style={styles.addressCard}>
                    {cargandoDireccion ? (
                        <View style={styles.addressLoading}>
                            <ActivityIndicator color={Colors.primary} />
                            <AppText style={styles.addressText}>
                                Buscando el nombre del lugar...
                            </AppText>
                        </View>
                    ) : (
                        <>
                            <AppText weight="semibold" style={styles.addressText}>
                                {direccionGps ??
                                    errorDireccion ??
                                    "No se encontró una dirección para esta ubicación."}
                            </AppText>
                            {coordenadasGps && (
                                <AppText style={styles.coordinatesText}>
                                    {`Latitud ${coordenadasGps.latitud.toFixed(5)} · Longitud ${coordenadasGps.longitud.toFixed(5)}`}
                                </AppText>
                            )}
                        </>
                    )}
                    {!cargandoDireccion && errorDireccion && direccionGps && (
                        <AppText style={styles.addressError}>
                            {errorDireccion}
                        </AppText>
                    )}
                </View>

                <Pressable
                    style={styles.locationButton}
                    onPress={() => setMostrarUbicacion(false)}
                    accessibilityRole="button"
                    accessibilityLabel="Cerrar detalle de ubicación"
                >
                    <AppText weight="semibold" style={styles.locationButtonText}>
                        Listo
                    </AppText>
                </Pressable>
            </BottomSheet>
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
    loadError: {
        marginTop: 16,
        marginHorizontal: 20,
        padding: 14,
        borderRadius: 14,
        backgroundColor: Colors.errorContainerSoft,
    },
    loadErrorText: {
        color: Colors.error,
        fontSize: 13,
    },
    retryText: {
        marginTop: 8,
        color: Colors.primary,
    },
    listState: {
        alignItems: "center",
        paddingVertical: 18,
        gap: 8,
    },
    emptyText: {
        paddingVertical: 14,
        color: Colors.onSurfaceVariant,
        textAlign: "center",
        fontSize: 13,
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
    locationHeading: {
        flexDirection: "row",
        alignItems: "center",
    },
    locationIcon: {
        width: 48,
        height: 48,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 16,
        backgroundColor: Colors.primaryContainer,
    },
    locationHeadingText: {
        flex: 1,
        marginLeft: 13,
    },
    locationTitle: {
        color: Colors.brandText,
        fontSize: 18,
    },
    locationSubtitle: {
        marginTop: 3,
        color: Colors.onSurfaceVariant,
        fontSize: 12,
        lineHeight: 18,
    },
    addressCard: {
        marginTop: 20,
        padding: 16,
        borderWidth: 1,
        borderColor: Colors.surfaceBorder,
        borderRadius: 18,
        backgroundColor: Colors.surfaceSoft,
    },
    addressLoading: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
    },
    addressText: {
        color: Colors.onSurface,
        fontSize: 15,
        lineHeight: 22,
    },
    coordinatesText: {
        marginTop: 10,
        color: Colors.onSurfaceVariant,
        fontSize: 11,
    },
    addressError: {
        marginTop: 8,
        color: Colors.error,
        fontSize: 12,
        lineHeight: 17,
    },
    locationButton: {
        alignItems: "center",
        justifyContent: "center",
        marginTop: 18,
        minHeight: 50,
        borderRadius: 16,
        backgroundColor: Colors.primary,
        marginBottom: 30,
    },
    locationButtonText: {
        color: Colors.onPrimary,
        fontSize: 15,
    },
});

export default ClienteInicioScreen;
