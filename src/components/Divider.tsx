import React from "react";
import { View, StyleSheet } from "react-native";
import Colors  from "../theme/colors";
interface DividerProps {
  color?: string;   // 🔑 color opcional, si no se pasa usa gris
  thickness?: number; // opcional: grosor de la línea
  margin?: number;    // opcional: margen horizontal
}

const Divider: React.FC<DividerProps> = ({
  color = Colors.divider,
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
    marginVertical: 5,
  },
});

export default Divider;
