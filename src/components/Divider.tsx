import React from "react";
import { View, StyleSheet } from "react-native";

interface DividerProps {
  color?: string;   // 🔑 color opcional, si no se pasa usa gris
  thickness?: number; // opcional: grosor de la línea
  margin?: number;    // opcional: margen horizontal
}

const Divider: React.FC<DividerProps> = ({
  color = "#ccc",
  thickness = 1,
  margin = 10,
}) => {
  return (
    <View
      style={[
        styles.divider,
        {
          backgroundColor: color,
          height: thickness,
          marginHorizontal: margin,
        },
      ]}
    />
  );
};

const styles = StyleSheet.create({
  divider: {
    width: "100%",
  },
});

export default Divider;
