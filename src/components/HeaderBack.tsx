import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import Colors from "../theme/colors";
import { Icono } from "./Icono";

interface HeaderBackProps {
  onPress: () => void;
  label?: string;
}

const HeaderBack: React.FC<HeaderBackProps> = ({ onPress, label = "Atrás" }) => {
  return (
    <View style={styles.contentNavigation}>
      <Pressable style={styles.botonAtras} onPress={onPress}>
        <Icono nombre="arrowBack" tamanio={26} color={Colors.dark} />
      </Pressable>
      <Text style={styles.textAtras}>{label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  contentNavigation: {
    flexDirection: "row",
    alignItems: "center", // 🔑 asegura que icono y texto estén alineados
  },
  botonAtras: {
    marginTop: 10,
    marginLeft: 10,
    padding: 6,
  },
  textAtras: {
    fontSize: 20,
    marginLeft: 10,
    marginTop: 10,
  },
});

export default HeaderBack;
