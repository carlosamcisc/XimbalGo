import React from "react";
import { View, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import Colors from "../theme/colors";

interface CardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

const Card: React.FC<CardProps> = ({ children, style }) => {
  return <View style={[styles.card, style]}>{children}</View>;
};

const styles = StyleSheet.create({
  card: {
    margin: 12,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: 8,
    elevation: 2,
    shadowColor: Colors.brandDeep,
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    backgroundColor: Colors.white,
  },
});

export default Card;
