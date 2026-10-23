import React from "react";
import { View, StyleSheet, Pressable } from "react-native";
import Colors from "../theme/colors";
import AppText from "./AppText";
import { Icono } from "./Icono";
import FotoParadero from "./FotoParadero";

interface ParadaItemProps {
  nombre: string;
  descripcion: string;
  fotoUrl?: string | null;
  onPress?: () => void;
}

const ParadaItem: React.FC<ParadaItemProps> = ({ nombre, descripcion, fotoUrl = null, onPress }) => {
  return (
    <View>
      <Pressable
        style={({ pressed }) => [styles.row, pressed && onPress && styles.rowPressed]}
        onPress={onPress}
        disabled={!onPress}
        accessibilityRole="button"
        accessibilityLabel={`Ver información de ${nombre}`}
      >
        <FotoParadero url={fotoUrl} style={styles.foto} />
        <View style={styles.textContainer}>
          <AppText weight="bold" style={styles.nombre}>{nombre}</AppText>
          {descripcion !== "" && <AppText style={styles.descripcion}>{descripcion}</AppText>}
        </View>
        <View style={styles.arrowContainer}>
          <Icono nombre="ArrowRight" tamanio={21} color={Colors.onSurfaceVariant} />
        </View>
      </Pressable>
      <View style={styles.divider} />
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 4,
    paddingVertical: 12,
    borderRadius: 14,
  },
  rowPressed: {
    backgroundColor: Colors.primaryContainer,
  },
  foto: {
    width: 43,
    height: 43,
    borderRadius: 15,
  },
  textContainer: {
    marginLeft: 11,
    flex: 1,
  },
  arrowContainer: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.surfaceMuted,
  },
  nombre: {
    fontSize: 14,
    color: Colors.brandText,
  },
  descripcion: {
    fontSize: 13,
    color: Colors.onSurfaceVariant,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.divider,
    marginLeft: 55,
  },
});

export default ParadaItem;
