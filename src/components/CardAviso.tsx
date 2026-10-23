import React from "react";
import { View, Text, StyleSheet } from "react-native";
import Colors from "../theme/colors";
import { Icono, type NombreIcono } from "./Icono";

interface CardAvisoProps {
  mensaje: string;
  icono?: NombreIcono;
  colorIcono?: string;
}

const CardAviso: React.FC<CardAvisoProps> = ({
  mensaje,
  icono = "info",
  colorIcono = Colors.primary,
}) => {
  return (
    <View style={styles.cardAviso}>
      <Icono nombre={icono} tamanio={24} color={colorIcono} />
      <Text style={styles.textAviso}>{mensaje}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  cardAviso: {
    backgroundColor: Colors.secondaryContainer,
    margin: 7,
    padding: 10,
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
  },
  textAviso: {
    marginLeft: 8,
    fontSize: 13,
    color: Colors.primary,
    lineHeight: 20,
    flex: 1,
  },
});

export default CardAviso;
