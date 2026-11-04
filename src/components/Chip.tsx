import { ActivityIndicator, Pressable, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import AppText from "./AppText";
import { Icono, type NombreIcono } from "./Icono";
import Colors from "../theme/colors";

export interface ChipProps {
  titulo: string;
  onPress: () => void;
  icono?: NombreIcono;
  variante?: "suave" | "contorno";
  disabled?: boolean;
  cargando?: boolean;
  seleccionado?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
}

/** Acción secundaria compacta; permite varias líneas con texto ampliado. */
export default function Chip({
  titulo,
  onPress,
  icono,
  variante = "contorno",
  disabled = false,
  cargando = false,
  seleccionado,
  accessibilityLabel,
  accessibilityHint,
  style,
}: ChipProps) {
  const deshabilitado = disabled || cargando;
  const color = disabled ? Colors.outline : Colors.primary;

  return (
    <Pressable
      onPress={onPress}
      disabled={deshabilitado}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? titulo}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: deshabilitado, busy: cargando, selected: seleccionado }}
      style={({ pressed }) => [
        styles.chip,
        variante === "suave" && styles.suave,
        style,
        seleccionado && styles.seleccionado,
        pressed && styles.presionado,
        disabled && styles.deshabilitado,
      ]}
    >
      {cargando
        ? <ActivityIndicator size="small" color={color} />
        : icono && <Icono nombre={icono} tamanio={19} color={color} />}
      <AppText weight="semibold" style={[styles.texto, { color }]}>{titulo}</AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: 44,
    maxWidth: "100%",
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: Colors.routeLine,
    backgroundColor: Colors.surface,
  },
  suave: {
    backgroundColor: Colors.primaryContainer,
    borderColor: Colors.primaryContainer,
  },
  presionado: {
    backgroundColor: Colors.primaryFixed,
    borderColor: Colors.primary,
  },
  seleccionado: {
    backgroundColor: Colors.primaryContainer,
    borderColor: Colors.primary,
  },
  deshabilitado: {
    backgroundColor: Colors.surfaceContainer,
    borderColor: Colors.outlineVariant,
  },
  texto: { fontSize: 13, flexShrink: 1 },
});
