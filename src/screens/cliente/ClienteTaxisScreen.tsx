import { SafeAreaView } from "react-native-safe-area-context";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import AppText from "../../components/AppText";
import Card from "../../components/Card";
import EncabezadoPantalla from "../../components/EncabezadoPantalla";
import TaxiCard from "../../components/TaxiCard";
import { Icono } from "../../components/Icono";
import { ToastMessage } from "../../components/ToastMessaje";
import Colors from "../../theme/colors";
import type { ClienteStackParamList } from "../../navigation/types";
import { etiquetaOrigen, formatearPrecio } from "../../modules/cliente/reservas";
import { normalizarTexto } from "../../modules/cliente/rutas";
import { formatearDistancia, type TaxiDisponible } from "../../modules/cliente/ubicacion";
import { useClienteTaxis } from "./useClienteTaxis";

type Props = NativeStackScreenProps<ClienteStackParamList, "ClienteTaxis">;

const coincide = (taxi: TaxiDisponible, busqueda: string) => {
  const texto = normalizarTexto(busqueda);
  return !texto || [taxi.matricula, taxi.nombreTaxista, taxi.ruta]
    .some((campo) => campo && normalizarTexto(campo).includes(texto));
};

const ClienteTaxisScreen = ({ navigation, route }: Props) => {
  const origen = route.params?.origen;
  const destino = route.params?.destino;
  const lista = useClienteTaxis();
  const [busqueda, setBusqueda] = useState("");

  const taxis = lista.taxis.filter((taxi) => coincide(taxi, busqueda));

  const elegir = (taxi: TaxiDisponible) => {
    if (!origen || !destino) {
      ToastMessage.show("Elige tu origen y destino en Inicio para reservar.");
      navigation.popTo("ClienteInicio");
      return;
    }
    navigation.navigate("ClienteReservar", {
      vehiculoId: taxi.id,
      origen,
      destino,
      distanciaMetros: taxi.distanciaMetros ?? undefined,
    });
  };

  const renderContenido = () => {
    if (lista.cargando) {
      return (
        <View style={styles.estado}>
          <ActivityIndicator color={Colors.primary} />
          <AppText style={styles.textoEstado}>Buscando taxis disponibles...</AppText>
        </View>
      );
    }
    if (lista.error) {
      return (
        <View style={styles.estado}>
          <AppText style={styles.textoEstado}>{lista.error}</AppText>
          <Pressable onPress={() => void lista.cargar()} accessibilityRole="button">
            <AppText weight="semibold" style={styles.enlace}>Reintentar</AppText>
          </Pressable>
        </View>
      );
    }
    if (taxis.length === 0) {
      return (
        <View style={styles.estado}>
          <Icono nombre="localTaxi" tamanio={36} color={Colors.outlineVariant} />
          <AppText style={styles.textoEstado}>
            {busqueda.trim()
              ? `No hay taxis que coincidan con «${busqueda.trim()}».`
              : "Ahora no hay taxis en servicio con asientos disponibles."}
          </AppText>
        </View>
      );
    }
    return taxis.map((taxi) => {
      const precio = formatearPrecio(taxi.precio);
      return (
        <TaxiCard
          key={taxi.id}
          nombre={`${taxi.matricula} · ${taxi.nombreTaxista}`}
          distancia={taxi.distanciaMetros !== null ? formatearDistancia(taxi.distanciaMetros) : undefined}
          detalle={[taxi.ruta, precio && `${precio} por asiento`].filter(Boolean).join(" · ") || undefined}
          asientos={taxi.asientosDisponibles}
          lleno={taxi.asientosDisponibles <= 0}
          onPress={() => elegir(taxi)}
        />
      );
    });
  };

  return (
    <SafeAreaView style={styles.statusBar} edges={["top", "bottom"]}>
      <StatusBar style="light" />
      <EncabezadoPantalla
        titulo="Taxis disponibles"
        subtitulo="Elige cualquier taxi para reservar"
        onBack={() => navigation.goBack()}
      />
      <View style={styles.pantalla}>
        <View style={styles.buscador}>
          <Icono nombre="search" tamanio={20} color={Colors.outline} />
          <TextInput
            style={styles.inputBusqueda}
            value={busqueda}
            onChangeText={setBusqueda}
            placeholder="Buscar por matrícula, taxista o ruta"
            placeholderTextColor={Colors.outline}
            autoCorrect={false}
            returnKeyType="search"
            accessibilityLabel="Buscar taxi"
          />
          {busqueda.length > 0 && (
            <Pressable onPress={() => setBusqueda("")} accessibilityRole="button" accessibilityLabel="Limpiar búsqueda">
              <Icono nombre="close" tamanio={20} color={Colors.outline} />
            </Pressable>
          )}
        </View>
        <AppText style={styles.trayecto} numberOfLines={2}>
          {origen && destino
            ? `${etiquetaOrigen(origen)} → ${destino}`
            : "Elige tu origen y destino en Inicio para poder reservar."}
          {!lista.cargando && !lista.conDistancia && " Sin tu ubicación no se muestran distancias."}
        </AppText>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={lista.refrescando}
              onRefresh={() => void lista.refrescar()}
              tintColor={Colors.primary}
              colors={[Colors.primary]}
            />
          }
        >
          <Card>{renderContenido()}</Card>
        </ScrollView>
      </View>
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
  trayecto: {
    fontSize: 13,
    color: Colors.onSurfaceVariant,
    marginHorizontal: 16,
    marginTop: 10,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  estado: {
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
});

export default ClienteTaxisScreen;
