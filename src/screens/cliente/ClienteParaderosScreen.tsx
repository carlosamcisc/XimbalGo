import { SafeAreaView } from "react-native-safe-area-context";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import AppText from "../../components/AppText";
import Card from "../../components/Card";
import EncabezadoPantalla from "../../components/EncabezadoPantalla";
import { Icono } from "../../components/Icono";
import ParadaItem from "../../components/ParadaItem";
import Colors from "../../theme/colors";
import type { ClienteStackParamList } from "../../navigation/types";
import { useClienteParaderos } from "./useClienteParaderos";

type Props = NativeStackScreenProps<ClienteStackParamList, "ClienteParaderos">;

const ClienteParaderosScreen = ({ navigation }: Props) => {
  const lista = useClienteParaderos();

  const renderContenido = () => {
    if (lista.cargando && lista.total === 0) {
      return (
        <View style={styles.estado}>
          <ActivityIndicator color={Colors.primary} />
          <AppText style={styles.textoEstado}>Cargando paraderos...</AppText>
        </View>
      );
    }
    if (lista.error && lista.total === 0) {
      return (
        <View style={styles.estado}>
          <AppText style={styles.textoEstado}>{lista.error}</AppText>
          <Pressable onPress={() => void lista.cargar()} accessibilityRole="button">
            <AppText weight="semibold" style={styles.enlace}>Reintentar</AppText>
          </Pressable>
        </View>
      );
    }
    if (lista.paraderos.length === 0) {
      return (
        <View style={styles.estado}>
          <AppText style={styles.textoEstado}>
            {lista.total === 0
              ? "No hay paraderos disponibles."
              : "Ningún paradero coincide con tu búsqueda."}
          </AppText>
        </View>
      );
    }

    return lista.paraderos.map((paradero) => (
      <ParadaItem
        key={paradero.id}
        nombre={paradero.nombre}
        descripcion={paradero.referencia ?? ""}
        fotoUrl={paradero.fotoUrl}
        onPress={() => navigation.navigate("ClienteParadero", { paraderoId: paradero.id })}
      />
    ));
  };

  return (
    <SafeAreaView style={styles.statusBar} edges={["top", "bottom"]}>
      <StatusBar style="light" />
      <EncabezadoPantalla
        titulo="Paraderos"
        subtitulo={lista.total > 0 ? `${lista.total} paraderos disponibles` : "Conoce dónde abordar"}
        onBack={() => navigation.goBack()}
      />
      <View style={styles.pantalla}>
        <View style={styles.buscador}>
          <Icono nombre="search" tamanio={20} color={Colors.outline} />
          <TextInput
            style={styles.inputBusqueda}
            value={lista.busqueda}
            onChangeText={lista.setBusqueda}
            placeholder="Buscar por nombre o referencia"
            placeholderTextColor={Colors.outline}
            autoCorrect={false}
            returnKeyType="search"
            accessibilityLabel="Buscar paradero"
          />
          {lista.busqueda.length > 0 && (
            <Pressable onPress={() => lista.setBusqueda("")} accessibilityRole="button" accessibilityLabel="Limpiar búsqueda">
              <Icono nombre="close" tamanio={20} color={Colors.outline} />
            </Pressable>
          )}
        </View>
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

export default ClienteParaderosScreen;
