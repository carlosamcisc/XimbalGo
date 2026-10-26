import { useEffect, useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { Pressable, Share, StyleSheet, View } from "react-native";
import AppText from "../../components/AppText";
import Button from "../../components/Button";
import Card from "../../components/Card";
import { Icono } from "../../components/Icono";
import MapaSeguimiento from "../../components/MapaSeguimiento";
import { StatusBar } from "expo-status-bar";
import Colors from "../../theme/colors";
import { BottomTabBar, TABS_CLIENTE, BottomTabId } from "../../components/BottomTabBar";
import { ToastMessage } from "../../components/ToastMessaje";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { ClienteStackParamList } from "../../navigation/types";
import { formatearHora } from "../../modules/cliente/reservas";
import { formatearAntiguedad } from "../../modules/cliente/seguimiento";
import {
    DURACIONES_COMPARTIR,
    mensajeUbicacionCompartida,
    paginaUbicacionConfigurada,
    type UbicacionCompartida,
} from "../../modules/cliente/ubicacionCompartida";
import { useCliente } from "./ClienteContext";
import { useClienteYo } from "./useClienteYo";
import { mensajeError } from "./useClienteInicio";

type Props = NativeStackScreenProps<ClienteStackParamList, 'ClienteYo'>;

// «actualizada hace 2 min» avanza aunque no llegue otra ubicación.
const INTERVALO_RELOJ_MS = 15_000;

const ClienteYoScreen = ({ navigation }: Props) => {
    const { primerNombre, ubicacionCompartida } = useCliente();
    const { compartida, enviadaEn, iniciando, deteniendo, error: errorCompartir, iniciar, detener } =
        ubicacionCompartida;
    const { ubicacion, direccion, buscando, error, reintentar } = useClienteYo();
    const [minutos, setMinutos] = useState(DURACIONES_COMPARTIR[1].minutos);
    const [ahora, setAhora] = useState(Date.now());

    useEffect(() => {
        if (!compartida) {
            return;
        }
        const reloj = setInterval(() => setAhora(Date.now()), INTERVALO_RELOJ_MS);
        return () => clearInterval(reloj);
    }, [compartida]);

    const handlePressTab = (tab: BottomTabId) => {
        switch (tab) {
            case 'inicio':
                navigation.navigate("ClienteInicio");
                break;
            case 'rutas':
                navigation.navigate("ClienteRutas");
                break;
            case 'reservaciones':
                navigation.navigate("ClienteReservaciones");
                break;
            case 'yo':
                break;
        }
    };

    const enviarEnlace = async (actual: UbicacionCompartida) => {
        try {
            await Share.share({ message: mensajeUbicacionCompartida(primerNombre, actual) });
        } catch (e: unknown) {
            ToastMessage.show(mensajeError(e, "No se pudo abrir el menú para compartir."), "long");
        }
    };

    const handleCompartir = async () => {
        // Sin la página no hay enlace: no se empieza a enviar la ubicación.
        if (!paginaUbicacionConfigurada) {
            ToastMessage.show("Falta configurar la página para ver la ubicación compartida.", "long");
            return;
        }
        const resultado = await iniciar(minutos);
        if (typeof resultado === "string") {
            ToastMessage.show(resultado, "long");
            return;
        }
        await enviarEnlace(resultado);
    };

    const handleDetener = async () => {
        const errorDetener = await detener();
        ToastMessage.show(errorDetener ?? "Dejaste de compartir tu ubicación.", errorDetener ? "long" : "short");
    };

    const textoUbicacion = error
        ?? direccion
        ?? (buscando ? "Buscando tu ubicación..." : "Tu ubicación aparece en el mapa.");

    return (
        <SafeAreaView style={styles.statusBar} edges={['top', 'bottom']}>
            <StatusBar style="light" />
            <View style={styles.pantalla}>
                <View style={styles.containerEncabezado}>
                    <AppText weight="medium" style={styles.titulo}>Me encuentro aquí</AppText>
                    <AppText style={[styles.subTitulo, error && styles.textoError]} numberOfLines={2}>
                        {textoUbicacion}
                    </AppText>
                    {error && (
                        <Pressable onPress={reintentar} accessibilityRole="button">
                            <AppText weight="semibold" style={styles.enlace}>Reintentar</AppText>
                        </Pressable>
                    )}
                </View>

                <MapaSeguimiento
                    style={styles.mapa}
                    cliente={ubicacion ? { coordenadas: ubicacion, titulo: "Tú" } : null}
                />

                <Card style={styles.card}>
                    {compartida ? (
                        <>
                            <View style={styles.filaTitulo}>
                                <View style={styles.puntoEnVivo} />
                                <AppText weight="semibold" style={styles.tituloCard}>
                                    Compartiendo en tiempo real
                                </AppText>
                            </View>
                            <AppText style={styles.texto}>
                                Hasta las {formatearHora(compartida.expiraEn)} ·{" "}
                                {enviadaEn ? `actualizada ${formatearAntiguedad(enviadaEn, ahora)}` : "enviando..."}
                                . Mantén la app abierta para que tu familiar te siga viendo.
                            </AppText>
                            {errorCompartir && (
                                <AppText style={[styles.texto, styles.textoError]}>{errorCompartir}</AppText>
                            )}
                            <View style={styles.botones}>
                                <View style={styles.boton}>
                                    <Button titulo="Enviar enlace" onPress={() => void enviarEnlace(compartida)} />
                                </View>
                                <View style={styles.boton}>
                                    <Button
                                        titulo={deteniendo ? "Deteniendo..." : "Detener"}
                                        color={Colors.danger}
                                        borderColor={Colors.danger}
                                        disabled={deteniendo}
                                        onPress={() => void handleDetener()}
                                    />
                                </View>
                            </View>
                        </>
                    ) : (
                        <>
                            <View style={styles.filaTitulo}>
                                <Icono nombre="Share" tamanio={20} color={Colors.primary} />
                                <AppText weight="semibold" style={styles.tituloCard}>
                                    Compartir mi ubicación
                                </AppText>
                            </View>
                            <AppText style={styles.texto}>
                                Tu familiar verá dónde estás en un mapa desde un enlace, sin instalar la app.
                            </AppText>
                            <View style={styles.duraciones}>
                                {DURACIONES_COMPARTIR.map((duracion) => {
                                    const elegida = duracion.minutos === minutos;
                                    return (
                                        <Pressable
                                            key={duracion.minutos}
                                            onPress={() => setMinutos(duracion.minutos)}
                                            accessibilityRole="radio"
                                            accessibilityState={{ selected: elegida }}
                                            style={[styles.duracion, elegida && styles.duracionElegida]}
                                        >
                                            <AppText
                                                weight="medium"
                                                style={[styles.textoDuracion, elegida && styles.textoDuracionElegida]}
                                            >
                                                {duracion.etiqueta}
                                            </AppText>
                                        </Pressable>
                                    );
                                })}
                            </View>
                            <Button
                                titulo={iniciando ? "Compartiendo..." : "Compartir ubicación"}
                                disabled={iniciando}
                                onPress={() => void handleCompartir()}
                            />
                        </>
                    )}
                </Card>
            </View>
            <BottomTabBar tabs={TABS_CLIENTE} activeTab="yo" onPressTab={handlePressTab} />
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    statusBar: {
        backgroundColor: Colors.primary,
        flex: 1
    },
    pantalla: {
        backgroundColor: Colors.surface,
        flex: 1,
    },
    containerEncabezado: {
        marginHorizontal: 20,
        marginTop: 20,
        marginBottom: 12,
        gap: 4,
    },
    titulo: {
        fontSize: 20,
        color: Colors.brandDeep,
    },
    subTitulo: {
        fontSize: 15,
        color: Colors.brandText,
    },
    textoError: {
        color: Colors.error,
    },
    enlace: {
        fontSize: 15,
        color: Colors.primary,
    },
    mapa: {
        flex: 1,
        height: undefined,
        marginHorizontal: 12,
    },
    card: {
        padding: 16,
        gap: 8,
    },
    filaTitulo: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
    },
    tituloCard: {
        fontSize: 16,
        color: Colors.brandDeep,
    },
    puntoEnVivo: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: Colors.success,
    },
    texto: {
        fontSize: 13,
        lineHeight: 19,
        color: Colors.brandText,
    },
    duraciones: {
        flexDirection: "row",
        gap: 8,
    },
    duracion: {
        flex: 1,
        alignItems: "center",
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: Colors.outlineVariant,
    },
    duracionElegida: {
        borderColor: Colors.primary,
        backgroundColor: Colors.primaryContainer,
    },
    textoDuracion: {
        fontSize: 13,
        color: Colors.brandText,
    },
    textoDuracionElegida: {
        color: Colors.primary,
    },
    botones: {
        flexDirection: "row",
        gap: 8,
    },
    boton: {
        flex: 1,
    },
});

export default ClienteYoScreen;
