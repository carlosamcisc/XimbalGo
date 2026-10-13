import type { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Colors from "../theme/colors";
import AppText from "./AppText";
import { Icono } from "./Icono";

interface Props {
  titulo: string;
  subtitulo?: string;
  onBack?: () => void;
  /** Acción a la derecha del título, p. ej. un botón de menú. */
  accion?: ReactNode;
}

/** Título y subtítulo sobre el fondo primario, con regreso opcional. */
export default function EncabezadoPantalla({ titulo, subtitulo, onBack, accion }: Props) {
  return (
    <View style={styles.encabezado}>
      {onBack && (
        <Pressable
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="Regresar"
          hitSlop={8}
          style={styles.boton}
        >
          <Icono nombre="arrowBack" tamanio={24} color={Colors.white} />
        </Pressable>
      )}
      <View style={styles.textos}>
        <AppText weight="bold" style={styles.titulo}>{titulo}</AppText>
        {subtitulo && <AppText style={styles.subtitulo}>{subtitulo}</AppText>}
      </View>
      {accion}
    </View>
  );
}

/** Botón redondo para el encabezado (p. ej. abrir el menú lateral). */
export function BotonEncabezado({
  children,
  onPress,
  accessibilityLabel,
}: {
  children: ReactNode;
  onPress: () => void;
  accessibilityLabel: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={8}
      style={({ pressed }) => [styles.boton, pressed && styles.botonPresionado]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  encabezado: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
  },
  boton: {
    width: 42,
    height: 42,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.16)",
  },
  botonPresionado: {
    backgroundColor: "rgba(255,255,255,0.3)",
  },
  textos: {
    flex: 1,
  },
  titulo: {
    fontSize: 24,
    color: Colors.white,
  },
  subtitulo: {
    fontSize: 15,
    color: Colors.brandSubtitle,
    marginTop: 4,
  },
});
