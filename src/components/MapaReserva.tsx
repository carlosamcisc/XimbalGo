import { useState, type ComponentProps, type ReactNode } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import MapaSeguimiento from "./MapaSeguimiento";
import AppText from "./AppText";
import { Icono } from "./Icono";
import Colors from "../theme/colors";

type Props = ComponentProps<typeof MapaSeguimiento> & { children?: ReactNode };

export default function MapaReserva({ children, style, ...mapa }: Props) {
  const [ampliado, setAmpliado] = useState(false);
  return <View style={style}>
    {!ampliado && <MapaSeguimiento {...mapa} usarPines onMaximizar={() => setAmpliado(true)} />}
    {!ampliado && children}
    <Modal visible={ampliado} animationType="slide" onRequestClose={() => setAmpliado(false)}>
      <SafeAreaView style={styles.pantalla}>
        <View style={styles.encabezado}>
          <View style={styles.titulos}>
            <AppText weight="bold" style={styles.titulo}>Tu taxi en el mapa</AppText>
            <AppText style={styles.subtitulo}>Ruta hacia {mapa.paradero?.titulo ?? mapa.punto?.titulo ?? "tu punto de abordaje"}</AppText>
          </View>
          <Pressable onPress={() => setAmpliado(false)} accessibilityRole="button" accessibilityLabel="Cerrar mapa ampliado" style={({ pressed }) => [styles.cerrar, pressed && styles.presionado]}>
            <Icono nombre="close" tamanio={24} color={Colors.primary} />
          </Pressable>
        </View>
        {ampliado && <MapaSeguimiento {...mapa} usarPines style={styles.mapa} />}
        <ScrollView style={styles.avisos} contentContainerStyle={styles.contenidoAvisos}>{children}</ScrollView>
      </SafeAreaView>
    </Modal>
  </View>;
}

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: Colors.surface, paddingHorizontal: 12, gap: 12 },
  encabezado: { flexDirection: "row", alignItems: "center", gap: 12, paddingTop: 8 },
  titulos: { flex: 1, gap: 3 },
  titulo: { fontSize: 18, color: Colors.brandDeep },
  subtitulo: { fontSize: 13, color: Colors.onSurfaceVariant },
  cerrar: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", backgroundColor: Colors.primaryContainer },
  presionado: { opacity: 0.65 },
  mapa: { flex: 1, minHeight: 180, height: undefined },
  avisos: { flexGrow: 0, maxHeight: "30%" },
  contenidoAvisos: { paddingBottom: 12 },
});
