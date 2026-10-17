import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import Colors from "../theme/colors";
import AppText from "./AppText";

interface Props {
  cargando: boolean;
  error: string | null;
  vacio: boolean;
  textoCargando: string;
  textoVacio: string;
  onReintentar: () => void;
  children: ReactNode;
}

/** Muestra carga, error o vacío antes de renderizar los elementos de la lista. */
export default function EstadoLista({
  cargando,
  error,
  vacio,
  textoCargando,
  textoVacio,
  onReintentar,
  children,
}: Props) {
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
}

const styles = StyleSheet.create({
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
});
