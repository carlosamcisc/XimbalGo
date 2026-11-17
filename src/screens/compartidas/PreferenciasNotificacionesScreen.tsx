import { SafeAreaView } from "react-native-safe-area-context";
import { ActivityIndicator, ScrollView, StyleSheet, Switch, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import AppText from "../../components/AppText";
import Button from "../../components/Button";
import Card from "../../components/Card";
import EncabezadoPantalla from "../../components/EncabezadoPantalla";
import Colors from "../../theme/colors";
import { usePreferenciasNotificaciones } from "./usePreferenciasNotificaciones";
import type { CampoPreferencia } from "../../modules/notificaciones/types";

const ETIQUETA_PERMISO = {
  permitido: "Notificaciones permitidas en este teléfono.",
  provisional: "Permiso provisional: los avisos pueden aparecer sin sonido ni banner.",
  pendiente: "Permite las notificaciones para recibir avisos con la app cerrada.",
  bloqueado: "Las notificaciones están desactivadas en los ajustes de este teléfono.",
  no_disponible: "Los avisos push requieren la compilación de Ximbal Go para Android o iPhone.",
};

export default function PreferenciasNotificacionesScreen({ navigation }: { navigation: { goBack(): void } }) {
  const estado = usePreferenciasNotificaciones();
  const fila = (campo: CampoPreferencia, titulo: string, descripcion: string) => (
    <View style={styles.fila} key={campo}>
      <View style={styles.textos}>
        <AppText weight="semibold">{titulo}</AppText>
        <AppText style={styles.descripcion}>{descripcion}</AppText>
      </View>
      <Switch accessibilityLabel={titulo} value={estado.preferencias?.[campo] ?? false}
        disabled={!estado.preferencias || estado.ocupado || (campo !== "push_habilitado" && !estado.preferencias.push_habilitado)}
        trackColor={{ true: Colors.primary, false: Colors.outline }}
        onValueChange={valor => void estado.cambiar(campo, valor)} />
    </View>
  );
  return (
    <SafeAreaView style={styles.raiz} edges={["top", "bottom"]}>
      <StatusBar style="light" />
      <EncabezadoPantalla titulo="Preferencias de avisos" onBack={() => navigation.goBack()} />
      <ScrollView style={styles.fondo} contentContainerStyle={styles.contenido}>
        <Card>
          <AppText weight="semibold">Permiso de este teléfono</AppText>
          <AppText style={styles.descripcion}>{estado.permiso ? ETIQUETA_PERMISO[estado.permiso] : estado.errorPermiso ?? "Consultando permiso..."}</AppText>
          {estado.permiso && estado.permiso !== "no_disponible" && <>
            {estado.permiso !== "bloqueado" && <Button titulo={estado.ocupado ? "Procesando..." : estado.permiso === "pendiente" ? "Activar notificaciones" : "Sincronizar este teléfono"}
              disabled={estado.ocupado} onPress={() => void estado.activar()} />}
            <Button titulo="Abrir ajustes del teléfono" disabled={estado.ocupado} onPress={() => void estado.abrirAjustes()} />
          </>}
          {estado.errorPermiso && <Button titulo="Reintentar" disabled={estado.ocupado} onPress={() => void estado.cargar()} />}
        </Card>
        <AppText style={styles.descripcion}>Estas preferencias se aplican a todos los teléfonos de tu cuenta. Los avisos seguirán guardándose en tu bandeja aunque silencies los push.</AppText>
        {estado.cargando && <ActivityIndicator color={Colors.primary} />}
        {estado.error && <Card><AppText>{estado.error}</AppText>
          <Button titulo="Reintentar" disabled={estado.ocupado} onPress={() => void estado.cargar()} /></Card>}
        {estado.preferencias && <Card>
          {fila("push_habilitado", "Recibir notificaciones push", "Activa o silencia todos los avisos de esta cuenta.")}
          {fila("reservas", "Reservas", estado.rol === "taxista" ? "Solicitudes y respuestas de tus clientes." : "Respuestas, cancelaciones y ofertas de asientos.")}
          {estado.rol === "cliente" && fila("llegada", "Taxi llegando", "Aviso cuando el taxi se acerca al punto de abordaje.")}
          {estado.rol === "cliente" && fila("viajes", "Avance del viaje", "Confirmación de abordaje y finalización del viaje.")}
        </Card>}
        {estado.ocupado && <ActivityIndicator color={Colors.primary} accessibilityLabel="Guardando preferencias" />}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  raiz: { flex: 1, backgroundColor: Colors.primary },
  fondo: { flex: 1, backgroundColor: Colors.surface },
  contenido: { padding: 16, gap: 16, paddingBottom: 40 },
  fila: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14 },
  textos: { flex: 1 },
  descripcion: { color: Colors.onSurfaceVariant, fontSize: 13, marginTop: 6, lineHeight: 20 },
});
