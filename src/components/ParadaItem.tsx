import React from "react";
import { Image, type ImageSourcePropType, View, StyleSheet, Pressable } from "react-native";
import Colors from "../theme/colors";
import AppText from "./AppText";
import { Icono } from "./Icono";

interface ParadaItemProps {
  nombre: string;
  descripcion: string;
  foto?: ImageSourcePropType;
  onPress?: () => void;
}

const ParadaItem: React.FC<ParadaItemProps> = ({ nombre, descripcion, foto, onPress }) => {
  return (
    <View>
      <View style={styles.row}>
        {foto ? (
          <Image source={foto} style={styles.foto} />
        ) : (
          <View style={styles.iconContainer}>
            <Icono nombre="locationOn" tamanio={22} color={Colors.primary} />
          </View>
        )}
        <View style={styles.textContainer}>
          <AppText weight="bold" style={styles.nombre}>{nombre}</AppText>
          <AppText style={styles.descripcion}>{descripcion}</AppText>
        </View>
        <Pressable
          style={({ pressed }) => [
            styles.arrowContainer,
            pressed && onPress && styles.arrowPressed,
          ]}
          onPress={onPress}
          disabled={!onPress}
          accessibilityRole="button"
          accessibilityLabel={`Ver detalles de ${nombre}`}
        >
          <Icono nombre="ArrowRight" tamanio={21} color={Colors.onSurfaceVariant} />
        </Pressable>
      </View>
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
  },
  iconContainer: {
    width: 43,
    height: 43,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.brandSoft,
  },
  foto: {
    width: 43,
    height: 43,
    borderRadius: 15,
    backgroundColor: Colors.brandSoft,
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
  arrowPressed: {
    opacity: 0.65,
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
