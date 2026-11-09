import { SafeAreaView } from "react-native-safe-area-context";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { TaxistaStackParamList } from "../../navigation/types";
import EncabezadoPantalla from "../../components/EncabezadoPantalla";
import AppText from "../../components/AppText";
import Button from "../../components/Button";
import Colors from "../../theme/colors";
import { ContenidoReservaTaxista } from "./DetalleReservaTaxista";
import PanelesReservaTaxista from "./PanelesReservaTaxista";
import { useTaxista } from "./TaxistaContext";
import { useAccionReserva } from "./useAccionReserva";
import { useReservaTaxista } from "./useReservaTaxista";

type Props = NativeStackScreenProps<TaxistaStackParamList, "TaxistaReserva">;

export default function TaxistaReservaScreen({ navigation, route }: Props) {
  const { procesandoReservaId } = useTaxista();
  const acciones = useAccionReserva();
  const detalle = useReservaTaxista(route.params.reservaId, route.params.notificacionId, procesandoReservaId);
  const volver = () => navigation.canGoBack() ? navigation.goBack() : navigation.navigate("TaxistaViajes");
  return (
    <SafeAreaView style={styles.raiz} edges={["top", "bottom"]}>
      <StatusBar style="light" />
      <EncabezadoPantalla titulo="Detalle del viaje" onBack={volver} />
      <View style={styles.contenido}>
        {detalle.cargando && <ActivityIndicator color={Colors.primary} />}
        {detalle.error && <View>
          <AppText style={styles.error}>{detalle.error}</AppText>
          <Button titulo="Reintentar" onPress={() => void detalle.cargar()} />
        </View>}
        {detalle.reserva && <ContenidoReservaTaxista reserva={detalle.reserva} acciones={acciones} />}
      </View>
      <PanelesReservaTaxista acciones={acciones} reservaActual={detalle.reserva} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  raiz: { flex: 1, backgroundColor: Colors.primary },
  contenido: { flex: 1, backgroundColor: Colors.surface, padding: 20 },
  error: { color: Colors.onSurfaceVariant, textAlign: "center", marginBottom: 12 },
});
