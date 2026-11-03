import { useEffect, useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppState, Pressable, ScrollView, Share, StyleSheet, useWindowDimensions, View } from "react-native";
import AppText from "../../components/AppText";
import Button from "../../components/Button";
import Card from "../../components/Card";
import AnimacionEstado from "../../components/AnimacionEstado";
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
import { Icono } from "../../components/Icono";

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
    const { height } = useWindowDimensions();
    const minutosRestantes = compartida
        ? Math.max(0, Math.ceil((Date.parse(compartida.expiraEn) - ahora) / 60_000))
        : 0;

    useEffect(() => {
        if (!compartida) {
            return;
        }
        setAhora(Date.now());
        const estado = AppState.addEventListener("change", (valor) => {
            if (valor === "active") setAhora(Date.now());
        });
        const reloj = setInterval(() => setAhora(Date.now()), INTERVALO_RELOJ_MS);
        return () => {
            clearInterval(reloj);
            estado.remove();
        };
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
                <ScrollView contentContainerStyle={styles.scrollContent}>
                    <View style={styles.containerEncabezado}>
                        <View style={styles.filaEncabezado}>
                            <Icono nombre="locationOn" tamanio={32} color={Colors.white} />
                            <AppText weight="bold" style={styles.titulo}>Mi ubicación</AppText>
                        </View>
                        {(error || buscando) && <View style={styles.estadoUbicacion}>
                            <Icono nombre={error ? "info" : "myLocation"} tamanio={16} color={error ? Colors.errorContainer : Colors.white} />
                            <AppText weight="medium" style={styles.estadoTexto}>
                                {error ? "Ubicación no disponible" : buscando ? "Buscando ubicación" : "Estás aquí"}
                            </AppText>
                        </View>}
                        <AppText style={[styles.subTitulo, error && styles.errorEncabezado]}>
                            {textoUbicacion}
                        </AppText>
                        {error && (
                            <Button
                                titulo="Reintentar"
                                icono="refresh"
                                posicionIcono="izquierda"
                                colorIcono={Colors.error}
                                onPress={reintentar}
                                color={Colors.errorContainer}
                                colorTitulo={Colors.error}
                            />
                        )}
                    </View>

                    <MapaSeguimiento
                        style={[styles.mapa, { height: Math.max(280, Math.min(460, height * 0.42)) }]}
                        cliente={ubicacion ? { coordenadas: ubicacion, titulo: "Tú" } : null}
                    />

                    <Card style={[styles.card, compartida && styles.cardActiva]}>
                        {compartida ? (
                            <>
                                <View style={styles.filaTitulo}>
                                    <AnimacionEstado tipo="compartirUbicacion" tamanio={48} animar />
                                    <AppText weight="semibold" style={styles.tituloCard}>
                                        Compartiendo ubicación
                                    </AppText>
                                </View>
                                <View style={styles.resumenTiempo}>
                                    <Icono nombre="timer" tamanio={24} color={Colors.primary} />
                                    <View style={styles.detalleTiempo}>
                                        <AppText weight="bold" style={styles.tiempoRestante}>
                                            {minutosRestantes > 0 ? `${minutosRestantes} min restantes` : "Tiempo finalizado"}
                                        </AppText>
                                        <AppText style={styles.texto}>Hasta las {formatearHora(compartida.expiraEn)}</AppText>
                                    </View>
                                </View>
                                <AppText style={styles.actualizacion}>
                                    {enviadaEn ? `Última actualización: ${formatearAntiguedad(enviadaEn, ahora)}` : "Enviando la primera ubicación..."}
                                </AppText>
                                <AppText style={styles.texto}>Tu ubicación se actualiza también con la pantalla bloqueada si permitiste el acceso todo el tiempo.</AppText>
                                {errorCompartir && (
                                    <AppText style={[styles.texto, styles.textoError]}>{errorCompartir}</AppText>
                                )}
                                <Button
                                    titulo="Enviar enlace"
                                    icono="Share"
                                    posicionIcono="izquierda"
                                    disabled={deteniendo || minutosRestantes === 0}
                                    onPress={() => void enviarEnlace(compartida)}
                                />
                                <Pressable
                                    onPress={() => void handleDetener()}
                                    disabled={deteniendo}
                                    accessibilityRole="button"
                                    accessibilityState={{ disabled: deteniendo }}
                                    style={({ pressed }) => [styles.detener, (pressed || deteniendo) && styles.presionado]}
                                >
                                    <Icono nombre="stop" tamanio={20} color={Colors.danger} />
                                    <AppText weight="semibold" style={styles.textoDetener}>
                                        {deteniendo ? "Deteniendo..." : "Dejar de compartir"}
                                    </AppText>
                                </Pressable>
                            </>
                        ) : (
                            <>
                                <View style={styles.filaTitulo}>
                                    <View style={styles.iconoCompartir}>
                                        <Icono nombre="locationOn" tamanio={30} color={Colors.primary} />
                                    </View>
                                    <AppText weight="bold" style={styles.tituloCard}>
                                        Comparte tu ubicación
                                    </AppText>
                                </View>
                                <AppText style={styles.texto}>
                                    Comparte un enlace para que tu familia sepa dónde estás.
                                </AppText>
                                <AppText weight="medium" style={styles.pregunta}>¿Por cuánto tiempo?</AppText>
                                <View style={styles.duraciones} accessibilityRole="radiogroup" accessibilityLabel="Duración de ubicación compartida">
                                    {DURACIONES_COMPARTIR.map((duracion) => {
                                        const elegida = duracion.minutos === minutos;
                                        return (
                                            <Pressable
                                                key={duracion.minutos}
                                                onPress={() => setMinutos(duracion.minutos)}
                                                accessibilityRole="radio"
                                                accessibilityState={{ checked: elegida, disabled: iniciando }}
                                                disabled={iniciando}
                                                style={({ pressed }) => [styles.duracion, elegida && styles.duracionElegida, (pressed || iniciando) && styles.presionado]}
                                            >
                                                {elegida && <Icono nombre="done" tamanio={18} color={Colors.secondary} />}
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
                                    icono="Share"
                                    posicionIcono="izquierda"
                                />
                                <AppText style={styles.notaCompartir}>Tu familia puede verlo sin instalar la app.</AppText>
                            </>
                        )}
                    </Card>
                </ScrollView>
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
        backgroundColor: Colors.surfaceBright,
        flex: 1,
    },
    scrollContent: {
        paddingBottom: 120,
    },
    containerEncabezado: {
        backgroundColor: Colors.primary,
        paddingHorizontal: 20,
        paddingTop: 24,
        paddingBottom: 24,
        marginBottom: 16,
        gap: 8,
        borderBottomLeftRadius: 10,
        borderBottomRightRadius: 10,
    },
    titulo: {
        fontSize: 28,
        flex: 1,
        color: Colors.white,
    },
    subTitulo: {
        fontSize: 16,
        lineHeight: 23,
        color: Colors.brandSubtitle,
    },
    textoError: {
        color: Colors.error,
    },
    enlace: {
        fontSize: 15,
        color: Colors.white,
    },
    errorEncabezado: { color: Colors.errorContainer },
    mapa: {
        marginHorizontal: 16,
    },
    card: {
        padding: 18,
        marginHorizontal: 16,
        marginTop: 16,
        gap: 10,
        borderRadius: 24,
        elevation: 0,
        shadowOpacity: 0,
    },
    filaTitulo: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
    },
    tituloCard: {
        flex: 1,
        fontSize: 19,
        color: Colors.brandDeep,
    },
    texto: {
        fontSize: 15,
        lineHeight: 22,
        color: Colors.brandText,
    },
    duraciones: {
        flexDirection: "row",
        gap: 8,
    },
    duracion: {
        flex: 1,
        flexDirection: "row",
        justifyContent: "center",
        flexWrap: "wrap",
        gap: 5,
        alignItems: "center",
        paddingVertical: 14,
        minHeight: 48,
        borderRadius: 28,
        borderWidth: 1,
        borderColor: Colors.outlineVariant,
    },
    duracionElegida: {
        borderColor: Colors.secondary,
        backgroundColor: Colors.primaryContainer,
    },
    textoDuracion: {
        fontSize: 13,
        color: Colors.brandText,
    },
    textoDuracionElegida: {
        color: Colors.secondary,
    },
    estadoUbicacion: {
        flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8,
    },
    filaEncabezado: { flexDirection: "row", alignItems: "center", gap: 10 },
    iconoCompartir: {
        width: 48, height: 48, borderRadius: 24,
        alignItems: "center", justifyContent: "center", backgroundColor: Colors.primaryContainer,
    },
    notaCompartir: { fontSize: 13, lineHeight: 19, textAlign: "center", color: Colors.outline },
    estadoTexto: { fontSize: 13, color: Colors.white },
    cardActiva: { borderColor: Colors.primaryFixedDim },
    pregunta: { fontSize: 14, color: Colors.brandDeep, marginTop: 8 },
    resumenTiempo: {
        flexDirection: "row", alignItems: "center", gap: 12,
        padding: 14, borderRadius: 16, backgroundColor: Colors.primaryContainer,
    },
    detalleTiempo: { flex: 1, gap: 4 },
    tiempoRestante: { fontSize: 22, color: Colors.brandDeep },
    actualizacion: { fontSize: 12, color: Colors.onSurfaceVariant },
    detener: {
        flexDirection: "row", alignItems: "center", justifyContent: "center",
        gap: 8, minHeight: 48, paddingVertical: 12, borderRadius: 16,
    },
    textoDetener: { fontSize: 14, color: Colors.danger, flexShrink: 1 },
    presionado: { opacity: 0.6 },
});

export default ClienteYoScreen;
