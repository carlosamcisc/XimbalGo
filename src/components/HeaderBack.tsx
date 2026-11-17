import React from "react";
import { View, Pressable, StyleSheet } from "react-native";
import Colors from "../theme/colors";
import { Icono } from "./Icono";
import AppText from "./AppText";

interface HeaderBackProps {
  onPress: () => void;
  label?: string;
  accessibilityLabel?: string;
}

const HeaderBack: React.FC<HeaderBackProps> = ({
  onPress,
  label = "Atrás",
  accessibilityLabel = "Regresar",
}) => {
  return (
    <View style={styles.contentNavigation}>
      <Pressable
        style={({ pressed }) => [styles.botonAtras, pressed && styles.botonAtrasPresionado]}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
      >
        <Icono nombre="arrowBack" tamanio={26} color={Colors.white} />
      </Pressable>
      {label ? (
        <View style={styles.capsula}>
          <AppText weight="semibold" style={styles.textoEtiqueta}>{label}</AppText>
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  contentNavigation: {
    backgroundColor: Colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 20,
  },
  botonAtras: {
    minWidth: 44,
    minHeight: 44,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
  },
  botonAtrasPresionado: {
    backgroundColor: "rgba(255,255,255,0.24)",
  },
  capsula: {
    flexShrink: 1,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  textoEtiqueta: {
    color: Colors.surface,
    fontSize: 13,
  },
});

export default HeaderBack;
